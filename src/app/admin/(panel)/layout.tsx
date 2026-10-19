import type { ReactNode } from 'react';
import { Nav } from '@/components/admin/Nav';
import { requireAdminPage } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }: { children: ReactNode }) {
  await requireAdminPage();
  const [settings, orders] = await Promise.all([db().getSettings(), db().listOrders()]);
  const newOrders = orders.filter(o => o.status === 'new').length;
  return (
    <div className="layout">
      <Nav brand={settings.brand.fa || settings.brand.en} live={db().kind === 'supabase'} newOrders={newOrders} />
      <div className="content">{children}</div>
    </div>
  );
}
