import { guardAdminApi } from '@/lib/auth';
import { toCsv } from '@/lib/csv';
import { db } from '@/lib/db';
import { STATUS_LABEL } from '@/lib/labels';

export async function GET(req: Request) {
  const denied = await guardAdminApi(req);
  if (denied) return denied;
  const orders = await db().listOrders();
  const csv = toCsv([
    ['شماره', 'تاریخ ثبت (UTC)', 'وضعیت', 'لباس', 'سایز', 'قیمت', 'نام مشتری', 'تلفن', 'شهر', 'آدرس', 'تاریخ مناسبت', 'یادداشت مشتری', 'یادداشت مدیر'],
    ...orders.map(o => [o.id, o.createdAt.slice(0, 16).replace('T', ' '), STATUS_LABEL[o.status], o.garmentName, o.size, o.price,
      o.customerName, o.phone, o.city, o.address, o.eventDate ?? '', o.note, o.adminNote]),
  ]);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
