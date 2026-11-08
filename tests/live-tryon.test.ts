import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST } from '../src/app/api/tryon/live-token/route';
import { SEED_GARMENTS } from '../src/lib/defaults';
import { livePrompt } from '../src/lib/live-tryon';

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

const req = (origin: string | null, ip = '10.0.0.1') => new Request('http://shop.test/api/tryon/live-token', {
  method: 'POST',
  headers: { host: 'shop.test', 'x-forwarded-for': ip, ...(origin ? { origin } : {}) },
});

test('live-token: off without a key, and never mints for another site', async () => {
  const saved = process.env.DECART_API_KEY, savedFal = process.env.FAL_KEY;
  try {
    delete process.env.DECART_API_KEY;
    delete process.env.FAL_KEY;
    delete process.env.FAL_API_KEY;
    assert.equal((await POST(req('http://shop.test'))).status, 503);
    process.env.DECART_API_KEY = 'dct_test';
    assert.equal((await POST(req(null))).status, 403, 'no origin');
    assert.equal((await POST(req('https://evil.example'))).status, 403, 'foreign origin');
    const body = await (await POST(req('https://evil.example'))).json();
    assert.equal(JSON.stringify(body).includes('dct_test'), false, 'the permanent key is never echoed');
  } finally {
    if (saved === undefined) delete process.env.DECART_API_KEY; else process.env.DECART_API_KEY = saved;
    if (savedFal === undefined) delete process.env.FAL_KEY; else process.env.FAL_KEY = savedFal;
  }
});
