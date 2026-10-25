import { isOnSale } from './orders';
import type { Category, Garment } from './types';

/** What the public shop may show: visible products outside hidden collections, and the visible
 *  collections that still have a garment in them. Accessories come back too; the rack filters them out. */
export function publicCatalog(categories: Category[], garments: Garment[]) {
  const hidden = new Set(categories.filter(c => !c.visible).map(c => c.id));
  const shown = garments.filter(g => isOnSale(g, hidden));
  const used = new Set(shown.filter(g => g.kind === 'garment').map(g => g.categoryId));
  return { categories: categories.filter(c => c.visible && used.has(c.id)), garments: shown };
}
