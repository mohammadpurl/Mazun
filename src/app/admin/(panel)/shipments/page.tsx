import { ordersOnce, garmentsOnce, adminSettingsOnce } from '@/lib/admin-data';
import { picsOf } from '@/components/admin/orders/picks';
import { ShipmentsPage } from '@/components/admin/shipments/ShipmentsPage';

export const metadata = { title: 'ارسال‌ها' };

export default async function Shipments({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [orders, garments, settings, { tab }] = await Promise.all([ordersOnce(), garmentsOnce(), adminSettingsOnce(), searchParams]);
  const pics = picsOf(garments);
  const relevant = orders.filter(o => ['confirmed', 'preparing', 'shipped', 'delivered'].includes(o.status));
  return <ShipmentsPage initial={relevant} pics={pics} cur={settings.currency} initialTab={tab === 'transit' || tab === 'delivered' ? tab : 'ready'} />;
}
