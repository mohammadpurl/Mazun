import { NextResponse } from 'next/server';
import { bad, failed, guardAdminApi, jsonBody } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildAdminItems, itemsTotal } from '@/lib/orders';
import { validateAdminOrder } from '@/lib/validate';

/** An order taken by WhatsApp, phone or in the atelier, entered from the admin. Links (or creates) the customer and
 *  saves a new address on her, like a shop order. */
export async function POST(req: Request) {
  const denied = await guardAdminApi(req);
  if (denied) return denied;
  const r = validateAdminOrder(await jsonBody(req));
  if (!r.ok) return bad(r.errors);
  const v = r.value;
  try {
    const repo = db();
    const items = buildAdminItems(v.lines, await repo.listGarments(), v.lang);
    const order = await repo.createOrder({
      items, total: itemsTotal(items), customerId: v.customerId, customerName: v.customerName, phone: v.phone, city: v.city, address: v.address,
      note: v.note, adminNote: v.adminNote, eventDate: v.eventDate, lang: v.lang, status: v.status,
      shipping: { carrier: '', tracking: '', fee: v.fee, shippedAt: null, deliveredAt: null },
      payment: { status: v.payment.status, method: v.payment.method, paid: v.payment.paid, paidAt: null },
    });
    return NextResponse.json(order, { status: 201 });
  } catch (e) { return failed(e); }
}
