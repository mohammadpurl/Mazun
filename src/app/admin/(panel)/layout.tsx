import type { ReactNode } from 'react';
import { Shell } from '@/components/admin/shell/Shell';
import type { Notice } from '@/components/admin/shell/Notifications';
import { adminSettingsOnce, garmentsOnce, ordersOnce } from '@/lib/admin-data';
import { requireAdminPage } from '@/lib/auth';
import { db } from '@/lib/db';
import { daysNeeded, eventAtRisk, owedOn } from '@/lib/orders';
import { dayKey } from '@/lib/stats';

export const dynamic = 'force-dynamic';

const DAY = 86_400_000;

export default async function PanelLayout({ children }: { children: ReactNode }) {
  await requireAdminPage();
  const [settings, orders, garments] = await Promise.all([adminSettingsOnce(), ordersOnce(), garmentsOnce()]);
  const now = Date.now();
  const cur = settings.currency.fa || 'ریال';
  const fa = (n: number) => n.toLocaleString('fa-IR', { maximumFractionDigits: 3 });
  const leadDays = Object.fromEntries(garments.map(g => [g.id, g.leadDays]));
  const fresh = orders.filter(o => o.status === 'new');
  const stale = fresh.filter(o => now - Date.parse(o.createdAt) > DAY);
  const risky = orders.filter(o => eventAtRisk(o, daysNeeded(o, settings, leadDays), dayKey(new Date())));
  const overdue = orders.filter(o => (o.status === 'delivered' || o.status === 'shipped') && owedOn(o) > 0);
  const late = orders.filter(o => o.status === 'shipped' && o.shipping.carrier !== 'pickup' && o.shipping.shippedAt && now - Date.parse(o.shipping.shippedAt) > 5 * DAY);
  const soldOut = garments.filter(g => g.visible && g.sizes.some(s => !s.ok));
  const notices: Notice[] = [
    ...(risky.length ? [{ id: 'risk', icon: 'calendar' as const, tone: 'danger' as const, title: `${fa(risky.length)} سفارش با مراسم نزدیک هنوز ارسال نشده`, body: 'زودتر از زمان لازم برای دوخت و ارسال', href: '/admin/orders?risk=1' }] : []),
    ...fresh.slice(0, 3).map(o => ({ id: 'n' + o.id, icon: 'sparkle' as const, tone: 'primary' as const, title: `سفارش تازه از ${o.customerName}`,
      body: `#${o.id.toLocaleString('fa-IR', { useGrouping: false })} · ${fa(o.total)} ${cur}`, href: `/admin/orders/${o.id}`, at: o.createdAt })),
    ...(stale.length ? [{ id: 'stale', icon: 'hourglass' as const, tone: 'warn' as const, title: `${fa(stale.length)} سفارش بیش از یک روز بی‌پاسخ مانده`, body: 'برای تأیید یا تماس با مشتری', href: '/admin/orders?status=new' }] : []),
    ...(late.length ? [{ id: 'late', icon: 'shipments' as const, tone: 'info' as const, title: `${fa(late.length)} مرسوله بیش از ۵ روز در راه است`, body: 'وضعیت تحویل را پیگیری کنید', href: '/admin/shipments?tab=transit' }] : []),
    ...(overdue.length ? [{ id: 'owed', icon: 'wallet' as const, tone: 'danger' as const, title: `${fa(overdue.length)} سفارش ارسال‌شده هنوز تسویه نشده`, body: `${fa(Math.round(overdue.reduce((a, o) => a + owedOn(o), 0)))} ${cur} مانده`, href: '/admin/orders?pay=overdue' }] : []),
    ...(soldOut.length ? [{ id: 'sold', icon: 'warning' as const, tone: 'warn' as const, title: `سایز تمام‌شده در ${fa(soldOut.length)} محصول`, body: soldOut.slice(0, 3).map(g => g.name.fa || g.name.en).join('، '), href: '/admin/garments?stock=out' }] : []),
  ];
  return (
    <Shell brand={settings.brand.fa || settings.brand.en} live={db().kind === 'supabase'} notices={notices} currency={cur}
      counts={{ newOrders: fresh.length, toShip: orders.filter(o => o.status === 'confirmed' || o.status === 'preparing').length }}>
      {children}
    </Shell>
  );
}
