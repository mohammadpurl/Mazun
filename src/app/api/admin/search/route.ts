import { NextResponse } from 'next/server';
import { guardAdminApi } from '@/lib/auth';
import { db } from '@/lib/db';
import { simplify } from '@/lib/places';

/** Search for the command palette: orders by number, name or phone; customers by name or phone; products by name. */
export async function GET(req: Request) {
  const denied = await guardAdminApi(req);
  if (denied) return denied;
  const raw = (new URL(req.url).searchParams.get('q') ?? '').slice(0, 60);
  const q = simplify(raw.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
  if (!q) return NextResponse.json({ orders: [], customers: [], products: [] });
  const digits = q.replace(/\D/g, '');
  const repo = db();
  const [orders, customers, garments] = await Promise.all([repo.listOrders(), repo.listCustomers().catch(() => []), repo.listGarments()]);
  const has = (s: string) => simplify(s).includes(q);
  return NextResponse.json({
    orders: orders.filter(o => String(o.id).startsWith(digits || '#') || has(o.customerName) || (digits.length >= 4 && o.phone.includes(digits)))
      .slice(0, 6).map(o => ({ id: o.id, name: o.customerName, status: o.status, total: o.total, createdAt: o.createdAt })),
    customers: customers.filter(c => has(c.name) || (digits.length >= 4 && c.phone.includes(digits)) || has(c.email))
      .slice(0, 6).map(c => ({ id: c.id, name: c.name, phone: c.phone })),
    products: garments.filter(g => has(g.name.fa) || has(g.name.en) || has(g.name.ar) || has(g.type.fa))
      .slice(0, 6).map(g => ({ id: g.id, name: g.name.fa || g.name.en, image: g.wornFront || g.front, kind: g.kind })),
  });
}
