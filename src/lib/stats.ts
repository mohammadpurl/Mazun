/* Dashboard numbers, computed from the stored records. Pure so it can be tested.
   Days are calendar days in the shop's time zone (Oman), not UTC, so "today" matches the shop's day; months are
   Persian calendar months, as the panel is read in Persian. */
import { ONE_SIZE } from './defaults';
import { isSale, owedOn } from './orders';
import { cityGroup } from './places';
import type { Category, Customer, Garment, Order, OrderStatus } from './types';

export const SHOP_TZ = 'Asia/Muscat';
const DAY = 86_400_000;

const fmtCache = new Map<string, Intl.DateTimeFormat>();
const fmt = (locale: string, o: Intl.DateTimeFormatOptions, tz: string) => {
  const k = locale + tz + JSON.stringify(o);
  let f = fmtCache.get(k);
  if (!f) { f = new Intl.DateTimeFormat(locale, { ...o, timeZone: tz }); fmtCache.set(k, f); }
  return f;
};

// Keys are worked out once per instant: the dashboard asks for the same order's day and month many times.
const keyCache = new Map<string, string>();
const cached = (k: string, make: () => string) => {
  let v = keyCache.get(k);
  if (v === undefined) { if (keyCache.size > 200_000) keyCache.clear(); v = make(); keyCache.set(k, v); }
  return v;
};
/** YYYY-MM-DD of an instant in the given time zone. */
export const dayKey = (d: Date, tz = SHOP_TZ) => cached('d' + tz + d.getTime(), () => fmt('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }, tz).format(d));
/** YYYY-MM of the Persian calendar month an instant falls in (in the given time zone). */
export function monthKey(d: Date, tz = SHOP_TZ) {
  return cached('m' + tz + d.getTime(), () => {
    const p = Object.fromEntries(fmt('en-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric' }, tz).formatToParts(d).map(x => [x.type, x.value]));
    return `${p.year}-${String(p.month).padStart(2, '0')}`;
  });
}

export const PERIODS = ['week', 'month', 'year'] as const;
export type Period = (typeof PERIODS)[number];
export const isPeriod = (v: unknown): v is Period => (PERIODS as readonly unknown[]).includes(v);
export const PERIOD_LABEL: Record<Period, { now: string; prev: string; unit: string }> = {
  week: { now: '۷ روز اخیر', prev: 'هفتهٔ قبل', unit: 'روز' },
  month: { now: '۳۰ روز اخیر', prev: '۳۰ روز قبل', unit: 'روز' },
  year: { now: '۱۲ ماه اخیر', prev: 'سال قبل', unit: 'ماه' },
};

export interface Bucket { key: string; label: string; revenue: number; orders: number; prevRevenue: number; prevOrders: number; customers: number; shipped: number }
export interface Delta { current: number; previous: number; delta: number | null }

export interface Dashboard {
  period: Period;
  revenue: Delta;
  orders: Delta;
  pieces: number;
  avgOrder: Delta;
  goal: { target: number; achieved: number; pct: number; month: string } | null;
  series: Bucket[];
  funnel: { key: 'placed' | 'confirmed' | 'shipped' | 'delivered'; count: number; pct: number }[];
  cancelled: number;
  /** Orders of the period not confirmed yet (not counted as sales). */
  pending: { count: number; amount: number };
  /** New orders nobody has looked at for more than a day (any date). */
  staleNew: { count: number; oldest: string | null };
  byCollection: { id: string; name: string; revenue: number; previous: number; delta: number | null; share: number }[];
  top: { id: string; name: string; image: string; color: string; pieces: number; revenue: number; share: number }[];
  sizes: { size: string; pieces: number }[];
  cities: { key: string; name: string; lat: number | null; lon: number | null; orders: number; revenue: number; delivered: number; avgDays: number | null }[];
  shipping: { awaiting: number; inTransit: number; delivered: number; avgDays: number | null; late: number };
  payments: { collected: number; due: number; outstanding: number; overdue: { count: number; amount: number }; paidPct: number };
  customers: { total: number; fresh: Delta; returningPct: number | null; buyers: number };
  /** Open orders by status, all dates (for the KPI cards). */
  open: Record<OrderStatus, number>;
  events: { label: string; ready: number; pending: number }[];
  soldOut: { id: string; name: string; sizes: string[] }[];
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r1 = (n: number) => Math.round(n * 10) / 10;
export const deltaOf = (current: number, previous: number): Delta =>
  ({ current: r3(current), previous: r3(previous), delta: previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null });

/** Bucket keys oldest first: `count` of them, ending `offset` buckets before the current one. */
function bucketKeys(period: Period, now: Date, tz: string, count: number, offset: number): string[] {
  if (period !== 'year') return Array.from({ length: count }, (_, i) => dayKey(new Date(now.getTime() - (offset + count - 1 - i) * DAY), tz));
  const months: string[] = [];
  for (let d = 0; months.length < offset + count && d < 800; d++) {
    const k = monthKey(new Date(now.getTime() - d * DAY), tz);
    if (months.at(-1) !== k) months.push(k);
  }
  return months.slice(offset, offset + count).reverse();
}

/** "۱۶ آبان" for a day, "آبان" for a month. */
function bucketLabel(period: Period, key: string) {
  if (period === 'year') {
    const [y, m] = key.split('-').map(Number);
    return persianMonthName(y, m);
  }
  return new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(Date.parse(key + 'T12:00:00Z'));
}
/** Persian month name for a Persian year/month, found from a day inside that month. */
function persianMonthName(y: number, m: number) {
  // Persian year y starts around 21 March of Gregorian y + 621; month m starts about (m − 1) × 30.5 days later.
  const approx = Date.UTC(y + 621, 2, 21) + ((m - 1) * 30.6 + 10) * DAY;
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'long', timeZone: 'UTC' }).format(approx);
}

const isLive = isSale;
const CONFIRMED: OrderStatus[] = ['confirmed', 'preparing', 'shipped', 'delivered'];
const SHIPPED: OrderStatus[] = ['shipped', 'delivered'];

export interface DashboardInput { orders: Order[]; garments: Garment[]; categories: Category[]; customers: Customer[]; monthlyGoal: number }

export function buildDashboard(input: DashboardInput, period: Period = 'month', now = new Date(), tz = SHOP_TZ): Dashboard {
  const { orders, garments, categories, customers } = input;
  const count = period === 'week' ? 7 : period === 'month' ? 30 : 12;
  const keyOf = (iso: string) => (period === 'year' ? monthKey(new Date(iso), tz) : dayKey(new Date(iso), tz));
  const curKeys = bucketKeys(period, now, tz, count, 0);
  const prevKeys = bucketKeys(period, now, tz, count, count);
  const curIndex = new Map(curKeys.map((k, i) => [k, i]));
  const prevIndex = new Map(prevKeys.map((k, i) => [k, i]));
  const series: Bucket[] = curKeys.map(k => ({ key: k, label: bucketLabel(period, k), revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0, customers: 0, shipped: 0 }));

  const inCur: Order[] = [];
  const inPrev: Order[] = [];
  for (const o of orders) {
    const k = keyOf(o.createdAt);
    const ci = curIndex.get(k);
    if (ci !== undefined) {
      inCur.push(o);
      if (isLive(o)) { series[ci].revenue = r3(series[ci].revenue + o.total); series[ci].orders++; }
      continue;
    }
    const pi = prevIndex.get(k);
    if (pi !== undefined) {
      inPrev.push(o);
      if (isLive(o)) { series[pi].prevRevenue = r3(series[pi].prevRevenue + o.total); series[pi].prevOrders++; }
    }
  }
  for (const c of customers) {
    const ci = curIndex.get(keyOf(c.createdAt));
    if (ci !== undefined) series[ci].customers++;
  }
  for (const o of orders) {
    const si = o.shipping.shippedAt ? curIndex.get(keyOf(o.shipping.shippedAt)) : undefined;
    if (si !== undefined) series[si].shipped++;
  }
  const live = inCur.filter(isLive), livePrev = inPrev.filter(isLive);
  const sum = (list: Order[]) => list.reduce((a, o) => a + o.total, 0);
  const revenue = deltaOf(sum(live), sum(livePrev));
  const avg = (list: Order[]) => (list.length ? sum(list) / list.length : 0);

  // Goal: this Persian month so far, whatever period is on screen.
  const thisMonth = monthKey(now, tz);
  const monthRevenue = orders.filter(o => isLive(o) && monthKey(new Date(o.createdAt), tz) === thisMonth).reduce((a, o) => a + o.total, 0);
  const goal = input.monthlyGoal > 0
    ? { target: input.monthlyGoal, achieved: r3(monthRevenue), pct: Math.round((monthRevenue / input.monthlyGoal) * 100), month: bucketLabel('year', thisMonth) }
    : null;

  const placed = inCur.length || 0;
  const pct = (n: number) => (placed ? Math.round((n / placed) * 100) : 0);
  const nConfirmed = inCur.filter(o => CONFIRMED.includes(o.status)).length;
  const nShipped = inCur.filter(o => SHIPPED.includes(o.status)).length;
  const nDelivered = inCur.filter(o => o.status === 'delivered').length;
  const funnel: Dashboard['funnel'] = [
    { key: 'placed', count: placed, pct: placed ? 100 : 0 },
    { key: 'confirmed', count: nConfirmed, pct: pct(nConfirmed) },
    { key: 'shipped', count: nShipped, pct: pct(nShipped) },
    { key: 'delivered', count: nDelivered, pct: pct(nDelivered) },
  ];

  const stale = orders.filter(o => o.status === 'new' && now.getTime() - Date.parse(o.createdAt) > DAY);
  const staleNew = { count: stale.length, oldest: stale.reduce<string | null>((a, o) => (!a || o.createdAt < a ? o.createdAt : a), null) };

  // Sales by collection (garments) with accessories as one group.
  const gById = new Map(garments.map(g => [g.id, g]));
  const catName = new Map(categories.map(c => [c.id, c.name.fa || c.name.en]));
  const groupOf = (garmentId: string | null) => {
    const g = garmentId ? gById.get(garmentId) : undefined;
    if (!g) return { id: 'other', name: 'سایر' };
    if (g.kind !== 'garment') return { id: 'accessories', name: 'اکسسوری' };
    return g.categoryId && catName.has(g.categoryId) ? { id: g.categoryId, name: catName.get(g.categoryId)! } : { id: 'none', name: 'بدون مجموعه' };
  };
  const coll = new Map<string, { id: string; name: string; revenue: number; previous: number }>();
  const addColl = (list: Order[], field: 'revenue' | 'previous') => {
    for (const o of list) for (const it of o.items) {
      const g = groupOf(it.garmentId);
      const row = coll.get(g.id) ?? { ...g, revenue: 0, previous: 0 };
      row[field] = r3(row[field] + it.price * it.qty);
      coll.set(g.id, row);
    }
  };
  addColl(live, 'revenue');
  addColl(livePrev, 'previous');
  const collTotal = [...coll.values()].reduce((a, c) => a + c.revenue, 0);
  const byCollection = [...coll.values()]
    .map(c => ({ ...c, delta: deltaOf(c.revenue, c.previous).delta, share: collTotal ? Math.round((c.revenue / collTotal) * 1000) / 10 : 0 }))
    .sort((a, b) => b.revenue - a.revenue);

  // Best sellers by pieces.
  const prod = new Map<string, { id: string; name: string; image: string; color: string; pieces: number; revenue: number }>();
  const sizeCount = new Map<string, number>();
  let pieces = 0;
  for (const o of live) for (const it of o.items) {
    pieces += it.qty;
    if (it.size !== ONE_SIZE) sizeCount.set(it.size, (sizeCount.get(it.size) ?? 0) + it.qty);
    const g = it.garmentId ? gById.get(it.garmentId) : undefined;
    const id = g?.id ?? 'name:' + it.name;
    const row = prod.get(id) ?? { id, name: g ? g.name.fa || g.name.en : it.name, image: g ? g.wornFront || g.front : '', color: g?.colors[0]?.hex ?? '#D6C7B1', pieces: 0, revenue: 0 };
    row.pieces += it.qty;
    row.revenue = r3(row.revenue + it.price * it.qty);
    prod.set(id, row);
  }
  const topList = [...prod.values()].sort((a, b) => b.pieces - a.pieces || b.revenue - a.revenue).slice(0, 6);
  const topMax = topList[0]?.pieces || 1;
  const top = topList.map(p => ({ ...p, share: Math.round((p.pieces / topMax) * 100) }));
  const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const sizes = [...sizeCount].map(([size, n]) => ({ size, pieces: n }))
    .sort((a, b) => (sizeOrder.indexOf(a.size) + 1 || 99) - (sizeOrder.indexOf(b.size) + 1 || 99) || a.size.localeCompare(b.size));

  // Where orders went.
  const daysBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / DAY;
  const cityMap = new Map<string, Dashboard['cities'][number] & { days: number[] }>();
  for (const o of live) {
    const g = cityGroup(o.city);
    const row = cityMap.get(g.key) ?? { key: g.key, name: g.name, lat: g.city?.lat ?? null, lon: g.city?.lon ?? null, orders: 0, revenue: 0, delivered: 0, avgDays: null, days: [] };
    row.orders++;
    row.revenue = r3(row.revenue + o.total);
    if (o.status === 'delivered') {
      row.delivered++;
      if (o.shipping.deliveredAt) row.days.push(daysBetween(o.createdAt, o.shipping.deliveredAt));
    }
    cityMap.set(g.key, row);
  }
  const mean = (xs: number[]) => (xs.length ? r1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const cities = [...cityMap.values()].map(({ days, ...c }) => ({ ...c, avgDays: mean(days) })).sort((a, b) => b.orders - a.orders || b.revenue - a.revenue);

  // Delivery: open work is counted over all dates; delivered and the average over the period.
  const deliveredNow = orders.filter(o => o.status === 'delivered' && o.shipping.deliveredAt && curIndex.has(keyOf(o.shipping.deliveredAt)));
  const shipping = {
    awaiting: orders.filter(o => o.status === 'confirmed' || o.status === 'preparing').length,
    inTransit: orders.filter(o => o.status === 'shipped').length,
    delivered: deliveredNow.length,
    avgDays: mean(deliveredNow.map(o => daysBetween(o.createdAt, o.shipping.deliveredAt!))),
    late: orders.filter(o => o.status === 'shipped' && o.shipping.carrier !== 'pickup' && o.shipping.shippedAt && now.getTime() - Date.parse(o.shipping.shippedAt) > 5 * DAY).length,
  };

  // Money: what came in for this period's orders (a deposit kept on a cancelled order counts; a refund does not), and
  // what is still owed on any accepted order.
  const due = live.reduce((a, o) => a + o.total + o.shipping.fee, 0);
  const collected = inCur.reduce((a, o) => a + (o.payment.status === 'refunded' ? 0 : o.payment.paid), 0);
  const owed = orders.map(o => ({ o, b: owedOn(o) })).filter(x => x.b > 0);
  const overdue = owed.filter(x => SHIPPED.includes(x.o.status));
  const payments = {
    collected: r3(collected), due: r3(due), outstanding: r3(owed.reduce((a, x) => a + x.b, 0)),
    overdue: { count: overdue.length, amount: r3(overdue.reduce((a, x) => a + x.b, 0)) },
    paidPct: due ? Math.min(100, Math.round((live.reduce((a, o) => a + o.payment.paid, 0) / due) * 100)) : 0,
  };

  // Customers: new records, and how many of this period's buyers had bought before.
  const freshNow = customers.filter(c => curIndex.has(keyOf(c.createdAt))).length;
  const freshPrev = customers.filter(c => prevIndex.has(keyOf(c.createdAt))).length;
  const who = (o: Order) => o.customerId ?? 'p:' + o.phone;
  const firstOrderAt = new Map<string, string>();
  for (const o of orders) if (isLive(o)) { const k = who(o); const f = firstOrderAt.get(k); if (!f || o.createdAt < f) firstOrderAt.set(k, o.createdAt); }
  const buyers = new Map<string, boolean>();
  for (const o of live) {
    const k = who(o);
    buyers.set(k, buyers.get(k) || firstOrderAt.get(k)! < o.createdAt);
  }
  const returning = [...buyers.values()].filter(Boolean).length;

  const open = Object.fromEntries((['new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'] as OrderStatus[])
    .map(s => [s, orders.filter(o => o.status === s).length])) as Record<OrderStatus, number>;

  // Event dates in the next eight weeks, by week.
  const today = Date.parse(dayKey(now, tz) + 'T00:00:00Z');
  const events = Array.from({ length: 8 }, (_, i) => {
    const from = today + i * 7 * DAY;
    const label = i === 0 ? 'این هفته' : i === 1 ? 'هفتهٔ بعد' : new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(from);
    return { label, from, ready: 0, pending: 0 };
  });
  for (const o of orders) {
    if (!o.eventDate || o.status === 'cancelled' || o.status === 'delivered') continue;
    const t = Date.parse(o.eventDate + 'T00:00:00Z');
    const i = Math.floor((t - today) / (7 * DAY));
    if (i < 0 || i >= events.length) continue;
    if (o.status === 'shipped') events[i].ready++; else events[i].pending++;
  }

  return {
    period, revenue, orders: deltaOf(live.length, livePrev.length), pieces,
    pending: { count: inCur.filter(o => o.status === 'new').length, amount: r3(inCur.filter(o => o.status === 'new').reduce((a, o) => a + o.total, 0)) },
    avgOrder: deltaOf(avg(live), avg(livePrev)), goal, series, funnel,
    cancelled: inCur.filter(o => o.status === 'cancelled').length, staleNew, byCollection, top, sizes, cities, shipping, payments,
    customers: { total: customers.length, fresh: deltaOf(freshNow, freshPrev), returningPct: buyers.size ? Math.round((returning / buyers.size) * 100) : null, buyers: buyers.size },
    open,
    events: events.map(({ label, ready, pending }) => ({ label, ready, pending })),
    soldOut: garments.filter(g => g.visible).map(g => ({ id: g.id, name: g.name.fa || g.name.en, sizes: g.sizes.filter(s => !s.ok).map(s => s.n) })).filter(x => x.sizes.length),
  };
}
