import type { Metadata } from 'next';
import { COPY } from '@/components/shop/copy';
import { CollectionPage } from '@/components/shop/CollectionPage';
import { requestLang } from '@/lib/lang';
import { shareImage, sharePreview } from '@/lib/share';
import { settingsOnce } from '@/lib/shop-data';

export async function generateMetadata(): Promise<Metadata> {
  const [lang, s] = await Promise.all([requestLang(), settingsOnce()]);
  const title = COPY[lang].navCollection, brand = s.brand[lang] || s.brand.en;
  return { title, ...sharePreview({ title: `${title} · ${brand}`, description: s.tagline[lang] || s.tagline.en, brand, lang, path: '/collection', image: shareImage(undefined, COPY[lang].shareAlt.replace('{brand}', brand)) }) };
}

export default function Page() {
  return <CollectionPage />;
}
