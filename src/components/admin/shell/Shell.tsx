'use client';
/* The panel's frame: a floating dark sidebar (collapsible on desktop, a drawer on phones and tablets), a floating
   header with the command palette (Ctrl/⌘ K or "/"), quick add, theme, notifications and the account menu. */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { UiProvider } from '../ui/Dialog';
import { Menu } from '../ui/Dropdown';
import { AIcon } from '../ui/Icon';
import { MotionRoot } from '../ui/motion';
import { mayLeave } from '../ui/useLeaveGuard';
import { CommandPalette } from './CommandPalette';
import { NAV, type NavCounts } from './nav';
import { Notifications, type Notice } from './Notifications';


async function logout() {
  await fetch('/api/admin/logout', { method: 'POST' }).catch(() => undefined);
  location.href = '/admin/login';
}

function Sidebar({ brand, live, counts, onNavigate }: { brand: string; live: boolean; counts: NavCounts; onNavigate?: () => void }) {
  const path = usePathname();
  const active = (href: string) => (href === '/admin' ? path === href : path.startsWith(href));
  return (
    <aside className="side" aria-label="منوی پنل">
      <Link href="/admin" className="brand" onClick={onNavigate} aria-label={`${brand} — داشبورد`}>
        <span className="brand-mark" aria-hidden="true">M</span>
        <span className="brand-name"><b>MAZUN</b><span>ATELIER</span></span>
      </Link>
      <nav className="nav">
        {NAV.map(g => (
          <div key={g.label} className="nav-group">
            <span className="nav-label">{g.label}</span>
            {g.items.map(it => {
              const n = it.count ? counts[it.count] : 0;
              return (
                <Link key={it.href} href={it.href} aria-current={active(it.href) ? 'page' : undefined} onClick={onNavigate} title={it.label}>
                  <AIcon name={it.icon} duo />
                  <span>{it.label}</span>
                  {n > 0 && <span className="count num" aria-label={`${n.toLocaleString('fa-IR')} مورد`}>{n.toLocaleString('fa-IR')}</span>}
                  {n > 0 && <i className="dot" aria-hidden="true" />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="side-foot">
        <span className={`store-mode${live ? ' is-live' : ''}`} title={live ? 'داده‌ها در Supabase' : 'داده‌ها در data/store.json روی همین سرور'}>
          <i aria-hidden="true" /><span>{live ? 'متصل به Supabase' : 'حالت محلی (توسعه)'}</span>
        </span>
        <div className="user-card">
          <span className="av me sm" aria-hidden="true">م</span>
          <span className="who"><b>مدیر مزون</b><span>دسترسی کامل</span></span>
          <button type="button" onClick={logout} aria-label="خروج از پنل" title="خروج"><AIcon name="logout" /></button>
        </div>
      </div>
    </aside>
  );
}

export function Shell({ brand, live, counts, notices, currency, children }: { brand: string; live: boolean; counts: NavCounts; notices: Notice[]; currency: string; children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [dark, setDark] = useState(false);
  const [mac, setMac] = useState(false);
  useEffect(() => { setDark(document.documentElement.dataset.admTheme === 'dark'); setMac(/Mac|iPhone|iPad/.test(navigator.platform)); }, []);
  useEffect(() => { setDrawer(false); }, [path]);

  const toggleTheme = () => {
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.admTheme = next;
    try { localStorage.setItem('adm-theme', next); } catch { /* private mode */ }
    setDark(!dark);
  };
  const menu = () => {
    if (window.matchMedia('(max-width: 1023px)').matches) { setDrawer(true); return; }
    const html = document.documentElement;
    const on = html.dataset.admCollapsed !== '1';
    if (on) html.dataset.admCollapsed = '1'; else delete html.dataset.admCollapsed;
    try { localStorage.setItem('adm-collapsed', on ? '1' : '0'); } catch { /* private mode */ }
  };
  const onKey = useCallback((e: KeyboardEvent) => {
    const typing = /^(INPUT|TEXTAREA)$/.test((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable;
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setPalette(p => !p); }
    else if (e.key === '/' && !typing) { e.preventDefault(); setPalette(true); }
  }, []);
  useEffect(() => { window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [onKey]);

  return (
    <MotionRoot>
      <UiProvider>
        <div className="shell">
          <Sidebar brand={brand} live={live} counts={counts} />
          <div className="main">
            <header className="topbar">
              <button type="button" className="icon-btn" aria-label="منو" onClick={menu}><AIcon name="menu" /></button>
              <button type="button" className="search-trigger" onClick={() => setPalette(true)} aria-keyshortcuts="Control+K Meta+K">
                <AIcon name="search" /><span>جستجوی سفارش، مشتری، محصول…</span><kbd>{mac ? '⌘K' : 'Ctrl K'}</kbd>
              </button>
              <span className="spacer" />
              <Menu label="افزودن سریع" buttonClass="btn sm hide-md" items={[
                { label: 'سفارش جدید', icon: 'orders', href: '/admin/orders/new' },
                { label: 'محصول جدید', icon: 'products', href: '/admin/garments/new' },
                { label: 'مشتری جدید', icon: 'userPlus', href: '/admin/customers?new=1' },
                { label: 'مجموعهٔ جدید', icon: 'collections', href: '/admin/categories?new=1' },
              ]}>
                <AIcon name="plus" /><span>افزودن</span>
              </Menu>
              <button type="button" className="icon-btn mobile-only" aria-label="جستجو" onClick={() => setPalette(true)}><AIcon name="search" /></button>
              <button type="button" className="icon-btn" aria-label={dark ? 'حالت روشن' : 'حالت تیره'} onClick={toggleTheme}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={dark ? 's' : 'm'} style={{ display: 'grid' }} initial={{ rotate: -90, opacity: 0, scale: 0.6 }} animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    exit={{ rotate: 90, opacity: 0, scale: 0.6 }} transition={{ duration: 0.25 }}>
                    <AIcon name={dark ? 'sun' : 'moon'} duo />
                  </motion.span>
                </AnimatePresence>
              </button>
              <Notifications notices={notices} />
              <a className="icon-btn hide-md" href="/" target="_blank" rel="noreferrer" aria-label="دیدن فروشگاه (پنجرهٔ جدید)" title="دیدن فروشگاه"><AIcon name="store" duo /></a>
              <Menu label="حساب کاربری" buttonClass="avatar-btn" items={[
                { label: 'تنظیمات سایت', icon: 'settings', href: '/admin/settings' },
                { label: 'دیدن فروشگاه', icon: 'external', href: '/', external: true },
                { divider: true, label: '' },
                { label: 'خروج', icon: 'logout', onSelect: logout, danger: true },
              ]}>
                <span className="av me" aria-hidden="true">م</span>
                <span className="who"><b>مدیر مزون</b><span>مدیر</span></span>
              </Menu>
            </header>
            <main className="page" id="main">{children}</main>
          </div>
        </div>

        <AnimatePresence>
          {drawer && (
            <>
              <motion.div key="scrim" className="scrim" onClick={() => setDrawer(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
              <motion.div key="drawer" className="drawer" role="dialog" aria-modal="true" aria-label="منو"
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 330, damping: 34 }}
                onKeyDown={e => {
                  if (e.key === 'Escape') { setDrawer(false); return; }
                  if (e.key !== 'Tab') return;
                  // Focus stays inside the open menu.
                  const els = [...e.currentTarget.querySelectorAll<HTMLElement>('a[href],button:not([disabled])')];
                  const i = els.indexOf(document.activeElement as HTMLElement);
                  if (e.shiftKey && i <= 0) { e.preventDefault(); els.at(-1)?.focus(); }
                  else if (!e.shiftKey && i === els.length - 1) { e.preventDefault(); els[0]?.focus(); }
                }}>
                <button type="button" className="icon-btn close" aria-label="بستن منو" onClick={() => setDrawer(false)} autoFocus><AIcon name="close" /></button>
                <Sidebar brand={brand} live={live} counts={counts} onNavigate={() => setDrawer(false)} />
              </motion.div>
            </>
          )}
        </AnimatePresence>
        <CommandPalette open={palette} currency={currency} onClose={() => setPalette(false)} onGo={async href => { setPalette(false); if (await mayLeave()) router.push(href); }} />
      </UiProvider>
    </MotionRoot>
  );
}
