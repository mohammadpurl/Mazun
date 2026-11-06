import './(shop)/boutique.css';
import './(shop)/shop.css';
import './(shop)/sheets.css';
import type { Metadata } from 'next';
import { notFoundTitle } from '@/components/shop/copy';
import { NotFound } from '@/components/shop/NotFound';
import { requestLang } from '@/lib/lang';
import { settingsOnce } from '@/lib/shop-data';
import ShopLayout from './(shop)/layout';
import { FontLinks } from './fonts';

export { viewport } from './layout';

/* Addresses that match no route (the admin and the API have their own). A global 404 is its own document and runs
   only when nothing matches, unlike a root not-found, which Next renders ahead of every page. It wears the shop's
   layout and is rendered on the server, so it arrives with its words, language and direction before any script. */

export async function generateMetadata(): Promise<Metadata> {
  const [lang, s] = await Promise.all([requestLang(), settingsOnce()]);
  return { title: `${notFoundTitle(lang, 'page')} · ${s.brand[lang] || s.brand.en}` };
}

export default async function GlobalNotFound() {
  const lang = await requestLang();
  return (
    <html lang={lang} dir={lang === 'en' ? 'ltr' : 'rtl'}>
      <head>
        <FontLinks />
      </head>
      <body>
        <ShopLayout><NotFound what="page" /></ShopLayout>
      </body>
    </html>
  );
}
