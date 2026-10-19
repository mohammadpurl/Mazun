import { promises as fs } from 'node:fs';
import path from 'node:path';
import { sniffImage } from '@/lib/image';

/* Serves images uploaded in local mode (data/uploads). With Supabase, images live in Supabase Storage
   and this route is never linked to. Files added after `next build` are not served from public/, hence this route. */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  if (!parts.every(p => /^[\w.-]+$/.test(p) && p !== '..')) return new Response('not found', { status: 404 });
  try {
    const bytes = new Uint8Array(await fs.readFile(path.join(process.cwd(), 'data', 'uploads', ...parts)));
    const kind = sniffImage(bytes);
    if (!kind) return new Response('not found', { status: 404 });
    return new Response(bytes, { headers: { 'Content-Type': kind.mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    return new Response('not found', { status: 404 });
  }
}
