/* Customer records: matching an order to its customer, and per-customer totals. Pure so both stores and the tests
   share one behaviour. A customer is identified by phone number (digits with country code). */
import { OPEN_STATUSES } from './labels';
import { isSale, owedOn } from './orders';
import { simplify } from './places';
import type { Address, Customer, NewOrder, Order } from './types';

export const newId = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const sameText = (a: string, b: string) => simplify(a) === simplify(b);

/** The saved address an order's city and street already match, if any. */
export function findAddress(addresses: Address[], city: string, line: string): Address | undefined {
  return addresses.find(a => sameText(a.city, city) && sameText(a.line, line));
}

/** Makes exactly one address the default: the given one, else the current default, else the first. */
export function withOneDefault(addresses: Address[], preferId?: string): Address[] {
  if (!addresses.length) return addresses;
  const pick = (preferId && addresses.some(a => a.id === preferId) && preferId)
    || addresses.find(a => a.isDefault)?.id || addresses[0].id;
  return addresses.map(a => ({ ...a, isDefault: a.id === pick }));
}

/** Links a new order to its customer: finds her by phone (or creates her) and saves the delivery address when it is
 *  new. Returns the customer as it should now be stored and whether anything changed. */
/** Addresses kept on one customer; an order to a further place keeps its own address and adds none. */
export const MAX_ADDRESSES = 10;

export function linkCustomer(customers: Customer[], order: Pick<NewOrder, 'customerName' | 'phone' | 'city' | 'address'>, now: string):
  { customer: Customer; created: boolean; changed: boolean } {
  const found = customers.find(c => c.phone === order.phone);
  const hasAddress = !!(order.city.trim() || order.address.trim());
  if (!found) {
    const addresses: Address[] = hasAddress
      ? [{ id: newId('a'), label: 'خانه', city: order.city.trim(), area: '', line: order.address.trim(), isDefault: true }] : [];
    return {
      created: true, changed: true,
      customer: { id: newId('u'), name: order.customerName.trim(), phone: order.phone, email: '', tags: [], addresses, notes: [], createdAt: now, updatedAt: now },
    };
  }
  let changed = false;
  const c: Customer = { ...found, addresses: [...found.addresses] };
  if (!c.name && order.customerName) { c.name = order.customerName.trim(); changed = true; }
  if (hasAddress && c.addresses.length < MAX_ADDRESSES && !findAddress(c.addresses, order.city, order.address)) {
    c.addresses.push({ id: newId('a'), label: c.addresses.length ? 'نشانی ' + (c.addresses.length + 1) : 'خانه', city: order.city.trim(), area: '', line: order.address.trim(), isDefault: !c.addresses.length });
    changed = true;
  }
  if (changed) c.updatedAt = now;
  return { customer: c, created: false, changed };
}

/** Customers rebuilt from orders alone: one per phone, newest name, every distinct address. Used once to backfill a
 *  store that had orders before customer records existed. Oldest order first so the first address is the default. */
export function customersFromOrders(orders: Order[], idOf: (phone: string) => string = () => newId('u')): Customer[] {
  const list: Customer[] = [];
  for (const o of [...orders].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (!o.phone) continue;
    const { customer, created } = linkCustomer(list, o, o.createdAt);
    if (created) customer.id = idOf(o.phone);
    customer.name = o.customerName || customer.name;
    customer.createdAt = created ? o.createdAt : customer.createdAt;
    customer.updatedAt = o.createdAt;
    const i = list.findIndex(c => c.phone === customer.phone);
    if (i >= 0) list[i] = customer; else list.push(customer);
  }
  return list;
}

/** Orders that belong to a customer: linked by id, or (for older orders) by the same phone. */
export const ordersOf = (c: Pick<Customer, 'id' | 'phone'>, orders: Order[]) =>
  orders.filter(o => o.customerId === c.id || (!o.customerId && o.phone === c.phone));

export interface CustomerTotals {
  orders: number;
  /** Order totals (without delivery charges) of her orders that count as sales (see isSale). */
  spent: number;
  /** What she still owes on accepted orders. */
  owed: number;
  lastOrderAt: string | null;
  firstOrderAt: string | null;
  open: number;
}

/** Totals per customer id, in one pass over the orders. */
export function customerTotals(customers: Customer[], orders: Order[]): Map<string, CustomerTotals> {
  const byPhone = new Map(customers.map(c => [c.phone, c.id]));
  const out = new Map<string, CustomerTotals>(customers.map(c => [c.id, { orders: 0, spent: 0, owed: 0, lastOrderAt: null, firstOrderAt: null, open: 0 }]));
  for (const o of orders) {
    const id = o.customerId && out.has(o.customerId) ? o.customerId : byPhone.get(o.phone);
    const t = id ? out.get(id) : undefined;
    if (!t) continue;
    t.orders++;
    if (isSale(o)) t.spent = Math.round((t.spent + o.total) * 1000) / 1000;
    t.owed = Math.round((t.owed + owedOn(o)) * 1000) / 1000;
    if (OPEN_STATUSES.includes(o.status)) t.open++;
    if (!t.lastOrderAt || o.createdAt > t.lastOrderAt) t.lastOrderAt = o.createdAt;
    if (!t.firstOrderAt || o.createdAt < t.firstOrderAt) t.firstOrderAt = o.createdAt;
  }
  return out;
}

/** Up to two initials for an avatar: "Noura Al-Said" → "NA", "سارا محمدی" → "س م". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '؟';
  const first = (s: string) => Array.from(s.replace(/^(al-|ال)/i, '') || s)[0] ?? '';
  const latin = /^[A-Za-z]/.test(parts[0]);
  const letters = [first(parts[0]), parts.length > 1 ? first(parts[parts.length - 1]) : ''].filter(Boolean);
  return latin ? letters.join('').toUpperCase() : letters.join('‌');
}

/** A stable tint (0–5) per customer, so an avatar keeps its colour everywhere. */
export function tintOf(seed: string): number {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 6;
}
