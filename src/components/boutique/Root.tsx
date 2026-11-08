'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Footer, Header } from '../shop/Chrome';
import { ShopProvider } from '../shop/Shop';
import type { ThemeKey } from '../shop/tokens';
import { useBoutique } from './Boutique';

/** Pages not yet rebuilt from the design handoff; they still render inside the earlier .btq look. Everything else,
 *  the 404 at any address included, uses the new design. */
const LEGACY = (path: string) => path === '/stylist';

/** The shop shell: the new header and footer on every page, the page itself, and the sheets (bag, sizes, product)
 *  which keep their .btq styles. `touch` marks devices without hover for the earlier pages. */
export function Root({ children, overlays, theme }: { children: ReactNode; overlays: ReactNode; theme: ThemeKey }) {
  const { lang, dir } = useBoutique();
  const path = usePathname();
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(hover: none)');
    const on = () => setTouch(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  const cls = `btq${touch ? ' touch' : ''}`;
  return (
    <ShopProvider initialTheme={theme}>
      <Header />
      {LEGACY(path) ? <div className={cls} lang={lang} dir={dir}>{children}</div> : children}
      <Footer />
      <div className={`${cls} btq-overlays`} lang={lang} dir={dir}>{overlays}</div>
    </ShopProvider>
  );
}
