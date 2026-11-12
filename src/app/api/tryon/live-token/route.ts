import { NextResponse } from 'next/server';
import { LIVE_TOKENS_PER_DAY, LIVE_TOKENS_PER_HOUR } from '@/lib/live-tryon';
import { liveProviders, mintLiveToken, type LiveProvider } from '@/lib/live-token';
import { allow, clientIp } from '@/lib/rate-limit';

/* Mints a short-lived client token for the live AI try-on: Decart's Lucy VTON directly with DECART_API_KEY, or through
   fal.ai with FAL_KEY (or FAL_API_KEY) as the fallback (src/lib/live-token.ts). The permanent key never leaves the
   server. Only our own pages may ask (SITE_ORIGIN in production), each visitor gets a few sessions an hour and the
   whole site a daily ceiling, and the token works for the try-on model only — every second of live generation is
   billed. The visitor and daily counters live in this server's memory, so they reset on a restart and each instance
   counts on its own: the spending limit set in the providers' own dashboards is the real ceiling.
   ?provider=decart|fal keeps a running session's reconnects on the provider it started with. */

/** The origins allowed to ask: SITE_ORIGIN (comma-separated) when set, otherwise this request's own host. */
function allowedOrigin(req: Request): string | null {
  const origin = req.headers.get('origin');
  if (!origin) return null;
  const fixed = process.env.SITE_ORIGIN?.split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
  if (fixed?.length) return fixed.includes(origin) ? origin : null;
  const host = req.headers.get('host');
  try { return host && new URL(origin).host === host ? origin : null; } catch { return null; }
}

export async function POST(req: Request) {
  const keys = liveProviders();
  if (!keys.decart && !keys.fal) return NextResponse.json({ error: 'off' }, { status: 503 });
  const origin = allowedOrigin(req);
  if (!origin) return NextResponse.json({ error: 'origin' }, { status: 403 });
  // After the origin check, so another site cannot learn which keys are set.
  const asked = new URL(req.url).searchParams.get('provider');
  const want: LiveProvider | undefined = asked === 'decart' || asked === 'fal' ? asked : undefined;
  if (asked !== null && (!want || !keys[want])) return NextResponse.json({ error: 'provider' }, { status: 400 });
  if (!allow('live:' + clientIp(req), LIVE_TOKENS_PER_HOUR, 60 * 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
  if (!allow('live:site', LIVE_TOKENS_PER_DAY, 24 * 60 * 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
  try {
    return NextResponse.json(await mintLiveToken(origin, want));
  } catch {
    return NextResponse.json({ error: 'token' }, { status: 502 });
  }
}
