/* Dashboard numbers, computed from the order list. Pure so it can be tested.
   Days are calendar days in the shop's time zone (Oman), not UTC, so "today" matches the shop's day. */
import { OPEN_STATUSES } from './labels';
import type { Garment, Order } from './types';

export const SHOP_TZ = 'Asia/Muscat';

/** YYYY-MM-DD of an instant in the given time zone. */
export const dayKey = (d: Date, tz = SHOP_TZ) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

export interface DashboardStats {
  ordersToday: number;
  openOrders: number;
  newOrders: number;
  revenueMonth: number;
  ordersMonth: number;
  /** Oldest first, `days` entries ending today. */
  perDay: { day: string; count: number }[];
  topGarments: { name: string; count: number }[];
  soldOut: { garment: string; sizes: string[] }[];
}

export function dashboardStats(orders: Order[], garments: Garment[], now = new Date(), days = 14, tz = SHOP_TZ): DashboardStats {
  const today = dayKey(now, tz);
  const month = today.slice(0, 7);
  const live = orders.filter(o => o.status !== 'cancelled');

  const perDay: DashboardStats['perDay'] = [];
  for (let i = days - 1; i >= 0; i--) perDay.push({ day: dayKey(new Date(now.getTime() - i * 86_400_000), tz), count: 0 });
  const index = new Map(perDay.map((d, i) => [d.day, i]));

  let ordersToday = 0, revenueMonth = 0, ordersMonth = 0;
  const counts = new Map<string, number>();
  for (const o of live) {
    const k = dayKey(new Date(o.createdAt), tz);
    if (k === today) ordersToday++;
    if (k.startsWith(month)) { revenueMonth += o.price; ordersMonth++; }
    const i = index.get(k);
    if (i !== undefined) perDay[i].count++;
    counts.set(o.garmentName, (counts.get(o.garmentName) ?? 0) + 1);
  }

  return {
    ordersToday,
    openOrders: orders.filter(o => OPEN_STATUSES.includes(o.status)).length,
    newOrders: orders.filter(o => o.status === 'new').length,
    revenueMonth: Math.round(revenueMonth * 1000) / 1000,
    ordersMonth,
    perDay,
    topGarments: [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5),
    soldOut: garments
      .filter(g => g.visible)
      .map(g => ({ garment: g.name.fa || g.name.en, sizes: g.sizes.filter(s => !s.ok).map(s => s.n) }))
      .filter(x => x.sizes.length),
  };
}
