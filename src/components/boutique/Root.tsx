'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useBoutique } from './Boutique';

/** The .btq root: carries lang/dir for the current language and a "touch" class on devices without hover. */
export function Root({ children }: { children: ReactNode }) {
  const { lang, dir } = useBoutique();
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(hover: none)');
    const on = () => setTouch(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return <div className={`btq${touch ? ' touch' : ''}`} lang={lang} dir={dir}>{children}</div>;
}
