/* Turns a validated order request into the order that is stored: every line is checked against the
   live catalogue and priced on the server, so the browser can never set a price or order a hidden piece. */
import { effectivePrice } from './fit';
import type { Category, Garment, L10n, Lang, NewOrder, Order, OrderInput, OrderItem, OrderPatch, OrderStatus, Payment, Shipping } from './types';
import { ONE_SIZE } from './defaults';

export type BuildResult = { ok: true; order: NewOrder } | { ok: false; error: 'unavailable' | 'soldout'; garmentId: string };

const text = (t: L10n, lang: Lang) => t[lang] || t.en || t.ar || t.fa;

/** Products the public shop may show: visible ones whose collection (if any) is visible too. */
export function isOnSale(g: Garment, hiddenCategories: Set<string>): boolean {
  return g.visible && !(g.categoryId && hiddenCategories.has(g.categoryId));
}

export function buildOrder(input: OrderInput, garments: Garment[], categories: Category[]): BuildResult {
  const hidden = new Set(categories.filter(c => !c.visible).map(c => c.id));
  const byId = new Map(garments.map(g => [g.id, g]));
  const items: OrderItem[] = [];
  for (const line of input.items) {
    const g = byId.get(line.garmentId);
    if (!g || !isOnSale(g, hidden)) return { ok: false, error: 'unavailable', garmentId: line.garmentId };
    if (!g.sizes.some(s => s.n === line.size && s.ok)) return { ok: false, error: 'soldout', garmentId: line.garmentId };
    const colour = g.colors[line.color] ?? g.colors[0];
    // The same piece, size and colour twice becomes one line.
    const same = items.find(i => i.garmentId === g.id && i.size === line.size && i.color === (colour ? text(colour.name, input.lang) : ''));
    if (same) { same.qty = Math.min(10, same.qty + line.qty); continue; }
    items.push({ garmentId: g.id, name: text(g.name, input.lang), size: line.size, color: colour ? text(colour.name, input.lang) : '', qty: line.qty, price: effectivePrice(g) });
  }
  const total = Math.round(items.reduce((a, i) => a + i.price * i.qty, 0) * 1000) / 1000;
  const { items: _lines, ...customer } = input;
  return { ok: true, order: { ...customer, items, total } };
}

/** One-line summary of an order's pieces, e.g. "Zayna (M) ×2, Reem (S)"; a free-size piece goes without a size. */
export const itemsSummary = (items: OrderItem[], sep = '، ', n: (v: number) => string = String) =>
  items.map(i => `${i.name}${i.size === ONE_SIZE ? '' : ` (${i.size})`}${i.qty > 1 ? ` ×${n(i.qty)}` : ''}`).join(sep);

export const emptyPayment = (): Payment => ({ status: 'unpaid', method: '', paid: 0, paidAt: null });
export const emptyShipping = (): Shipping => ({ carrier: '', tracking: '', fee: 0, shippedAt: null, deliveredAt: null });
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** What the customer owes in all: the pieces plus the delivery charge. */
export const amountDue = (o: Pick<Order, 'total' | 'shipping'>) => round3(o.total + (o.shipping?.fee ?? 0));
/** What is still to be received; never negative, and nothing for cancelled or refunded orders. */
export const balanceOf = (o: Pick<Order, 'total' | 'shipping' | 'payment' | 'status'>) =>
  o.status === 'cancelled' || o.payment.status === 'refunded' ? 0 : Math.max(0, round3(amountDue(o) - o.payment.paid));

/** An order that counts as a sale: accepted by the boutique (confirmed or further along), not cancelled, not refunded.
 *  New orders are not sales yet: they may never be confirmed. Every total in the panel uses this one rule. */
export const isSale = (o: Pick<Order, 'status' | 'payment'>) => o.status !== 'new' && o.status !== 'cancelled' && o.payment.status !== 'refunded';
/** Money still to collect on an accepted order (nothing on new, cancelled or refunded ones). Used everywhere "owed" is shown. */
export const owedOn = (o: Pick<Order, 'total' | 'shipping' | 'payment' | 'status'>) => (o.status === 'new' ? 0 : balanceOf(o));

/** A stored order from a new one: number, timestamps, and the parts the store fills in. */
export function completeOrder(order: NewOrder, id: number, now: string): Order {
  const status = order.status ?? 'new';
  const shipping = { ...emptyShipping(), ...order.shipping };
  const payment = settlePayment({ ...emptyPayment(), ...order.payment }, round3(order.total + shipping.fee), now);
  return {
    ...order, id, customerId: order.customerId ?? null, status, adminNote: order.adminNote ?? '', payment, shipping,
    history: [{ at: now, status, note: '' }], createdAt: now, updatedAt: now,
  };
}

/** Keeps a payment consistent with its status: paid means everything due, unpaid means nothing, partial means
 *  something less than everything. The date is set the first time money comes in. */
export function settlePayment(p: Payment, due: number, now: string, explicit = true): Payment {
  const out = { ...p, paid: round3(Math.max(0, p.paid || 0)) };
  if (explicit) {
    // The boutique set the payment: a "deposit" of nothing is unpaid and one of everything is paid; then paid and
    // unpaid set the amount.
    if (out.status === 'partial' && (out.paid <= 0 || out.paid >= due)) out.status = out.paid <= 0 ? 'unpaid' : 'paid';
    if (out.status === 'paid') out.paid = due;
    if (out.status === 'unpaid') out.paid = 0;
  } else {
    // Something else changed what is due (a delivery charge, an edited piece). Money received stays what it was:
    // a paid order that now costs more owes the difference; one that costs less shows the overpayment.
    if (out.status === 'paid' && out.paid < due) out.status = out.paid > 0 ? 'partial' : 'unpaid';
    if (out.status === 'partial' && out.paid >= due) out.status = 'paid';
  }
  if (out.status === 'paid' || out.status === 'partial') out.paidAt ??= now;
  if (out.status === 'unpaid') out.paidAt = null;
  return out;
}

/** A change refused by the order rules (dates out of order, an order that has moved on); the API answers 400. */
export class OrderRuleError extends Error {
  constructor(public field: string, message: string) { super(message); }
}

const muscatDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Muscat' }).format(new Date(iso));

/** Applies an admin change: a new status is added to the history and sets (or clears) the shipped and delivered
 *  times; payment is kept consistent with what is now due. */
export function applyOrderPatch(o: Order, patch: OrderPatch, now: string): Order {
  if (patch.onlyFrom && !patch.onlyFrom.includes(o.status)) throw new OrderRuleError('status', 'این سفارش در این فاصله به مرحلهٔ دیگری رفته است');
  const next: Order = { ...o, payment: { ...o.payment }, shipping: { ...o.shipping }, history: [...o.history], updatedAt: now };
  if (patch.adminNote !== undefined) next.adminNote = patch.adminNote;
  if (patch.edit) {
    Object.assign(next, patch.edit);
    // Say what changed, so a later question about the price can be answered from the history.
    const fa = (n: number) => n.toLocaleString('fa-IR', { maximumFractionDigits: 3 });
    const parts: string[] = [];
    if (JSON.stringify(o.items) !== JSON.stringify(next.items)) parts.push('اقلام');
    if (o.total !== next.total) parts.push(`مبلغ ${fa(o.total)} ← ${fa(next.total)}`);
    if (o.customerName !== next.customerName || o.phone !== next.phone) parts.push('مشتری');
    if (o.city !== next.city || o.address !== next.address) parts.push('نشانی');
    if (o.eventDate !== next.eventDate) parts.push('تاریخ مراسم');
    if (o.note !== next.note) parts.push('خواستهٔ مشتری');
    if (patch.shipping?.fee !== undefined && patch.shipping.fee !== o.shipping.fee) parts.push(`هزینهٔ ارسال ${fa(o.shipping.fee)} ← ${fa(patch.shipping.fee)}`);
    // Linking the order to its customer alone is bookkeeping, not an edit to record.
    const relinkOnly = !parts.length && o.customerId !== next.customerId;
    if ((!patch.status || patch.status === o.status) && !relinkOnly) next.history.push({ at: now, status: next.status, note: parts.length ? `ویرایش: ${parts.join('، ')}` : 'سفارش ویرایش شد' });
  }
  if (patch.shipping) next.shipping = { ...next.shipping, ...patch.shipping };
  if (patch.status && patch.status !== o.status) {
    next.status = patch.status;
    next.history.push({ at: now, status: patch.status, note: patch.statusNote ?? '' });
    if (patch.status === 'shipped') { next.shipping.shippedAt ??= now; next.shipping.deliveredAt = null; }
    if (patch.status === 'delivered') {
      next.shipping.shippedAt ??= now;
      // Never before it left: a shipping time entered as "today" can be later than this moment.
      next.shipping.deliveredAt ??= Date.parse(next.shipping.shippedAt) > Date.parse(now) ? next.shipping.shippedAt : now;
    }
    if (['new', 'confirmed', 'preparing'].includes(patch.status)) { next.shipping.shippedAt = null; next.shipping.deliveredAt = null; }
    // A refunded order that is reopened starts again with nothing received (unless the change says otherwise).
    if (o.status === 'cancelled' && patch.status !== 'cancelled' && o.payment.status === 'refunded' && !patch.payment) next.payment = emptyPayment();
  }
  // Checked once every change is in: delivered on an earlier day than shipped is refused; on the same day it is
  // taken as the moment it left (a day picked without a time).
  if (next.status !== 'delivered') next.shipping.deliveredAt = null;
  const { shippedAt, deliveredAt } = next.shipping;
  const touched = shippedAt !== o.shipping.shippedAt || deliveredAt !== o.shipping.deliveredAt;
  if (touched && shippedAt && deliveredAt && Date.parse(deliveredAt) < Date.parse(shippedAt)) {
    // The error goes under the date that was changed.
    const field = deliveredAt === o.shipping.deliveredAt ? 'shippedAt' : 'deliveredAt';
    if (muscatDay(deliveredAt) !== muscatDay(shippedAt)) throw new OrderRuleError(field, field === 'shippedAt' ? 'تاریخ ارسال نمی‌تواند پس از تاریخ تحویل باشد' : 'تاریخ تحویل نمی‌تواند پیش از تاریخ ارسال باشد');
    next.shipping.deliveredAt = shippedAt;
  }
  next.payment = settlePayment(patch.payment ? { ...next.payment, ...patch.payment } : next.payment, amountDue(next), now, !!patch.payment);
  return next;
}

/** The status an order moves to next in the usual flow, or null at the end of it. */
export function nextStatus(s: OrderStatus): OrderStatus | null {
  const flow: OrderStatus[] = ['new', 'confirmed', 'preparing', 'shipped', 'delivered'];
  const i = flow.indexOf(s);
  return i >= 0 && i < flow.length - 1 ? flow[i + 1] : null;
}

/** Money received beyond what is due (after a price was lowered): to be returned to the customer. */
export const overpaidOn = (o: Pick<Order, 'total' | 'shipping' | 'payment' | 'status'>) =>
  o.status === 'cancelled' || o.payment.status === 'refunded' ? 0 : Math.max(0, round3(o.payment.paid - amountDue(o)));

/** Days an order needs before its event: the shop's preparation, shipping and margin days plus the longest extra
 *  preparation of its pieces (the same sum the shop promises customers). */
export function daysNeeded(o: Pick<Order, 'items'>, s: { prepDays: number; shipDays: number; bufferDays: number }, leadDays: Record<string, number>) {
  const lead = Math.max(0, ...o.items.map(i => (i.garmentId ? leadDays[i.garmentId] ?? 0 : 0)));
  return s.prepDays + lead + s.shipDays + s.bufferDays;
}
/** An order whose event comes sooner than it needs and that has not left the atelier yet. */
export function eventAtRisk(o: Pick<Order, 'items' | 'eventDate' | 'status'>, needed: number, today: string): boolean {
  if (!o.eventDate || !['new', 'confirmed', 'preparing'].includes(o.status)) return false;
  return (Date.parse(o.eventDate + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86_400_000 <= needed;
}

/** An order read from storage written before payment, shipping and history existed. */
export function upgradeOrder(o: Order): Order {
  const shipping = { ...emptyShipping(), ...(o.shipping ?? {}) };
  const payment = { ...emptyPayment(), ...(o.payment ?? {}) };
  const history = Array.isArray(o.history) && o.history.length ? o.history : [{ at: o.createdAt, status: o.status, note: '' }];
  return { ...o, customerId: o.customerId ?? null, payment, shipping, history };
}

/** One line of an order entered in the admin. The product may be hidden or a size sold out (the boutique decides);
 *  the price may differ from the list price (a discount or a tailoring surcharge). */
export interface AdminLine { garmentId: string | null; name: string; size: string; color: string; qty: number; price: number }

/** Order lines from the admin form: names are taken from the catalogue in the order's language when the product still
 *  exists (otherwise the name sent is kept, for lines of a deleted product). */
export function buildAdminItems(lines: AdminLine[], garments: Garment[], lang: Lang): OrderItem[] {
  const byId = new Map(garments.map(g => [g.id, g]));
  return lines.map(l => {
    const g = l.garmentId ? byId.get(l.garmentId) : undefined;
    return { garmentId: g?.id ?? l.garmentId, name: g ? text(g.name, lang) : l.name, size: l.size, color: l.color, qty: l.qty, price: l.price };
  });
}
export const itemsTotal = (items: OrderItem[]) => Math.round(items.reduce((a, i) => a + i.price * i.qty, 0) * 1000) / 1000;
