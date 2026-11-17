import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/share';

/** The shop is open to crawlers; the admin panel and the API are not. Served at /robots.txt without touching the DB;
 *  it points crawlers at the sitemap. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  return { rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api'] }, sitemap: `${await siteOrigin()}/sitemap.xml` };
}
