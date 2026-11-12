import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST } from '../src/app/api/tryon/live-token/route';
import { SEED_GARMENTS } from '../src/lib/defaults';
import { liveVia, resetLiveTokenState } from '../src/lib/live-token';
import { LIVE_MODEL, LIVE_SECONDS, livePrompt } from '../src/lib/live-tryon';

test('livePrompt: describes the piece in English, asks to keep the face, and stays under the model limit', () => {
  for (const g of SEED_GARMENTS.filter(x => x.kind === 'garment')) {
    const p = livePrompt(g);
    assert.ok(p.startsWith('Substitute the outfit with the '), g.id);
    assert.ok(p.includes(g.name.en), g.id);
    assert.ok(p.includes('Keep the face, hair and any headscarf unchanged.'), g.id);
    assert.ok(p.length <= 700, `${g.id}: ${p.length}`);
  }
  const long = livePrompt({ name: { en: 'X', ar: '', fa: '' }, type: { en: '', ar: '', fa: '' }, description: { en: 'y'.repeat(2000), ar: '', fa: '' } });
  assert.equal(long.length, 700);
});

const req = (origin: string | null, ip = '10.0.0.1', query = '') => new Request(`http://shop.test/api/tryon/live-token${query}`, {
  method: 'POST',
  headers: { host: 'shop.test', 'x-forwarded-for': ip, ...(origin ? { origin } : {}) },
});


const KEYS = ['DECART_API_KEY', 'FAL_KEY', 'FAL_API_KEY'] as const;
/** Runs `body` with only the given keys set and fetch answered by `answer`; puts everything back afterwards. */
async function withKeys(keys: Partial<Record<(typeof KEYS)[number], string>>, answer: (url: string, init?: RequestInit) => Promise<Response>, body: (asked: { url: string; body: unknown }[]) => Promise<void>) {
  const saved = Object.fromEntries(KEYS.map(k => [k, process.env[k]])), savedFetch = globalThis.fetch, savedError = console.error;
  const asked: { url: string; body: unknown }[] = [];
  for (const k of KEYS) { if (keys[k]) process.env[k] = keys[k]; else delete process.env[k]; }
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    asked.push({ url, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });
    return answer(url, init);
  }) as typeof fetch;
  console.error = () => {};
  resetLiveTokenState(50);
  try { await body(asked); } finally {
    globalThis.fetch = savedFetch; console.error = savedError;
    for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    resetLiveTokenState();
  }
}
const decartOk = () => Promise.resolve(Response.json({ apiKey: 'dct_tmp', expiresAt: new Date(Date.now() + 60_000).toISOString() }));
const falOk = () => Promise.resolve(Response.json('fal_tmp'));
const route = (decart: (init?: RequestInit) => Promise<Response>) => (url: string, init?: RequestInit) =>
  url.startsWith('https://api.decart.ai/') ? decart(init) : url.startsWith('https://rest.fal.ai/') ? falOk() : Promise.reject(new Error(`unexpected ${url}`));
let ip = 0;
const ask = async (query = '') => {
  const r = await POST(req('http://shop.test', `10.0.1.${++ip}`, query));
  const j = (await r.json()) as { provider?: string; token?: string; error?: string };
  return r.ok ? j.provider : r.status;
};

test('live-token: off without a key, and never mints for another site', async () => {
  await withKeys({}, () => Promise.reject(new Error('no network')), async () => {
    assert.equal((await POST(req('http://shop.test'))).status, 503);
  });
  await withKeys({ DECART_API_KEY: 'dct_test' }, route(decartOk), async asked => {
    assert.equal((await POST(req(null))).status, 403, 'no origin');
    const r = await POST(req('https://evil.example'));
    assert.equal(r.status, 403, 'foreign origin');
    assert.equal(JSON.stringify(await r.json()).includes('dct_test'), false, 'the permanent key is never echoed');
    assert.equal(asked.length, 0, 'nothing is asked of Decart for a refused origin');
  });
});

test('live-token: Decart first, with a token for this site, this model and one session', async () => {
  await withKeys({ DECART_API_KEY: 'dct_test', FAL_KEY: 'fal_test' }, route(decartOk), async asked => {
    const r = await POST(req('http://shop.test', '10.0.2.1'));
    const j = await r.json();
    assert.deepEqual([j.provider, j.token], ['decart', 'dct_tmp']);
    assert.equal(asked.length, 1, 'fal.ai is not asked when Decart answers');
    assert.deepEqual(asked[0].body, { expiresIn: 60, allowedModels: [LIVE_MODEL], allowedOrigins: ['http://shop.test'], constraints: { realtime: { maxSessionDuration: LIVE_SECONDS + 15 } } });
  });
});

test('live-token: fal.ai takes over when Decart refuses, answers oddly or not at all, then Decart rests', async () => {
  for (const [why, decart] of [
    ['refuses', () => Promise.resolve(new Response('down', { status: 503 }))],
    ['odd answer', () => Promise.resolve(Response.json({ nope: true }))],
    ['never answers', (init?: RequestInit) => new Promise<Response>((_, rej) => init?.signal?.addEventListener('abort', () => rej(init.signal!.reason)))],
  ] as const) {
    await withKeys({ DECART_API_KEY: 'dct_test', FAL_KEY: 'fal_test' }, route(decart), async asked => {
      assert.equal(await ask(), 'fal', why);
      assert.deepEqual(asked.map(a => new URL(a.url).host), ['api.decart.ai', 'rest.fal.ai'], `${why}: Decart first, then fal.ai`);
      assert.deepEqual((asked[1].body as { allowed_apps: string[] }).allowed_apps, ['lucy2-vton'], 'the fal token works for the try-on app only');
      assert.equal(await ask(), 'fal', `${why}: Decart rests`);
      assert.equal(asked.length, 3, `${why}: Decart is not asked again while it rests`);
    });
  }
});

test('live-token: errors without a fallback, and a session keeps its provider', async () => {
  await withKeys({ DECART_API_KEY: 'dct_test' }, route(() => Promise.resolve(new Response('no', { status: 401 }))), async () => {
    assert.equal(await ask(), 502, 'Decart refuses and there is no fallback');
    assert.equal(await ask('?provider=fal'), 400, 'a provider that is not configured');
  });
  await withKeys({ DECART_API_KEY: 'dct_test', FAL_KEY: 'fal_test' }, route(() => Promise.resolve(new Response('down', { status: 503 }))), async () => {
    assert.equal(await ask('?provider=decart'), 502, 'a Decart session is not handed a fal.ai token');
    assert.equal(await ask('?provider=fal'), 'fal');
    assert.equal(await ask('?provider=other'), 400);
    assert.equal((await POST(req('https://evil.example', '10.0.3.1', '?provider=other'))).status, 403, 'another site learns nothing about the keys');
  });
  await withKeys({ DECART_API_KEY: 'dct_test', FAL_KEY: 'fal_test' }, url => Promise.resolve(new Response('down', { status: url.includes('fal.ai') ? 500 : 503 })), async asked => {
    assert.equal(await ask(), 502, 'both down');
    assert.equal(asked.length, 2);
  });
  await withKeys({ FAL_KEY: 'fal_test' }, route(decartOk), async asked => {
    assert.equal(await ask(), 'fal', 'fal.ai alone');
    assert.equal(asked.some(a => a.url.includes('decart')), false);
  });
});

test('liveVia: who the consent text names', () => {
  assert.equal(liveVia({}), null);
  assert.equal(liveVia({ DECART_API_KEY: 'x' }), 'decart');
  assert.equal(liveVia({ FAL_API_KEY: 'x' }), 'fal');
  assert.equal(liveVia({ DECART_API_KEY: 'x', FAL_KEY: 'y' }), 'both');
});
