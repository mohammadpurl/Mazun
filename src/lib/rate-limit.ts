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

/** Best-effort client address from proxy headers. */
export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
}
