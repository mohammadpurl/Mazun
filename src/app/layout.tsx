import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { requestLang } from '@/lib/lang';
import { FontLinks } from './fonts';

export const metadata: Metadata = { title: 'Mazun Atelier' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#F6EFE7' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const lang = await requestLang();
  return (
    <html lang={lang} dir={lang === 'en' ? 'ltr' : 'rtl'}>
      <head>
        <FontLinks />
      </head>
      <body>{children}</body>
    </html>
  );
}
