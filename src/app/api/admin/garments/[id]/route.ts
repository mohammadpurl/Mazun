import { NextResponse } from 'next/server';
import { bad, guardAdminApi, jsonBody, notFound } from '@/lib/auth';
import { db } from '@/lib/db';
import { validateGarment } from '@/lib/validate';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const denied = await guardAdminApi(req);
  if (denied) return denied;
  const r = validateGarment(await jsonBody(req));
  if (!r.ok) return bad(r.errors);
  const g = await db().updateGarment((await params).id, r.value);
  return g ? NextResponse.json(g) : notFound();
}

export async function DELETE(req: Request, { params }: Ctx) {
  const denied = await guardAdminApi(req);
  if (denied) return denied;
  await db().deleteGarment((await params).id);
  return NextResponse.json({ ok: true });
}
