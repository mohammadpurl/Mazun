import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { requestLang } from '@/lib/lang';

export const metadata: Metadata = { title: 'Mazun Atelier' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#F7F4EF' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const lang = await requestLang();
  return (
    <html lang={lang} dir={lang === 'en' ? 'ltr' : 'rtl'}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300..700;1,8..60,300..500&family=Noto+Naskh+Arabic:wght@400..700&family=Vazirmatn:wght@300;400;600&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
