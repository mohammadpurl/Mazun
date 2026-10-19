import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from './session';

export async function isAdmin(): Promise<boolean> {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** For admin pages: sends a signed-out visitor to the login page. */
export async function requireAdminPage(): Promise<void> {
  if (!(await isAdmin())) redirect('/admin/login');
}

/** For admin API routes: returns an error response to send back, or null when the call may proceed.
 *  Mutations must come from this site (Origin check) on top of the SameSite=strict cookie. */
export async function guardAdminApi(req: Request): Promise<NextResponse | null> {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (req.method !== 'GET' && !sameOrigin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return null;
}

export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // same-origin fetches from older browsers may omit it; the strict cookie still applies
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try { return new URL(origin).host === host; } catch { return false; }
}

/** Reads a JSON body, returning undefined (not throwing) on malformed input. */
export async function jsonBody(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { return undefined; }
}

export const bad = (errors: Record<string, string>) => NextResponse.json({ errors }, { status: 400 });
export const notFound = () => NextResponse.json({ error: 'not found' }, { status: 404 });
