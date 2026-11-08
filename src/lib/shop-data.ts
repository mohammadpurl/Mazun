import { cache } from 'react';
import { publicCatalog } from './catalog';
import { db } from './db';

/** One settings read per request, shared by the shop layout, its metadata and the pages under it. */
export const settingsOnce = cache(() => db().getSettings());

/** One catalogue read per request (categories and garments), shared the same way. */
export const catalogueOnce = cache(async () => {
  const repo = db();
  const [categories, garments] = await Promise.all([repo.listCategories(), repo.listGarments()]);
  return publicCatalog(categories, garments);
});
