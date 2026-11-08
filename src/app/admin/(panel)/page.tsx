import { ordersOnce, garmentsOnce, adminSettingsOnce } from '@/lib/admin-data';
import { Dashboard } from '@/components/admin/dashboard/Dashboard';
import { db } from '@/lib/db';
import { buildDashboard, isPeriod, PERIODS, type Period } from '@/lib/stats';

export const metadata = { title: 'داشبورد' };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const repo = db();
  const [orders, garments, categories, customers, settings, { period }] = await Promise.all([
    ordersOnce(), garmentsOnce(), repo.listCategories(), repo.listCustomers().catch(() => []), adminSettingsOnce(), searchParams,
  ]);
  const input = { orders, garments, categories, customers, monthlyGoal: settings.monthlyGoal };
  // All three periods are worked out here, so switching between them on the page is instant.
  const data = Object.fromEntries(PERIODS.map(p => [p, buildDashboard(input, p)])) as Record<Period, ReturnType<typeof buildDashboard>>;
  return <Dashboard data={data} initial={isPeriod(period) ? period : 'month'} currency={settings.currency.fa || 'ریال'} live={repo.kind === 'supabase'} origin={settings.originCity.fa || 'مسقط'} />;
}
