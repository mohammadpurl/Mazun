import { garmentsOnce, adminSettingsOnce } from '@/lib/admin-data';
import { notFound } from 'next/navigation';
import { OrderForm } from '@/components/admin/orders/OrderForm';
import { productPicks } from '@/components/admin/orders/picks';
import { db } from '@/lib/db';

export const metadata = { title: 'ویرایش سفارش' };

export default async function EditOrder({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id)) notFound();
  const repo = db();
  const [order, garments, customers, settings] = await Promise.all([repo.getOrder(id), garmentsOnce(), repo.listCustomers().catch(() => []), adminSettingsOnce()]);
  if (!order) notFound();
  return <OrderForm products={productPicks(garments)} customers={customers} currency={settings.currency.fa || 'ریال'} initial={order} />;
}
