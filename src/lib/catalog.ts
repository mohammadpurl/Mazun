import type { Category, Garment } from './types';

/** What the public shop may show: visible garments whose category (if any) is visible too,
 *  and only visible categories that still have something in them. */
export function publicCatalog(categories: Category[], garments: Garment[]) {
  const hidden = new Set(categories.filter(c => !c.visible).map(c => c.id));
  const shown = garments.filter(g => g.visible && !(g.categoryId && hidden.has(g.categoryId)));
  const used = new Set(shown.map(g => g.categoryId));
  return { categories: categories.filter(c => c.visible && used.has(c.id)), garments: shown };
}
