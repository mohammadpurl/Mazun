import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { COPY, notFoundTitle } from '@/components/shop/copy';
import { ProductPage } from '@/components/shop/ProductPage';
import { requestLang } from '@/lib/lang';
import { piecePath, shareImage, sharePreview } from '@/lib/share';
import { catalogueOnce, settingsOnce } from '@/lib/shop-data';
import type { Garment, Lang } from '@/lib/types';

/** The same catalogue read the shop layout makes for this request. */
const find = async (id: string) => (await catalogueOnce()).garments.find(g => g.id === id && g.kind === 'garment');

/** The piece's share card shows the house model wearing it; a piece without its own card shows the shop card. */
function sharePicture(g: Garment, name: string, brand: string, lang: Lang) {
  const pic = shareImage(g, '');
  return { ...pic, alt: pic.own ? `${COPY[lang].wearing} ${name}` : COPY[lang].shareAlt.replace('{brand}', brand) };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const [g, lang, s] = await Promise.all([params.then(p => find(decodeURIComponent(p.id))), requestLang(), settingsOnce()]);
  if (!g) return { title: notFoundTitle(lang, 'piece') };
  const name = g.name[lang] || g.name.en, brand = s.brand[lang] || s.brand.en;
  const description = g.description[lang] || g.description.en || s.tagline[lang] || s.tagline.en;
  return {
    title: name,
    description,
    ...sharePreview({ title: `${name} · ${brand}`, description, brand, lang, path: piecePath(g.id), image: sharePicture(g, name, brand, lang) }),
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  if (!(await find(id))) notFound();
  return <ProductPage id={id} />;
}
