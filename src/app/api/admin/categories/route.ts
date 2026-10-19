import { NextResponse } from 'next/server';
import { bad, guardAdminApi, jsonBody } from '@/lib/auth';
import { db } from '@/lib/db';
import { validateCategory } from '@/lib/validate';

export async function POST(req: Request) {
  const denied = await guardAdminApi(req);
  if (denied) return denied;
  const r = validateCategory(await jsonBody(req));
  if (!r.ok) return bad(r.errors);
  return NextResponse.json(await db().createCategory(r.value), { status: 201 });
}
