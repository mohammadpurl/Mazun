import { NextResponse } from 'next/server';
import { jsonBody } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildOrder } from '@/lib/orders';
import { allow, clientIp } from '@/lib/rate-limit';
import { validateOrder } from '@/lib/validate';

/** Public: checkout from the bag. Saves the order, then the shop opens its chat with the order number. */
export async function POST(req: Request) {
  const body = await jsonBody(req);
  // Honeypot: the form has a hidden "website" field that people never fill in.
  if (body && typeof body === 'object' && (body as Record<string, unknown>).website) return NextResponse.json({ error: 'rejected' }, { status: 400 });
  if (!allow('order:' + clientIp(req), 6, 10 * 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });

  const r = validateOrder(body);
  if (!r.ok) return NextResponse.json({ errors: r.errors }, { status: 400 });

  const repo = db();
  const [garments, categories] = await Promise.all([repo.listGarments(), repo.listCategories()]);
  const built = buildOrder(r.value, garments, categories);
  if (!built.ok) return NextResponse.json({ errors: { items: built.error }, garmentId: built.garmentId }, { status: 409 });

  const order = await repo.createOrder(built.order);
  return NextResponse.json({ id: order.id, items: order.items, total: order.total }, { status: 201 });
}
