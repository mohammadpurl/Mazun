import type { Metadata } from 'next';
import { COPY } from '@/components/shop/copy';
import { HomePage } from '@/components/shop/HomePage';
import { requestLang } from '@/lib/lang';
import { shareImage, sharePreview } from '@/lib/share';
import { settingsOnce } from '@/lib/shop-data';

export async function generateMetadata(): Promise<Metadata> {
  const [s, lang] = await Promise.all([settingsOnce(), requestLang()]);
  const brand = s.brand[lang] || s.brand.en;
  return sharePreview({ title: brand, description: s.tagline[lang] || s.tagline.en, brand, lang, path: '/', image: shareImage(undefined, COPY[lang].shareAlt.replace('{brand}', brand)) });
}

export default function Page() {
  return <HomePage />;
}
