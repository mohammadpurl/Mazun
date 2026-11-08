import { garmentsOnce, adminSettingsOnce } from '@/lib/admin-data';
import { OrderForm } from '@/components/admin/orders/OrderForm';
import { productPicks } from '@/components/admin/orders/picks';
import { db } from '@/lib/db';

export const metadata = { title: 'سفارش جدید' };

export default async function NewOrder({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const repo = db();
  const [garments, customers, settings, sp] = await Promise.all([garmentsOnce(), repo.listCustomers().catch(() => []), adminSettingsOnce(), searchParams]);
  return <OrderForm products={productPicks(garments)} customers={customers} currency={settings.currency.fa || 'ریال'} initial={null} presetCustomer={sp.customer} />;
}
