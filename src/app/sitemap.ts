import type { MetadataRoute } from 'next';
import { piecePath, siteOrigin } from '@/lib/share';
import { catalogueOnce } from '@/lib/shop-data';

// Read per request: the catalogue changes from the admin, and the address may come from the request.
export const dynamic = 'force-dynamic';

/** The shop's pages for search engines at /sitemap.xml: home, collection, fitting room and every abaya on sale.
 *  The language follows the visitor (cookie or browser), so each page has one address. Admin and API stay out. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [origin, { garments }] = await Promise.all([siteOrigin(), catalogueOnce()]);
  const page = (path: string, priority: number): MetadataRoute.Sitemap[number] => ({ url: `${origin}${path}`, changeFrequency: 'weekly', priority });
  return [
    page('/', 1),
    page('/collection', 0.8),
    page('/fitting-room', 0.8),
    ...garments.filter(g => g.kind === 'garment').map(g => page(piecePath(g.id), 0.7)),
  ];
}
