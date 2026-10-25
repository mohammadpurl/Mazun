import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { jsonBody } from '@/lib/auth';
import { publicCatalog } from '@/lib/catalog';
import { db } from '@/lib/db';
import { effectivePrice } from '@/lib/fit';
import { allow, clientIp } from '@/lib/rate-limit';
import { accessoriesByRole, OCCASION_COUNT, sanitizePicks, type Picks } from '@/lib/stylist';
import { ACCESSORY_KINDS, type Garment, type Lang } from '@/lib/types';

/* AI for the boutique: the stylist (Claude) and the virtual try-on (Gemini image model).
   Without ANTHROPIC_API_KEY / GEMINI_API_KEY the shop never calls this and uses its built-in behaviour.
   Every call costs money, so it is rate limited per visitor. The server looks products up itself:
   the browser sends ids, never prices, descriptions or image URLs. */

const LANG: Record<Lang, string> = { en: 'English', ar: 'Arabic (Gulf-friendly Modern Standard Arabic)', fa: 'Persian (Farsi)' };
const OCCASIONS = ['daytime', 'evening', 'Eid gathering', 'wedding guest', 'office'];
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gemini-2.5-flash-image';
const MAX_IMAGE_CHARS = 3_000_000;

let client: Anthropic | undefined;
const anthropic = () => (client ??= new Anthropic());
const fail = (status: number, error: string) => NextResponse.json({ error }, { status });
const isLang = (v: unknown): v is Lang => v === 'en' || v === 'ar' || v === 'fa';

/** One short JSON answer from Claude. Simple task, so low effort; refusals fall back server-side. */
async function claudeJson(system: string, user: string): Promise<Record<string, unknown>> {
  const r = await anthropic().beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system,
    messages: [{ role: 'user', content: user }],
  });
  if (r.stop_reason === 'refusal') throw new Error('refused');
  const text = r.content.map(b => (b.type === 'text' ? b.text : '')).join('');
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}

const describe = (g: Garment) => `${g.name.en || g.name.ar || g.name.fa} — ${g.type.en || g.type.ar || g.type.fa}; colours: ${g.colors.map(c => c.name.en).join(', ')}; price ${effectivePrice(g)} OMR`;

async function stylist(b: Record<string, unknown>) {
  const lang: Lang = isLang(b.lang) ? b.lang : 'en';
  const repo = db();
  const { garments } = publicCatalog(await repo.listCategories(), await repo.listGarments());
  const base = garments.find(g => g.id === b.garmentId && g.kind === 'garment');
  if (!base) return fail(400, 'unknown garment');
  const byRole = accessoriesByRole(garments);
  const current = sanitizePicks(b.picks, byRole, {});
  const occasion = Number.isInteger(b.occasion) ? Math.abs(Number(b.occasion)) % OCCASION_COUNT : 0;
  const history = (Array.isArray(b.history) ? b.history : []).slice(-6)
    .map(m => (m && typeof m === 'object' ? m as Record<string, unknown> : {}))
    .map(m => `${m.me ? 'Customer' : 'Stylist'}: ${String(m.text ?? '').slice(0, 400)}`).join('\n');
  const message = String(b.message ?? '').slice(0, 400);
  const catalogue = ACCESSORY_KINDS.map(k => `${k}:\n${byRole[k].map(a => `  - id "${a.id}": ${describe(a)}`).join('\n') || '  (none)'}`).join('\n');

  const out = await claudeJson(
    `You are the in-house stylist of an Omani boutique of abayas and modest evening wear. You build complete, modest, elegant looks
from the boutique's own accessories only. Never invent products. Keep replies to two or three short sentences, warm and specific,
no markdown, no emoji. Write the reply and summary in ${LANG[lang]}.`,
    `Base garment: ${describe(base)}. Occasion: ${OCCASIONS[occasion]}.
Current picks: ${JSON.stringify(current)}.
Accessories available (choose at most one per role, by id; use null when nothing fits):
${catalogue}

Conversation so far:
${history || '(none)'}
Customer: ${message}

Reply ONLY with JSON: {"reply":"<your answer>","summary":"<one sentence describing the look>","picks":{"scarf":"<id|null>","bag":"<id|null>","jewel":"<id|null>","shoes":"<id|null>"}}`,
  );
  return NextResponse.json({
    reply: String(out.reply ?? '').slice(0, 800),
    summary: String(out.summary ?? '').slice(0, 300),
    picks: sanitizePicks(out.picks, byRole, current) satisfies Picks,
  });
}

/** Reads one of the shop's own product images: site paths via this server, Supabase Storage by URL. */
async function ownImage(req: Request, src: string): Promise<{ mime: string; data: string } | null> {
  if (!src) return null;
  const url = new URL(src, req.url);
  const supa = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).host : null;
  if (url.host !== new URL(req.url).host && url.host !== supa) return null;
  const r = await fetch(url);
  if (!r.ok) return null;
  return { mime: r.headers.get('content-type') ?? 'image/png', data: Buffer.from(await r.arrayBuffer()).toString('base64') };
}

async function tryon(req: Request, b: Record<string, unknown>) {
  const m = typeof b.person === 'string' ? /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(b.person) : null;
  if (!m) return fail(400, 'bad image');
  const repo = db();
  const { garments } = publicCatalog(await repo.listCategories(), await repo.listGarments());
  const g = garments.find(x => x.id === b.garmentId && x.kind === 'garment');
  if (!g) return fail(400, 'unknown garment');
  const colour = g.colors[Number(b.color) || 0] ?? g.colors[0];
  const garmentImg = await ownImage(req, g.front);
  const desc = `${g.type.en || g.name.en} in ${colour?.name.en ?? 'its colour'} (${colour?.hex ?? ''}), a ${g.shape} silhouette, floor length, modest and loose-fitting`;
  const parts: unknown[] = [
    { text: garmentImg
      ? `Virtual try-on. Image 1 is the customer, image 2 is the garment: ${desc}. Dress the customer in this garment, keeping her face, hair, pose, body proportions and the background unchanged, and the garment's design, colour and fabric exact. Photorealistic, natural light. Return one image.`
      : `Virtual try-on. The image is the customer. Dress her in: ${desc}. Keep her face, hair, pose, body proportions and the background unchanged. Photorealistic, natural light. Return one image.` },
    { inline_data: { mime_type: m[1], data: m[2] } },
  ];
  if (garmentImg) parts.push({ inline_data: { mime_type: garmentImg.mime, data: garmentImg.data } });
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY!, 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] }),
  });
  if (!r.ok) throw new Error('image ' + r.status);
  const data = await r.json();
  const part = data.candidates?.[0]?.content?.parts?.find((p: { inlineData?: unknown }) => p.inlineData) as { inlineData: { mimeType: string; data: string } } | undefined;
  if (!part) return fail(422, 'no image');
  return NextResponse.json({ image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` });
}

export async function POST(req: Request) {
  const b = (await jsonBody(req)) as Record<string, unknown> | undefined;
  if (!b || typeof b.action !== 'string') return fail(400, 'bad request');
  const isTry = b.action === 'tryon';
  if (isTry ? !process.env.GEMINI_API_KEY : !process.env.ANTHROPIC_API_KEY) return fail(503, 'ai disabled');
  if (!allow('ai:' + b.action + ':' + clientIp(req), isTry ? 6 : 30, 60 * 60_000)) return fail(429, 'rate');
  if (typeof b.person === 'string' && b.person.length > MAX_IMAGE_CHARS) return fail(413, 'image too large');
  try {
    if (b.action === 'stylist') return await stylist(b);
    if (isTry) return await tryon(req, b);
    return fail(400, 'unknown action');
  } catch (e) {
    console.error('ai', b.action, e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    return fail(502, 'failed');
  }
}
