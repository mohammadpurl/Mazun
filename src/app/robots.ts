import type { MetadataRoute } from 'next';

/** The shop is open to crawlers; the admin panel and the API are not. Served at /robots.txt without touching the DB. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api'] } };
}
