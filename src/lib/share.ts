import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { SEED_PHOTOS } from './defaults';
import { productHref } from './paths';
import type { Garment, Lang } from './types';

/** A plain host name with an optional port: nothing that could carry markup or another scheme. */
const HOST = /^[a-z0-9.-]+(:\d{1,5})?$/i;

/** An http(s) origin from a configured value ("https://www.mazun.om/", "mazun.om"), or null when it is not one. */
export function originOf(value: string | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  // A value with its own scheme keeps it (and only http and https pass); a bare host is taken as https.
  const schemed = /^[a-z][a-z0-9+.-]*:\/\//i.test(v);
  try {
    const u = new URL(schemed ? v : `https://${v}`);
    return (u.protocol === 'http:' || u.protocol === 'https:') && HOST.test(u.host) ? u.origin : null;
  } catch { return null; }
}

let warned = false;

/** The shop's public address for absolute links (link previews, canonical addresses, the sitemap), in this order:
 *  SITE_URL; the first entry of SITE_ORIGIN (the origins the live try-on token accepts); Vercel's production domain;
 *  this deployment's Vercel address; and only then the request's own host. That last one is checked to be a plain host
 *  name, so a forged Host or X-Forwarded-Host cannot put markup or another scheme into a page or the sitemap; it can
 *  still name another host, which is why production should set SITE_URL (on Vercel the Vercel addresses come first). */
export async function siteOrigin(): Promise<string> {
  const fixed = originOf(process.env.SITE_URL) ?? originOf(process.env.SITE_ORIGIN?.split(',')[0])
    ?? (process.env.VERCEL_ENV === 'production' ? originOf(process.env.VERCEL_PROJECT_PRODUCTION_URL) : null)
    ?? originOf(process.env.VERCEL_URL);
  if (fixed) return fixed;
  if (process.env.NODE_ENV === 'production' && !warned) { warned = true; console.warn('share: set SITE_URL so link previews and the sitemap name the shop\'s own address'); }
  const h = await headers();
  const host = h.get('x-forwarded-host')?.split(',')[0]?.trim() || h.get('host') || '';
  const proto = h.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  if (!HOST.test(host)) return 'http://localhost:5188';
  const local = /^(localhost|127\.)/.test(host);
  return `${proto === 'http' || proto === 'https' ? proto : local ? 'http' : 'https'}://${host}`;
}

/** A piece's page, for server code. */
export const piecePath = productHref;

const LOCALE: Record<Lang, string> = { ar: 'ar_OM', en: 'en_GB', fa: 'fa_IR' };

/** Bumped whenever the share pictures are remade (scripts/make-share-images.py), so chat apps fetch them again
 *  instead of showing the copy they cached. */
const SHARE_VERSION = 2;

/** The picture a shared link shows: the shop card (public/og.jpg), or a seeded piece's own card
 *  (public/images/share/<id>.jpg) while both its worn photos are still the seeded ones the card was made from.
 *  A piece added in the admin falls back to the shop card: its cut-outs are transparent, which chat apps paint black. */
export function shareImage(g: Garment | undefined, alt: string) {
  const own = !!g && SEED_PHOTOS.has(g.id) && g.wornFront === `/images/worn/${g.id}-front.webp` && g.wornBack === `/images/worn/${g.id}-back.webp`;
  return { url: `${own ? `/images/share/${g.id}.jpg` : '/og.jpg'}?v=${SHARE_VERSION}`, width: 1200, height: 630, alt, own };
}

/** What a link shows when it is shared in WhatsApp, Instagram, X or iMessage: title, description and picture.
 *  `path` also becomes the page's canonical address; the layout leaves it out, so a page without its own preview
 *  does not claim the home page's address. The page reads in the visitor's language; the other two are named as
 *  alternates. */
export function sharePreview({ title, description, brand, lang, path, image }: {
  title: string; description: string; brand: string; lang: Lang; path?: string; image: ReturnType<typeof shareImage>;
}): Pick<Metadata, 'openGraph' | 'twitter' | 'alternates'> {
  const pic = { url: image.url, width: image.width, height: image.height, alt: image.alt };
  return {
    ...(path ? { alternates: { canonical: path } } : {}),
    openGraph: {
      type: 'website', siteName: brand, title, description, images: [pic], ...(path ? { url: path } : {}),
      locale: LOCALE[lang], alternateLocale: (Object.keys(LOCALE) as Lang[]).filter(l => l !== lang).map(l => LOCALE[l]),
    },
    twitter: { card: 'summary_large_image', title, description, images: [{ url: pic.url, alt: pic.alt }] },
  };
}
