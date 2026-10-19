import { NextResponse } from 'next/server';
import { bad, guardAdminApi, jsonBody } from '@/lib/auth';
import { db } from '@/lib/db';
import { validateGarment } from '@/lib/validate';

export async function POST(req: Request) {
  const denied = await guardAdminApi(req);
  if (denied) return denied;
  const r = validateGarment(await jsonBody(req));
  if (!r.ok) return bad(r.errors);
  return NextResponse.json(await db().createGarment(r.value), { status: 201 });
}
