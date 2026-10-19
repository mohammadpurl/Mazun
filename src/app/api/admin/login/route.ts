import { NextResponse } from 'next/server';
import { jsonBody, sameOrigin } from '@/lib/auth';
import { allow, clientIp } from '@/lib/rate-limit';
import { createSessionToken, passwordMatches, SESSION_COOKIE, SESSION_TTL_MS } from '@/lib/session';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!allow('login:' + clientIp(req), 8, 15 * 60_000)) {
    return NextResponse.json({ error: 'تعداد تلاش‌ها زیاد است؛ ۱۵ دقیقه بعد دوباره امتحان کنید' }, { status: 429 });
  }
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'ADMIN_PASSWORD روی سرور تنظیم نشده است' }, { status: 500 });
  }
  const body = (await jsonBody(req)) as { password?: unknown } | undefined;
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!(await passwordMatches(password))) {
    return NextResponse.json({ error: 'رمز عبور اشتباه است' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: SESSION_TTL_MS / 1000,
  });
  return res;
}
