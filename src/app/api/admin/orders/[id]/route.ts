import { NextResponse } from 'next/server';
import { bad, guardAdminApi, jsonBody, notFound } from '@/lib/auth';
import { db } from '@/lib/db';
import { validateOrderPatch } from '@/lib/validate';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await guardAdminApi(req);
  if (denied) return denied;
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id)) return notFound();
  const r = validateOrderPatch(await jsonBody(req));
  if (!r.ok) return bad(r.errors);
  const o = await db().updateOrder(id, r.value);
  return o ? NextResponse.json(o) : notFound();
}
