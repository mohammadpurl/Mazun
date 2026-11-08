import { ordersOnce, garmentsOnce, adminSettingsOnce } from '@/lib/admin-data';
import { ProductsPage } from '@/components/admin/products/ProductsPage';
import { db } from '@/lib/db';
import { PRODUCT_KINDS, type ProductKind } from '@/lib/types';

export const metadata = { title: 'محصولات' };

export default async function Garments({ searchParams }: { searchParams: Promise<{ kind?: string; stock?: string; cat?: string }> }) {
  const [garments, categories, settings, orders, sp] = await Promise.all([garmentsOnce(), db().listCategories(), adminSettingsOnce(), ordersOnce(), searchParams]);
  // Pieces sold per product, cancelled orders left out.
  const sold: Record<string, number> = {};
  for (const o of orders) if (o.status !== 'cancelled') for (const it of o.items) if (it.garmentId) sold[it.garmentId] = (sold[it.garmentId] ?? 0) + it.qty;
  const kind = (PRODUCT_KINDS as readonly string[]).includes(sp.kind ?? '') ? (sp.kind as ProductKind) : 'all';
  return <ProductsPage initial={garments} categories={categories} sold={sold} currency={settings.currency.fa || 'ریال'} initialKind={kind} initialState={sp.stock === 'out' ? 'out' : 'all'}
    initialCat={categories.some(c => c.id === sp.cat) ? sp.cat : 'all'} />;
}
