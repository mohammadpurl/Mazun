'use client';
/* Asks before leaving a form with unsaved changes: closing or reloading the tab (the browser's own prompt),
   clicking a link inside the panel, and navigation started from code such as the search palette (`mayLeave`). */
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useUi } from './Dialog';

let ask: (() => Promise<boolean>) | null = null;
/** Before navigating from code: true when there is nothing unsaved, or the admin chose to leave anyway. */
export const mayLeave = () => (ask ? ask() : Promise.resolve(true));

export function useLeaveGuard(dirty: boolean) {
  const router = useRouter();
  const { confirm } = useUi();
  useEffect(() => {
    if (!dirty) return;
    const mine = () => confirm({ title: 'تغییرات ذخیره نشده‌اند', body: 'اگر از این صفحه بروید، تغییرهایی که ذخیره نکرده‌اید از دست می‌روند.', confirm: 'رفتن بدون ذخیره', danger: true });
    ask = mine;
    const unload = (e: BeforeUnloadEvent) => e.preventDefault();
    const click = async (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;
      e.preventDefault();
      e.stopPropagation();
      // A menu the link was in closes first (menus close on a press outside them).
      document.dispatchEvent(new PointerEvent('pointerdown'));
      if (await mine()) {
        router.push(url.pathname + url.search + url.hash);
      }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', click, true);
    return () => { if (ask === mine) ask = null; window.removeEventListener('beforeunload', unload); document.removeEventListener('click', click, true); };
  }, [dirty, confirm, router]);
}
