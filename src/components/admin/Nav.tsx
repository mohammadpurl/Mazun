'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'داشبورد' },
  { href: '/admin/orders', label: 'سفارش‌ها' },
  { href: '/admin/garments', label: 'محصولات' },
  { href: '/admin/categories', label: 'مجموعه‌ها' },
  { href: '/admin/settings', label: 'تنظیمات سایت' },
];

async function logout() {
  await fetch('/api/admin/logout', { method: 'POST' }).catch(() => undefined);
  location.href = '/admin/login';
}

export function Nav({ brand, live, newOrders }: { brand: string; live: boolean; newOrders: number }) {
  const path = usePathname();
  const active = (href: string) => (href === '/admin' ? path === href : path.startsWith(href));
  const label = (l: (typeof LINKS)[number]) =>
    l.href === '/admin/orders' && newOrders > 0 ? <>{l.label} <span className="st st-new">{newOrders.toLocaleString('fa-IR')}</span></> : l.label;
  return (
    <>
      <aside className="side">
        <div className="logo">{brand}<div className="small" style={{ fontWeight: 300, opacity: .7 }}>پنل مدیریت</div></div>
        {LINKS.map(l => <Link key={l.href} href={l.href} aria-current={active(l.href) ? 'page' : undefined}>{label(l)}</Link>)}
        <div className="grow" />
        <span className={`badge${live ? ' live' : ''}`} title={live ? '' : 'داده‌ها در فایل data/store.json روی همین سرور ذخیره می‌شوند'}>
          {live ? 'متصل به Supabase' : 'حالت محلی (توسعه)'}
        </span>
        <Link href="/" target="_blank">دیدن سایت ↗</Link>
        <button type="button" onClick={logout}>خروج</button>
      </aside>
      <nav className="mobile-nav" aria-label="منو">
        {LINKS.map(l => <Link key={l.href} href={l.href} aria-current={active(l.href) ? 'page' : undefined}>{label(l)}</Link>)}
        <Link href="/" target="_blank">سایت ↗</Link>
        <button type="button" onClick={logout}>خروج</button>
      </nav>
    </>
  );
}
