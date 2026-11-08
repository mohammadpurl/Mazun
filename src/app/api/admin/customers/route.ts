import { NextResponse } from 'next/server';
import { bad, failed, guardAdminApi, jsonBody } from '@/lib/auth';
import { ConflictError, db } from '@/lib/db';
import { validateCustomer } from '@/lib/validate';

export async function GET(req: Request) {
  const denied = await guardAdminApi(req);
  if (denied) return denied;
  try { return NextResponse.json(await db().listCustomers()); } catch (e) { return failed(e); }
}

export async function POST(req: Request) {
  const denied = await guardAdminApi(req);
  if (denied) return denied;
  const r = validateCustomer(await jsonBody(req));
  if (!r.ok) return bad(r.errors);
  try { return NextResponse.json(await db().createCustomer(r.value), { status: 201 }); }
  catch (e) { return e instanceof ConflictError ? NextResponse.json({ errors: { [e.field]: e.message } }, { status: 409 }) : failed(e); }
}
