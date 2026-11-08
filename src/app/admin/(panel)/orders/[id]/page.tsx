import { ordersOnce, garmentsOnce, adminSettingsOnce } from '@/lib/admin-data';
import { notFound } from 'next/navigation';
import { picsOf } from '@/components/admin/orders/picks';
import { OrderDetail } from '@/components/admin/orders/OrderDetail';
import { ordersOf } from '@/lib/customers';
import { db } from '@/lib/db';
import { isSale, owedOn } from '@/lib/orders';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: `سفارش #${(await params).id}` };
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id)) notFound();
  const repo = db();
  const [order, orders, garments, settings] = await Promise.all([repo.getOrder(id), ordersOnce(), garmentsOnce(), adminSettingsOnce()]);
  if (!order) notFound();
  const pics = picsOf(garments);
  const mine = ordersOf({ id: order.customerId ?? '', phone: order.phone }, orders);
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  const history = { orders: mine.length, spent: r3(mine.filter(isSale).reduce((a, o) => a + o.total, 0)), owed: r3(mine.reduce((a, o) => a + owedOn(o), 0)) };
  return <OrderDetail initial={order} pics={pics} cur={settings.currency} brand={settings.brand} history={history} />;
}
