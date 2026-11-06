import { createDecartClient } from '@decartai/sdk';
import { NextResponse } from 'next/server';
import { FAL_APP, LIVE_SECONDS, LIVE_TOKENS_PER_DAY, LIVE_TOKENS_PER_HOUR } from '@/lib/live-tryon';
import { allow, clientIp } from '@/lib/rate-limit';

/* Mints a short-lived client token for the live AI try-on (Decart Lucy VTON, through fal.ai when FAL_KEY (or FAL_API_KEY) is set,
   or Decart directly with DECART_API_KEY). The permanent key never leaves the server. Only our own pages may ask
   (SITE_ORIGIN in production), each visitor gets a few sessions an hour and the whole site a daily ceiling, and the
   token works for the try-on model only — every second of live generation is billed. The visitor and daily counters
   live in this server's memory, so they reset on a restart and each instance counts on its own. */

/** The origins allowed to ask: SITE_ORIGIN (comma-separated) when set, otherwise this request's own host. */
function allowedOrigin(req: Request): string | null {
  const origin = req.headers.get('origin');
  if (!origin) return null;
  const fixed = process.env.SITE_ORIGIN?.split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
  if (fixed?.length) return fixed.includes(origin) ? origin : null;
  const host = req.headers.get('host');
  try { return host && new URL(origin).host === host ? origin : null; } catch { return null; }
}

/** fal's own token endpoint (what @fal-ai/client's getTemporaryAuthToken calls): one app, two minutes. */
async function falToken(key: string): Promise<string> {
  const r = await fetch('https://rest.fal.ai/tokens/', {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ allowed_apps: [FAL_APP.split('/')[1]], token_expiration: 120 }),
  });
  if (!r.ok) throw new Error(`fal ${r.status}`);
  const t: unknown = await r.json();
  const token = typeof t === 'string' ? t : (t as { detail?: unknown })?.detail;
  if (typeof token !== 'string') throw new Error('fal token');
  return token;
}

export async function POST(req: Request) {
  const fal = process.env.FAL_KEY || process.env.FAL_API_KEY, decart = process.env.DECART_API_KEY;
  if (!fal && !decart) return NextResponse.json({ error: 'off' }, { status: 503 });
  const origin = allowedOrigin(req);
  if (!origin) return NextResponse.json({ error: 'origin' }, { status: 403 });
  if (!allow('live:' + clientIp(req), LIVE_TOKENS_PER_HOUR, 60 * 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
  if (!allow('live:site', LIVE_TOKENS_PER_DAY, 24 * 60 * 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
  try {
    if (fal) return NextResponse.json({ provider: 'fal', token: await falToken(fal), expiresAt: new Date(Date.now() + 120_000).toISOString() });
    const client = createDecartClient({ apiKey: decart!, telemetry: false });
    const t = await client.tokens.create({
      expiresIn: 60,
      allowedModels: ['lucy-vton-latest'],
      allowedOrigins: [origin],
      // A little headroom over the visible countdown, so the server never cuts the last seconds short.
      constraints: { realtime: { maxSessionDuration: LIVE_SECONDS + 15 } },
    });
    return NextResponse.json({ provider: 'decart', token: t.apiKey, expiresAt: t.expiresAt });
  } catch {
    return NextResponse.json({ error: 'token' }, { status: 502 });
  }
}
