/* Pure shop logic: size charts, size suggestion and the arrival planner.
   Shared by the shop UI and the tests, so it must not touch the DOM or the network. */
import { DEFAULT_CHART } from './defaults';
import type { Garment, SizeChart } from './types';

/** The garment's own chart, falling back per size to the default chart. */
export function chartOf(g: Pick<Garment, 'sizes' | 'chart'>): SizeChart {
  const out: SizeChart = {};
  for (const s of g.sizes) {
    const row = g.chart?.[s.n] ?? DEFAULT_CHART[s.n as keyof typeof DEFAULT_CHART];
    if (row) out[s.n] = { ...row };
  }
  return out;
}

export interface SizeAdvice {
  /** Size that fits best by height and weight. */
  size: string;
  /** Closest size in stock; equals size when that one is available, null when nothing is. */
  pick: string | null;
  soldOut: boolean;
  /** How the garment length compares to the customer's height, when the chart has a length. */
  length: 'long' | 'short' | 'ok' | null;
}

/** Rough size from BMI, then the nearest in-stock size. Abayas are loose, so this is a guide only. */
export function suggestSize(g: Pick<Garment, 'sizes' | 'chart'>, heightCm: number, weightKg: number): SizeAdvice | null {
  if (!g.sizes.length || !(heightCm > 0) || !(weightKg > 0)) return null;
  const bmi = weightKg / (heightCm / 100) ** 2;
  const f = Math.max(0, Math.min(1, (bmi - 18) / 12));
  const idx = Math.round(f * (g.sizes.length - 1));
  let pick = -1, best = Infinity;
  g.sizes.forEach((s, i) => { if (s.ok && Math.abs(i - idx) < best) { best = Math.abs(i - idx); pick = i; } });
  const pickName = pick >= 0 ? g.sizes[pick].n : null;
  const row = pickName ? chartOf(g)[pickName] : undefined;
  let length: SizeAdvice['length'] = null;
  if (row?.length) {
    const diff = row.length - heightCm * 0.85;
    length = diff > 6 ? 'long' : diff < -6 ? 'short' : 'ok';
  }
  return { size: g.sizes[idx].n, pick: pickName, soldOut: pick !== idx, length };
}

export interface Arrival {
  /** Arrival date if ordered today. */
  earliest: Date;
  /** Last day to order and still arrive with the safety buffer. */
  latest: Date;
  verdict: 'good' | 'tight' | 'late';
}

const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** Dates are calendar days in UTC; the UI formats them in the visitor's locale. */
export function planArrival(eventDate: Date, today: Date, days: { prep: number; lead: number; ship: number; buffer: number }): Arrival {
  const ev = startOfDay(eventDate), now = startOfDay(today);
  const total = days.prep + days.lead + days.ship;
  const earliest = addDays(now, total);
  const latest = addDays(ev, -(total + days.buffer));
  const verdict = earliest > ev ? 'late' : latest >= now ? 'good' : 'tight';
  return { earliest, latest, verdict };
}

/** The price a customer pays: the sale price when one is set and lower. */
export const effectivePrice = (g: Pick<Garment, 'price' | 'salePrice'>) =>
  g.salePrice != null && g.salePrice < g.price ? g.salePrice : g.price;
