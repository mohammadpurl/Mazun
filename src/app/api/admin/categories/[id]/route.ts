import { NextResponse } from 'next/server';
import { bad, guardAdminApi, jsonBody, notFound } from '@/lib/auth';
import { db } from '@/lib/db';
import { validateCategory } from '@/lib/validate';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const denied = await guardAdminApi(req);
  if (denied) return denied;
  const r = validateCategory(await jsonBody(req));
  if (!r.ok) return bad(r.errors);
  const c = await db().updateCategory((await params).id, r.value);
  return c ? NextResponse.json(c) : notFound();
}

export async function DELETE(req: Request, { params }: Ctx) {
  const denied = await guardAdminApi(req);
  if (denied) return denied;
  await db().deleteCategory((await params).id);
  return NextResponse.json({ ok: true });
}
