import { NextResponse } from 'next/server';
import { bad, failed as failed500, guardAdminApi, jsonBody } from '@/lib/auth';
import { db } from '@/lib/db';
import { OrderRuleError } from '@/lib/orders';
import type { Order } from '@/lib/types';
import { validateBulkOrders } from '@/lib/validate';

/** Moves several orders forward to "confirmed" or "preparing" (shipping, delivery and cancelling need details per
 *  order). Orders already at or past that step, or cancelled, are skipped, never moved back. A few at a time; reports
 *  which orders were updated, skipped and failed, rather than failing the whole batch. */
export async function POST(req: Request) {
  const denied = await guardAdminApi(req);
  if (denied) return denied;
  const r = validateBulkOrders(await jsonBody(req));
  if (!r.ok) return bad(r.errors);
  const { ids, status } = r.value;
  if (status !== 'confirmed' && status !== 'preparing') return bad({ status: 'برای ارسال، تحویل یا لغو، سفارش‌ها را تک‌تک ثبت کنید' });
  const before: Record<string, Order['status'][]> = { confirmed: ['new'], preparing: ['new', 'confirmed'] };
  try {
  const current = new Map((await db().listOrders()).map(o => [o.id, o.status]));
  const eligible = ids.filter(id => before[status].includes(current.get(id)!));
  const skipped = ids.filter(id => !eligible.includes(id));
  const updated: Order[] = [], failed: number[] = [];
  const queue = [...eligible];
  await Promise.all(Array.from({ length: Math.min(6, queue.length) }, async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      try { const o = await db().updateOrder(id, { status, onlyFrom: before[status] }); if (o) updated.push(o); else failed.push(id); }
      catch (e) { if (e instanceof OrderRuleError) skipped.push(id); else { console.error('bulk status', id, e); failed.push(id); } }
    }
  }));
  return NextResponse.json({ updated, skipped, failed });
  } catch (e) { return failed500(e); }
}
