/* Pure shop logic: size guide, the size assistant's recommendation, prices.
   Shared by the shop UI and the tests, so it must not touch the DOM or the network. */
import { DEFAULT_CHART, SIZE_ORDER } from './defaults';
import type { Garment, SizeChart } from './types';

/** The garment's own chart, falling back per size to the default guide. */
export function chartOf(g: Pick<Garment, 'sizes' | 'chart'>): SizeChart {
  const out: SizeChart = {};
  for (const s of g.sizes) {
    const row = g.chart?.[s.n] ?? DEFAULT_CHART[s.n];
    if (row) out[s.n] = { ...row };
  }
  return out;
}

export type FitPref = 'fitted' | 'regular' | 'relaxed';
export interface SizeInputs {
  height: number;
  usual: string;
  fit: FitPref;
  /** Optional bust measurement in cm; 0 when not given. */
  bust: number;
  len: 'ankle' | 'floor';
}
export interface SizeRecommendation {
  size: string;
  /** cm of room at the bust, when a bust measurement was given. */
  ease: number | null;
  /** How the hem falls for this height. */
  height: 'tall' | 'short' | 'ok';
}

const idx = (s: string) => (SIZE_ORDER as readonly string[]).indexOf(s);

/** The design's size assistant: usual size and fit preference, or the bust measurement when given,
 *  then the nearest size in stock. Guidance only; never derived from a photo. */
export function recommendSize(inp: SizeInputs, g: Pick<Garment, 'sizes' | 'chart' | 'shape'>): SizeRecommendation | null {
  const available = g.sizes.filter(s => s.ok && idx(s.n) >= 0).map(s => s.n).sort((a, b) => idx(a) - idx(b));
  if (!available.length) return null;
  const chart = chartOf(g);
  const bustOf = (s: string) => chart[s]?.bust ?? DEFAULT_CHART[s]?.bust ?? 0;
  let i = Math.max(0, idx(inp.usual));
  if (inp.bust > 0) {
    const allow = { fitted: 2, regular: 6, relaxed: 12 }[inp.fit];
    i = SIZE_ORDER.findIndex(k => (DEFAULT_CHART[k]?.bust ?? 0) >= inp.bust + allow - 6);
    if (i < 0) i = SIZE_ORDER.length - 1;
  } else {
    if (inp.fit === 'relaxed') i += 1;
    if (inp.fit === 'fitted' && (g.shape === 'abaya' || g.shape === 'kaftan')) i -= 1;
  }
  i = Math.max(0, Math.min(SIZE_ORDER.length - 1, i));
  let size: string = SIZE_ORDER[i];
  if (!available.includes(size)) {
    const last = available[available.length - 1];
    size = idx(size) > idx(last) ? last : available.find(s => idx(s) >= i) ?? available[0];
  }
  const h = inp.height > 0 ? inp.height : 165;
  return {
    size,
    ease: inp.bust > 0 ? Math.round(bustOf(size) + 8 - inp.bust) : null,
    height: h >= 172 ? 'tall' : h < 158 ? 'short' : 'ok',
  };
}

/** The price a customer pays: the sale price when one is set and lower. */
export const effectivePrice = (g: Pick<Garment, 'price' | 'salePrice'>) =>
  g.salePrice != null && g.salePrice < g.price ? g.salePrice : g.price;
