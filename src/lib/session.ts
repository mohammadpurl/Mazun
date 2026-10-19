/* Signed admin session cookie. Uses Web Crypto only, so it runs in both the middleware (edge)
   and the Node route handlers. Token format: "<expiry ms>.<base64url HMAC-SHA256 of expiry>". */

export const SESSION_COOKIE = 'mezon_admin';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};

const secret = () => process.env.SESSION_SECRET ?? '';

/** Refuses a weak secret wherever it comes from, so a missing env var can never sign sessions with "". */
function key(s: string) {
  if (s.length < 32) throw new Error('SESSION_SECRET must be set to at least 32 characters');
  return crypto.subtle.importKey('raw', enc.encode(s), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createSessionToken(now = Date.now(), s = secret()): Promise<string> {
  const exp = String(now + SESSION_TTL_MS);
  const sig = await crypto.subtle.sign('HMAC', await key(s), enc.encode(exp));
  return `${exp}.${b64url(sig)}`;
}

/** True when the token was signed with this secret and has not expired. Never throws. */
export async function verifySessionToken(token: string | undefined, now = Date.now(), s?: string): Promise<boolean> {
  try {
    if (!token) return false;
    const [exp, sig] = token.split('.');
    if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < now) return false;
    return await crypto.subtle.verify('HMAC', await key(s ?? secret()), fromB64url(sig), enc.encode(exp));
  } catch {
    return false;
  }
}

/** Constant-time password check: compares SHA-256 digests so length differences do not leak. */
export async function passwordMatches(given: string, expected = process.env.ADMIN_PASSWORD ?? ''): Promise<boolean> {
  if (!expected) return false;
  const [a, b] = await Promise.all([given, expected].map(v => crypto.subtle.digest('SHA-256', enc.encode(v))));
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
