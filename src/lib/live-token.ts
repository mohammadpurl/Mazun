import { FAL_APP, LIVE_MODEL, LIVE_SECONDS } from './live-tryon';

/* The server side of the live try-on: a short-lived client token from Decart (preferred: the pinned LIVE_MODEL) or fal.ai (the fallback: the older Lucy 2.1). The fallback covers only the token: Decart
   refusing one, timing out or answering oddly. A session that fails after its token was handed out is not moved to
   fal. Each refusal is logged (never the key), and Decart then rests for a while, so a wrong key or an outage does not
   slow every start down. The permanent keys never leave the server. */

export type LiveProvider = 'decart' | 'fal';
type Env = Record<string, string | undefined>;
export interface LiveToken { provider: LiveProvider; token: string; expiresAt: string }

/** A provider that does not answer within this long counts as down. */
const TIMEOUT_MS = 5_000;
let timeoutMs = TIMEOUT_MS;
/** How long Decart rests after a refusal: long for a key or account problem, short for an outage. */
const REST_AUTH_MS = 10 * 60_000, REST_DOWN_MS = 60_000;
let decartRestUntil = 0;
/** For tests: forget a past refusal, and optionally wait less for an answer. */
export function resetLiveTokenState(waitMs = TIMEOUT_MS) { decartRestUntil = 0; timeoutMs = waitMs; }

class Refused extends Error {
  constructor(readonly provider: LiveProvider, readonly status: number | null, why: string) { super(`${provider}: ${why}`); }
}

/** The configured providers, Decart first. */
export function liveProviders(env: Env = process.env): { decart?: string; fal?: string } {
  return { decart: env.DECART_API_KEY || undefined, fal: env.FAL_KEY || env.FAL_API_KEY || undefined };
}

/** Who the camera may go to, for the consent text: Decart, fal.ai, or Decart with fal.ai as its fallback. */
export function liveVia(env: Env = process.env): 'decart' | 'fal' | 'both' | null {
  const k = liveProviders(env);
  return k.decart && k.fal ? 'both' : k.decart ? 'decart' : k.fal ? 'fal' : null;
}

async function decartToken(key: string, origin: string): Promise<LiveToken> {
  const r = await fetch('https://api.decart.ai/v1/client/tokens', {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      expiresIn: 60,
      allowedModels: [LIVE_MODEL],
      allowedOrigins: [origin],
      // A little headroom over the visible countdown, so the server never cuts the last seconds short.
      constraints: { realtime: { maxSessionDuration: LIVE_SECONDS + 15 } },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Refused('decart', r.status, `HTTP ${r.status}`);
  const t = (await r.json().catch(() => null)) as { apiKey?: unknown; expiresAt?: unknown } | null;
  if (typeof t?.apiKey !== 'string' || !t.apiKey) throw new Refused('decart', null, 'unexpected token shape');
  const expiresAt = typeof t.expiresAt === 'string' && Date.parse(t.expiresAt) ? t.expiresAt : new Date(Date.now() + 60_000).toISOString();
  return { provider: 'decart', token: t.apiKey, expiresAt };
}

/** fal's own token endpoint (what @fal-ai/client's getTemporaryAuthToken calls): one app, two minutes. */
async function falToken(key: string): Promise<LiveToken> {
  const r = await fetch('https://rest.fal.ai/tokens/', {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ allowed_apps: [FAL_APP.split('/')[1]], token_expiration: 120 }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Refused('fal', r.status, `HTTP ${r.status}`);
  const t: unknown = await r.json().catch(() => null);
  const token = typeof t === 'string' ? t : (t as { detail?: unknown } | null)?.detail;
  if (typeof token !== 'string' || !token) throw new Refused('fal', null, 'unexpected token shape');
  return { provider: 'fal', token, expiresAt: new Date(Date.now() + 120_000).toISOString() };
}

/** A token for `origin`. `want` keeps a running session on its own provider (a reconnect must not switch it); without
 *  it Decart goes first and fal.ai takes over when Decart does not hand one out. Throws when no provider does. */
export async function mintLiveToken(origin: string, want?: LiveProvider, env: Env = process.env): Promise<LiveToken> {
  const keys = liveProviders(env);
  const order: LiveProvider[] = want ? [want]
    : keys.decart && keys.fal && Date.now() < decartRestUntil ? ['fal']
    : ['decart', 'fal'];
  let last: unknown = new Error('no live try-on provider');
  for (const p of order) {
    const key = keys[p];
    if (!key) continue;
    try {
      return p === 'decart' ? await decartToken(key, origin) : await falToken(key);
    } catch (e) {
      last = e;
      const status = e instanceof Refused ? e.status : null;
      const why = e instanceof Refused ? e.message : e instanceof Error && e.name === 'TimeoutError' ? `${p}: no answer in ${timeoutMs / 1000} s` : `${p}: ${e instanceof Error ? e.message : 'failed'}`;
      console.error(`live-token: ${why}${p === 'decart' && keys.fal && !want ? ' — using fal.ai' : ''}`);
      if (p === 'decart') decartRestUntil = Date.now() + (status === 401 || status === 402 || status === 403 ? REST_AUTH_MS : REST_DOWN_MS);
    }
  }
  throw last;
}
