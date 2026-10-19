import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { jsonBody } from '@/lib/auth';
import { allow, clientIp } from '@/lib/rate-limit';

/* Optional AI for the shop: size advice and styling (Claude), virtual try-on (Gemini image model).
   Without ANTHROPIC_API_KEY / GEMINI_API_KEY the shop never calls this and shows its built-in answers.
   Each call costs money, so it is rate limited per visitor and only accepts this site's own images. */

const LANG: Record<string, string> = { fa: 'Persian (Farsi)', ar: 'Arabic', en: 'English' };
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gemini-2.5-flash-image';
const MAX_IMAGE_CHARS = 2_500_000;

let client: Anthropic | undefined;
const anthropic = () => (client ??= new Anthropic());

/** One short answer from Claude. Short, simple tasks, so low effort; refusals fall back server-side. */
async function claude(system: string, content: Anthropic.Beta.BetaContentBlockParam[], maxTokens = 2000): Promise<string> {
  const r = await anthropic().beta.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system,
    messages: [{ role: 'user', content }],
  });
  if (r.stop_reason === 'refusal') throw new Error('refused');
  return r.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim();
}

function splitDataUrl(u: unknown) {
  const m = typeof u === 'string' ? /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(u) : null;
  if (!m) throw new Error('bad image');
  return { mime: m[1] as 'image/jpeg' | 'image/png' | 'image/webp', data: m[2] };
}

/** Garment images must be this site's own (or its Supabase bucket), never an arbitrary URL the server would fetch. */
function ownImageUrl(req: Request, u: unknown): string | null {
  if (typeof u !== 'string') return null;
  try {
    const url = new URL(u, req.url);
    const self = new URL(req.url);
    const supa = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).host : null;
    return url.host === self.host || (supa && url.host === supa) ? url.href : null;
  } catch { return null; }
}

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const b = (await jsonBody(req)) as Record<string, unknown> | undefined;
  if (!b || typeof b.action !== 'string') return fail(400, 'bad request');
  const tryon = b.action === 'tryon';
  if (tryon ? !process.env.GEMINI_API_KEY : !process.env.ANTHROPIC_API_KEY) return fail(503, 'ai disabled');
  if (!allow('ai:' + clientIp(req), tryon ? 5 : 20, 60 * 60_000)) return fail(429, 'rate');
  for (const k of ['photo', 'person']) if (typeof b[k] === 'string' && (b[k] as string).length > MAX_IMAGE_CHARS) return fail(413, 'image too large');
  const lang = LANG[String(b.lang)] ?? 'English';

  try {
    if (b.action === 'size') {
      const content: Anthropic.Beta.BetaContentBlockParam[] = [];
      if (b.photo) { const p = splitDataUrl(b.photo); content.push({ type: 'image', source: { type: 'base64', media_type: p.mime, data: p.data } }); }
      content.push({
        type: 'text',
        text: `Customer height ${Number(b.height)} cm, weight ${Number(b.weight)} kg${b.photo ? ' (a photo is attached)' : ''}.
Garment size chart (cm): ${JSON.stringify(b.chart).slice(0, 2000)}. Stock: ${JSON.stringify(b.sizes).slice(0, 500)}.
Pick the best size that is in stock (ok=true). Abayas are worn loose, so prefer comfort. Check the garment length against the customer's height.
Reply ONLY with JSON: {"size":"<size name>","reason":"<2 short sentences in ${lang}>"}`,
      });
      const t = await claude('You are a precise, friendly fitting assistant for an abaya shop.', content);
      const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
      return NextResponse.json({ size: String(j.size), reason: String(j.reason ?? '') });
    }

    if (b.action === 'style') {
      const content: Anthropic.Beta.BetaContentBlockParam[] = [];
      const img = ownImageUrl(req, b.image);
      if (img && img.startsWith('https://')) content.push({ type: 'image', source: { type: 'url', url: img } });
      content.push({ type: 'text', text: `Garment: ${String(b.garment).slice(0, 120)}. Occasion: ${String(b.occasion).slice(0, 40)}.
Give 4 short, concrete styling tips (scarf, shoes, bag, accessories, colours) in ${lang}. Modest, elegant, plain text with one tip per line, no markdown.` });
      return NextResponse.json({ text: await claude('You are a modest-fashion stylist.', content) });
    }

    if (b.action === 'arrive') {
      const d = (k: string) => String(b[k]).slice(0, 10);
      const text = await claude('You are a delivery planner for an abaya shop. Be brief and reassuring.', [{ type: 'text', text:
        `Event date ${d('event')}, today ${d('today')}. Earliest arrival if ordered today: ${d('earliest')}. Latest safe order date: ${d('latest')}.
Write 2 short sentences in ${lang} advising the customer when to order. Do not change any of the dates.` }]);
      return NextResponse.json({ text });
    }

    if (tryon) {
      const person = splitDataUrl(b.person);
      const garmentUrl = ownImageUrl(req, b.garment);
      if (!garmentUrl) return fail(400, 'bad garment');
      const g = await fetch(garmentUrl);
      if (!g.ok) throw new Error('garment fetch');
      const garment = Buffer.from(await g.arrayBuffer()).toString('base64');
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY!, 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [
          { text: "Virtual try-on. Image 1 is the customer, image 2 is an abaya. Dress the customer in the abaya from image 2, keeping her face, pose, body shape and the background unchanged and the garment's design, colour and embroidery exact. Photorealistic." },
          { inline_data: { mime_type: person.mime, data: person.data } },
          { inline_data: { mime_type: g.headers.get('content-type') ?? 'image/png', data: garment } },
        ] }] }),
      });
      if (!r.ok) throw new Error('image ' + r.status);
      const data = await r.json();
      const part = data.candidates?.[0]?.content?.parts?.find((p: { inlineData?: unknown }) => p.inlineData) as { inlineData: { mimeType: string; data: string } } | undefined;
      if (!part) throw new Error('no image returned');
      return NextResponse.json({ image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` });
    }

    return fail(400, 'unknown action');
  } catch (e) {
    console.error('ai', b.action, e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    return fail(500, 'failed');
  }
}
