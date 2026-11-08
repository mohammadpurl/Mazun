import { adminSettingsOnce } from '@/lib/admin-data';
import { notFound } from 'next/navigation';
import { ProductEditor } from '@/components/admin/products/ProductEditor';
import { db } from '@/lib/db';
import { PRODUCT_KINDS, type ProductKind } from '@/lib/types';

export const metadata = { title: 'ویرایش محصول' };

export default async function GarmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string }> }) {
  const [{ id }, { kind }] = await Promise.all([params, searchParams]);
  const [categories, garment, settings] = await Promise.all([db().listCategories(), id === 'new' ? null : db().getGarment(id), adminSettingsOnce()]);
  if (id !== 'new' && !garment) notFound();
  const k: ProductKind = kind === 'accessory' ? 'scarf' : (PRODUCT_KINDS as readonly string[]).includes(kind ?? '') ? (kind as ProductKind) : 'garment';
  return <ProductEditor key={garment?.id ?? 'new'} initial={garment} categories={categories} defaultKind={k} currency={settings.currency.fa || 'ریال'} />;
}
