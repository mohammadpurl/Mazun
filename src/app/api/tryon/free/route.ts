import { Client, handle_file } from '@gradio/client';
import { NextResponse } from 'next/server';
import { publicCatalog } from '@/lib/catalog';
import { db } from '@/lib/db';
import { garmentFrame, personFrame, toJpeg } from '@/lib/tryon-frames';
import { allow, clientIp } from '@/lib/rate-limit';

/* The free realistic try-on: the customer's photo and the abaya go to OOTDiffusion, a public model on Hugging Face
   (Space levihsu/OOTDiffusion, "Dress" mode), and a photo of her wearing it comes back, usually in under a minute.
   It is OFF unless FREE_TRYON=on: OOTDiffusion is released for non-commercial use, and the photo goes to a Space run
   by someone else. Free Spaces queue and ration their GPU, so it is a stopgap: capped per visitor and for the whole
   site, two runs at a time, and given up (and cancelled at the Space) after 90 s or when the customer leaves.
   HF_TOKEN raises the Space's allowance; FREE_TRYON_SPACE points at another copy of the Space. */

export const runtime = 'nodejs';
export const maxDuration = 120;

const SPACE = process.env.FREE_TRYON_SPACE || 'levihsu/OOTDiffusion';
const MAX_CHARS = 3_000_000;
let inflight = 0;

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

async function ownImage(req: Request, src: string, signal: AbortSignal): Promise<Buffer | null> {
  if (!src) return null;
  const url = new URL(src, req.url);
  const supa = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).host : null;
  if (url.host !== new URL(req.url).host && url.host !== supa) return null;
  const r = await fetch(url, { signal });
  return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
}

export async function POST(req: Request) {
  if (process.env.FREE_TRYON !== 'on') return fail(503, 'off');
  const origin = req.headers.get('origin'), host = req.headers.get('host');
  try { if (!origin || !host || new URL(origin).host !== host) return fail(403, 'origin'); } catch { return fail(403, 'origin'); }
  const size = Number(req.headers.get('content-length'));
  if (!size || size > MAX_CHARS + 2048) return fail(413, 'too large');
  if (!allow('free:' + clientIp(req), 6, 60 * 60_000) || !allow('free:all', 60, 60 * 60_000)) return fail(429, 'rate');
  if (inflight >= 2) return fail(503, 'busy');
  const b = (await req.json().catch(() => null)) as { person?: unknown; garmentId?: unknown } | null;
  const m = typeof b?.person === 'string' && b.person.length <= MAX_CHARS ? /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(b.person) : null;
  if (!m) return fail(400, 'bad image');
  const repo = db();
  const { garments } = publicCatalog(await repo.listCategories(), await repo.listGarments());
  const g = garments.find(x => x.id === b?.garmentId && x.kind === 'garment');
  if (!g) return fail(400, 'unknown garment');

  // One clock for the whole run: the customer leaving or 90 seconds passing both cancel the job at the Space.
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(new Error('timeout')), 90_000);
  const leave = () => ac.abort(new Error('gone'));
  req.signal.addEventListener('abort', leave);
  inflight++;
  let app: Awaited<ReturnType<typeof Client.connect>> | null = null;
  try {
    const own = await ownImage(req, g.front, AbortSignal.any([ac.signal, AbortSignal.timeout(15_000)]));
    if (!own) return fail(400, 'no garment photo');
    const [person, garment] = await Promise.all([personFrame(Buffer.from(m[1], 'base64')), garmentFrame(own)]);
    app = await Client.connect(SPACE, process.env.HF_TOKEN ? { token: process.env.HF_TOKEN as `hf_${string}` } : {});
    // Model, garment, category, images, steps, guidance, seed — as the Space's /process_dc endpoint lists them.
    const job = app.submit('/process_dc', [
      handle_file(new Blob([new Uint8Array(person)], { type: 'image/jpeg' })),
      handle_file(new Blob([new Uint8Array(garment)], { type: 'image/jpeg' })),
      'Dress', 1, 20, 2, 42,
    ]);
    ac.signal.addEventListener('abort', () => { job.cancel().catch(() => {}); });
    let url: string | undefined;
    for await (const ev of job) {
      if (ac.signal.aborted) break;
      if (ev.type === 'status' && ev.stage === 'error') throw new Error(String(ev.message ?? 'space error'));
      if (ev.type === 'data') {
        const first = (ev.data as unknown[])?.[0];
        const item = Array.isArray(first) ? first[0] : first;
        url = typeof item === 'string' ? item : (item as { image?: { url?: string }; url?: string })?.image?.url ?? (item as { url?: string })?.url;
        break;
      }
    }
    if (ac.signal.aborted) throw ac.signal.reason;
    // Only fetch the picture from the Space itself.
    const root = app.config?.root;
    if (!url || (root && new URL(url).host !== new URL(root).host)) throw new Error('no image');
    const out = await fetch(url, { signal: AbortSignal.any([ac.signal, AbortSignal.timeout(15_000)]) });
    if (!out.ok) throw new Error('download ' + out.status);
    const jpeg = await toJpeg(Buffer.from(await out.arrayBuffer()));
    return NextResponse.json({ image: `data:image/jpeg;base64,${jpeg.toString('base64')}` });
  } catch (e) {
    const msg = (e as Error)?.message ?? '';
    console.error('free try-on:', msg);
    return fail(502, msg === 'timeout' || /quota|gpu|queue|busy|exceeded/i.test(msg) ? 'busy' : 'failed');
  } finally {
    inflight--;
    clearTimeout(timer);
    req.signal.removeEventListener('abort', leave);
    app?.close();
  }
}
