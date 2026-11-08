import { effectivePrice } from '@/lib/fit';
import type { Garment } from '@/lib/types';
import type { ProductPick } from './OrderForm';
import type { Pics } from './bits';

/** Picture and colour of every product, for drawing order lines. */
export const picsOf = (garments: Garment[]): Pics =>
  Object.fromEntries(garments.map(g => [g.id, { img: g.wornFront || g.front || g.images[0] || '', color: g.colors[0]?.hex ?? '#D6C7B1' }]));

/** What the order form needs about each product (all of them, hidden ones included). */
export const productPicks = (garments: Garment[]): ProductPick[] => garments.map(g => ({
  id: g.id, name: g.name.fa || g.name.en, names: g.name, img: g.wornFront || g.front || g.images[0] || '', color: g.colors[0]?.hex ?? '#D6C7B1',
  price: effectivePrice(g), visible: g.visible, sizes: g.sizes, colors: g.colors.map(c => c.name),
}));
