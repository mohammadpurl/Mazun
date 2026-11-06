import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { notFoundTitle } from '@/components/shop/copy';
import { ProductPage } from '@/components/shop/ProductPage';
import { requestLang } from '@/lib/lang';
import { catalogueOnce } from '@/lib/shop-data';

/** The same catalogue read the shop layout makes for this request. */
const find = async (id: string) => (await catalogueOnce()).garments.find(g => g.id === id && g.kind === 'garment');

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const [g, lang] = await Promise.all([params.then(p => find(decodeURIComponent(p.id))), requestLang()]);
  return { title: g ? g.name[lang] || g.name.en : notFoundTitle(lang, 'piece') };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  if (!(await find(id))) notFound();
  return <ProductPage id={id} />;
}
