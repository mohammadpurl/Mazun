import { NextResponse } from 'next/server';
import { bad, failed, guardAdminApi, jsonBody, notFound } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildAdminItems, itemsTotal, OrderRuleError } from '@/lib/orders';
import type { Order, OrderEdit } from '@/lib/types';
import { validateAdminOrder, validateOrderPatch } from '@/lib/validate';

type Ctx = { params: Promise<{ id: string }> };
const pickEdit = (o: Order): OrderEdit => ({ items: o.items, total: o.total, customerName: o.customerName, phone: o.phone, city: o.city, address: o.address, eventDate: o.eventDate, note: o.note, customerId: o.customerId, lang: o.lang });

export async function GET(req: Request, { params }: Ctx) {
  const denied = await guardAdminApi(req);
  if (denied) return denied;
  const id = Number((await params).id);
  const o = Number.isSafeInteger(id) ? await db().getOrder(id) : null;
  return o ? NextResponse.json(o) : notFound();
}

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await guardAdminApi(req);
  if (denied) return denied;
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id)) return notFound();
  const r = validateOrderPatch(await jsonBody(req));
  if (!r.ok) return bad(r.errors);
  try {
    const o = await db().updateOrder(id, r.value);
    return o ? NextResponse.json(o) : notFound();
  } catch (e) { return e instanceof OrderRuleError ? bad({ [e.field]: e.message }) : failed(e); }
}

/** Corrects what was ordered, the prices, the customer details or the delivery address; recorded in the history. */
export async function PUT(req: Request, { params }: Ctx) {
  const denied = await guardAdminApi(req);
  if (denied) return denied;
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id)) return notFound();
  const r = validateAdminOrder(await jsonBody(req));
  if (!r.ok) return bad(r.errors);
  const v = r.value;
  try {
    const repo = db();
    const cur = await repo.getOrder(id);
    if (!cur) return notFound();
    const items = buildAdminItems(v.lines, await repo.listGarments(), v.lang);
    // The customer chosen in the form; with none chosen, the same customer while the phone is unchanged, otherwise
    // the one with the new phone (or a new one). A new address is saved on her, as with a new order.
    // The order is saved first, so a refused edit creates no customer or address; the link follows in a second step.
    const keep = !v.customerId && v.phone === cur.phone ? cur.customerId : null;
    const saved = await repo.updateOrder(id, {
      edit: { items, total: itemsTotal(items), customerName: v.customerName, phone: v.phone, city: v.city, address: v.address, eventDate: v.eventDate, note: v.note, customerId: cur.customerId, lang: v.lang },
      shipping: { fee: v.fee },
      adminNote: v.adminNote,
    });
    if (!saved) return notFound();
    const customerId = await repo.linkCustomer({ customerId: v.customerId ?? keep, customerName: v.customerName, phone: v.phone, city: v.city, address: v.address })
      .catch(e => { console.error('order edited without customer link:', e); return cur.customerId; });
    const o = customerId === saved.customerId ? saved
      : await repo.updateOrder(id, { edit: { ...pickEdit(saved), customerId } }).catch(e => { console.error('customer link not saved:', e); return saved; });
    return NextResponse.json(o ?? saved);
  } catch (e) { return e instanceof OrderRuleError ? bad({ [e.field]: e.message }) : failed(e); }
}
