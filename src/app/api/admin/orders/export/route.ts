import { guardAdminApi } from '@/lib/auth';
import { toCsv } from '@/lib/csv';
import { db } from '@/lib/db';
import { ONE_SIZE } from '@/lib/defaults';
import { CARRIER_LABEL, METHOD_LABEL, PAYMENT_LABEL, STATUS_LABEL } from '@/lib/labels';
import { amountDue, owedOn } from '@/lib/orders';
import { dayKey, SHOP_TZ } from '@/lib/stats';
import { ORDER_STATUSES, type OrderStatus } from '@/lib/types';

const muscat = new Intl.DateTimeFormat('en-CA', { timeZone: SHOP_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

/** CSV of orders. Optional filters: ?ids=1001,1002 (selected rows), ?status=new, ?from=yyyy-mm-dd&to=yyyy-mm-dd. */
export async function GET(req: Request) {
  const denied = await guardAdminApi(req);
  if (denied) return denied;
  const q = new URL(req.url).searchParams;
  const ids = new Set((q.get('ids') ?? '').split(',').filter(Boolean).map(Number).filter(n => Number.isSafeInteger(n) && n > 0));
  const status = q.get('status');
  const from = q.get('from'), to = q.get('to');
  const orders = (await db().listOrders()).filter(o =>
    (!q.has('ids') || ids.has(o.id))
    && (!status || !(ORDER_STATUSES as readonly string[]).includes(status) || o.status === (status as OrderStatus))
    && (!from || dayKey(new Date(o.createdAt)) >= from) && (!to || dayKey(new Date(o.createdAt)) <= to));
  const csv = toCsv([
    ['شماره', 'تاریخ ثبت (وقت مسقط)', 'وضعیت', 'اقلام', 'تعداد قطعه', 'جمع اقلام', 'هزینهٔ ارسال', 'مبلغ کل', 'پرداخت', 'روش پرداخت', 'دریافت‌شده', 'مانده',
      'نام مشتری', 'تلفن', 'شهر', 'آدرس', 'ارسال با', 'کد رهگیری', 'تاریخ ارسال', 'تاریخ تحویل', 'تاریخ مناسبت', 'یادداشت مشتری', 'یادداشت مدیر'],
    ...orders.map(o => [o.id, muscat.format(new Date(o.createdAt)).replace(',', ''), STATUS_LABEL[o.status],
      o.items.map(i => `${i.name} | ${i.color} | ${i.size === ONE_SIZE ? 'تک‌سایز' : i.size} | ×${i.qty} | ${i.price}`).join('\n'), o.items.reduce((a, i) => a + i.qty, 0),
      o.total, o.shipping.fee, amountDue(o), PAYMENT_LABEL[o.payment.status], o.payment.method ? METHOD_LABEL[o.payment.method] : '',
      o.payment.status === 'refunded' ? 0 : o.payment.paid, owedOn(o),
      o.customerName, o.phone, o.city, o.address, o.shipping.carrier ? CARRIER_LABEL[o.shipping.carrier] : '', o.shipping.tracking,
      o.shipping.shippedAt ? dayKey(new Date(o.shipping.shippedAt)) : '', o.shipping.deliveredAt ? dayKey(new Date(o.shipping.deliveredAt)) : '', o.eventDate ?? '', o.note, o.adminNote]),
  ]);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
