import { NextResponse } from 'next/server';
import { bad, guardAdminApi, jsonBody } from '@/lib/auth';
import { db } from '@/lib/db';
import { validateSettings } from '@/lib/validate';

export async function PUT(req: Request) {
  const denied = await guardAdminApi(req);
  if (denied) return denied;
  const r = validateSettings(await jsonBody(req));
  if (!r.ok) return bad(r.errors);
  return NextResponse.json(await db().saveSettings(r.value));
}
