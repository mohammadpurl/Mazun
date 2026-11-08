import { ordersOnce, garmentsOnce, adminSettingsOnce } from '@/lib/admin-data';
import { notFound } from 'next/navigation';
import { CustomerDetail } from '@/components/admin/customers/CustomerDetail';
import { picsOf } from '@/components/admin/orders/picks';
import { UpgradeNotice } from '@/components/admin/UpgradeNotice';
import { ordersOf } from '@/lib/customers';
import { db } from '@/lib/db';

export const metadata = { title: 'پروندهٔ مشتری' };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = db();
  let customer;
  try { customer = await repo.getCustomer(id); } catch (e) { return <UpgradeNotice message={(e as Error).message} />; }
  if (!customer) notFound();
  const [orders, garments, settings] = await Promise.all([ordersOnce(), garmentsOnce(), adminSettingsOnce()]);
  const pics = picsOf(garments);
  return <CustomerDetail initial={customer} orders={ordersOf(customer, orders)} pics={pics} currency={settings.currency.fa || 'ریال'} />;
}
