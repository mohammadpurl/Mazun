import { OrdersTable } from '@/components/admin/OrdersTable';
import { db } from '@/lib/db';

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [orders, settings] = await Promise.all([db().listOrders(), db().getSettings()]);
  const { status } = await searchParams;
  return <OrdersTable initial={orders} currency={settings.currency.fa} initialStatus={status ?? 'all'} />;
}
