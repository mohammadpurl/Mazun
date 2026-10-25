/* Turns a validated order request into the order that is stored: every line is checked against the
   live catalogue and priced on the server, so the browser can never set a price or order a hidden piece. */
import { effectivePrice } from './fit';
import type { Category, Garment, L10n, Lang, NewOrder, OrderInput, OrderItem } from './types';

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

/** One-line summary of an order's pieces, e.g. "Zayna (M) ×2, Reem (S)". */
export const itemsSummary = (items: OrderItem[]) =>
  items.map(i => `${i.name} (${i.size})${i.qty > 1 ? ` ×${i.qty}` : ''}`).join('، ');
