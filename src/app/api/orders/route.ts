import { NextResponse } from 'next/server';
import { jsonBody } from '@/lib/auth';
import { db } from '@/lib/db';
import { effectivePrice } from '@/lib/fit';
import { allow, clientIp } from '@/lib/rate-limit';
import { validateOrder } from '@/lib/validate';

/** Public: the shop places an order here, then opens the shop's chat with the order number. */
export async function POST(req: Request) {
  const body = await jsonBody(req);
  // Honeypot: the form has a hidden "website" field that people never fill in.
  if (body && typeof body === 'object' && (body as Record<string, unknown>).website) return NextResponse.json({ error: 'rejected' }, { status: 400 });
  if (!allow('order:' + clientIp(req), 6, 10 * 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });

  const r = validateOrder(body);
  if (!r.ok) return NextResponse.json({ errors: r.errors }, { status: 400 });
  const input = r.value;

  const repo = db();
  const g = input.garmentId ? await repo.getGarment(input.garmentId) : null;
  if (!g || !g.visible) return NextResponse.json({ errors: { garmentId: 'unavailable' } }, { status: 409 });
  if (g.categoryId) {
    const cat = (await repo.listCategories()).find(c => c.id === g.categoryId);
    if (cat && !cat.visible) return NextResponse.json({ errors: { garmentId: 'unavailable' } }, { status: 409 });
  }
  if (!g.sizes.some(s => s.n === input.size && s.ok)) return NextResponse.json({ errors: { size: 'soldout' } }, { status: 409 });

  const order = await repo.createOrder({
    ...input,
    garmentName: g.name[input.lang] || g.name.fa || g.name.en || g.name.ar,
    price: effectivePrice(g),
  });
  return NextResponse.json({ id: order.id, garmentName: order.garmentName, price: order.price }, { status: 201 });
}
