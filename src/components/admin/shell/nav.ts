import type { AIconName } from '../ui/Icon';

export interface NavCounts { newOrders: number; toShip: number }
export const NAV: { label: string; items: { href: string; label: string; icon: AIconName; count?: keyof NavCounts }[] }[] = [
  { label: 'نمای کلی', items: [
    { href: '/admin', label: 'داشبورد', icon: 'dashboard' },
    { href: '/admin/orders', label: 'سفارش‌ها', icon: 'orders', count: 'newOrders' },
    { href: '/admin/shipments', label: 'ارسال‌ها', icon: 'shipments', count: 'toShip' },
    { href: '/admin/customers', label: 'مشتریان', icon: 'customers' },
  ] },
  { label: 'کاتالوگ', items: [
    { href: '/admin/garments', label: 'محصولات', icon: 'products' },
    { href: '/admin/categories', label: 'مجموعه‌ها', icon: 'collections' },
  ] },
  { label: 'تنظیمات', items: [{ href: '/admin/settings', label: 'تنظیمات سایت', icon: 'settings' }] },
];
export const NAV_PAGES = NAV.flatMap(g => g.items);
