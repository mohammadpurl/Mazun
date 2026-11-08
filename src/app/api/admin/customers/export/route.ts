import { dayKey } from '@/lib/stats';
import { failed, guardAdminApi } from '@/lib/auth';
import { toCsv } from '@/lib/csv';
import { customerTotals } from '@/lib/customers';
import { db } from '@/lib/db';

/** CSV of customers with their order totals and default address. ?ids=a,b exports only those. */
export async function GET(req: Request) {
  const denied = await guardAdminApi(req);
  if (denied) return denied;
  const ids = new Set((new URL(req.url).searchParams.get('ids') ?? '').split(',').filter(Boolean));
  let customers, orders;
  try { [customers, orders] = await Promise.all([db().listCustomers(), db().listOrders()]); }
  catch (e) { return failed(e); }
  const totals = customerTotals(customers, orders);
  const rows = customers.filter(c => !new URL(req.url).searchParams.has('ids') || ids.has(c.id));
  const csv = toCsv([
    ['نام', 'تلفن', 'ایمیل', 'برچسب‌ها', 'شهر', 'منطقه', 'نشانی', 'تعداد سفارش', 'مجموع خرید', 'آخرین سفارش', 'تاریخ عضویت'],
    ...rows.map(c => {
      const a = c.addresses.find(x => x.isDefault) ?? c.addresses[0];
      const t = totals.get(c.id)!;
      return [c.name, c.phone, c.email, c.tags.join('، '), a?.city ?? '', a?.area ?? '', a?.line ?? '', t.orders, t.spent, t.lastOrderAt ? dayKey(new Date(t.lastOrderAt)) : '', dayKey(new Date(c.createdAt))];
    }),
  ]);
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="customers-${dayKey(new Date())}.csv"`, 'Cache-Control': 'no-store' },
  });
}
