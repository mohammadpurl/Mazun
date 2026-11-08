import { adminSettingsOnce, garmentsOnce, ordersOnce } from '@/lib/admin-data';
import { picsOf } from '@/components/admin/orders/picks';
import { OrdersPage, type PayFilter, type StatusFilter } from '@/components/admin/orders/OrdersPage';
import { ORDER_STATUSES } from '@/lib/types';

export const metadata = { title: 'سفارش‌ها' };

export default async function Orders({ searchParams }: { searchParams: Promise<{ status?: string; pay?: string; q?: string; risk?: string }> }) {
  const [orders, garments, settings, sp] = await Promise.all([ordersOnce(), garmentsOnce(), adminSettingsOnce(), searchParams]);
  const status: StatusFilter = sp.status === 'active' || (ORDER_STATUSES as readonly string[]).includes(sp.status ?? '') ? (sp.status as StatusFilter) : 'all';
  const pay: PayFilter = ['unpaid', 'partial', 'paid', 'due', 'overdue'].includes(sp.pay ?? '') ? (sp.pay as PayFilter) : 'all';
  // "Event soon" means sooner than the boutique needs to prepare (with each piece's extra days) and ship.
  const leadDays = Object.fromEntries(garments.map(g => [g.id, g.leadDays]));
  return <OrdersPage initial={orders} pics={picsOf(garments)} currency={settings.currency.fa || 'ریال'} initialStatus={status} initialPay={pay}
    initialQ={sp.q?.slice(0, 60) ?? ''} initialRisk={sp.risk === '1'} days={settings} leadDays={leadDays} />;
}
