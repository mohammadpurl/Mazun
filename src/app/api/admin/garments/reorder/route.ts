import { NextResponse } from 'next/server';
import { bad, guardAdminApi, jsonBody } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PUT(req: Request) {
  const denied = await guardAdminApi(req);
  if (denied) return denied;
  const ids = (await jsonBody(req)) as unknown;
  if (!Array.isArray(ids) || !ids.every(x => typeof x === 'string') || ids.length > 1000) return bad({ ids: 'فهرست نامعتبر است' });
  await db().reorderGarments(ids);
  return NextResponse.json({ ok: true });
}
