import { NextResponse } from 'next/server';
import { bad, failed, guardAdminApi, jsonBody, notFound } from '@/lib/auth';
import { ConflictError, db } from '@/lib/db';
import { validateCustomer } from '@/lib/validate';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const denied = await guardAdminApi(req);
  if (denied) return denied;
  try {
    const c = await db().getCustomer((await params).id);
    return c ? NextResponse.json(c) : notFound();
  } catch (e) { return failed(e); }
}

export async function PUT(req: Request, { params }: Ctx) {
  const denied = await guardAdminApi(req);
  if (denied) return denied;
  const r = validateCustomer(await jsonBody(req));
  if (!r.ok) return bad(r.errors);
  try {
    const c = await db().updateCustomer((await params).id, r.value);
    return c ? NextResponse.json(c) : notFound();
  } catch (e) {
    return e instanceof ConflictError ? NextResponse.json({ errors: { [e.field]: e.message } }, { status: 409 }) : failed(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const denied = await guardAdminApi(req);
  if (denied) return denied;
  try {
    const id = (await params).id;
    if (!(await db().getCustomer(id))) return notFound();
    await db().deleteCustomer(id);
    return NextResponse.json({ ok: true });
  }
  catch (e) { return failed(e); }
}
