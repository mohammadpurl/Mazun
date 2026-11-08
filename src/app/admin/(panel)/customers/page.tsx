import { ordersOnce, adminSettingsOnce } from '@/lib/admin-data';
import { CustomersPage } from '@/components/admin/customers/CustomersPage';
import { UpgradeNotice } from '@/components/admin/UpgradeNotice';
import { customerTotals } from '@/lib/customers';
import { db } from '@/lib/db';

export const metadata = { title: 'مشتریان' };

export default async function Customers({ searchParams }: { searchParams: Promise<{ new?: string; segment?: string }> }) {
  const repo = db();
  const [orders, settings, sp] = await Promise.all([ordersOnce(), adminSettingsOnce(), searchParams]);
  let customers;
  try { customers = await repo.listCustomers(); } catch (e) { return <UpgradeNotice message={(e as Error).message} />; }
  const totals = customerTotals(customers, orders);
  const rows = customers.map(c => ({ ...c, t: totals.get(c.id)! }));
  const segment = ['new', 'loyal', 'owes', 'vip', 'none'].includes(sp.segment ?? '') ? (sp.segment as 'new') : 'all';
  return <CustomersPage initial={rows} currency={settings.currency.fa || 'ریال'} openNew={sp.new === '1'} initialSegment={segment} />;
}
