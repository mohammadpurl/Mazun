import type { Metadata } from 'next';
import { COPY } from '@/components/shop/copy';
import { TryOnPage } from '@/components/shop/TryOnPage';
import { requestLang } from '@/lib/lang';
import { shareImage, sharePreview } from '@/lib/share';
import { settingsOnce } from '@/lib/shop-data';

export async function generateMetadata(): Promise<Metadata> {
  const [lang, s] = await Promise.all([requestLang(), settingsOnce()]);
  const c = COPY[lang], brand = s.brand[lang] || s.brand.en;
  // titleSoon ("See it worn before you buy") holds whether or not photo try-on is on, so the preview never over-promises.
  return { title: c.eyebrow, ...sharePreview({ title: `${c.eyebrow} · ${brand}`, description: c.titleSoon, brand, lang, path: '/fitting-room', image: shareImage(undefined, c.shareAlt.replace('{brand}', brand)) }) };
}

export default function FittingRoomPage() {
  return <TryOnPage />;
}
