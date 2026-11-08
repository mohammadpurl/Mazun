/* Fixed-window rate limiter kept in memory. Per server instance only: it slows down a single
   abuser on one instance but is not a global limit on serverless hosts. */
const buckets = new Map<string, { start: number; count: number }>();

export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const b = buckets.get(key);
  if (!b || now - b.start >= windowMs) {
    buckets.set(key, { start: now, count: 1 });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (now - v.start >= windowMs) buckets.delete(k);
    return true;
  }
  b.count++;
  return b.count <= limit;
}

/** The client's address as the host's proxy recorded it, not as the client claims it. A client can send any
 *  x-forwarded-for it likes, and proxies append the address they saw to the end, so the last entry is the trustworthy
 *  one and the first is not. Vercel's own header comes first when present; x-real-ip is the last resort, since a
 *  proxy that does not set it passes a client's value through. */
export function clientIp(req: Request): string {
  const h = req.headers;
  const last = (v: string | null) => v?.split(',').map(x => x.trim()).filter(Boolean).pop();
  return h.get('x-vercel-forwarded-for')?.split(',')[0].trim() || last(h.get('x-forwarded-for')) || h.get('x-real-ip')?.trim() || 'local';
}
