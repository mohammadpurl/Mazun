import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SupabaseRepo } from '../src/lib/db/supabase';
import { validateGarment } from '../src/lib/validate';

const base = { name: { en: 'Zayna' }, price: 50, sizes: [{ n: 'S', ok: true }], colors: [{ name: { en: 'Olive' }, hex: '#6F7258' }] };

test('validateGarment: worn photos keep safe URLs, drop unsafe ones, and only belong to garments', () => {
  const r = validateGarment({ ...base, wornFront: '/images/worn/zayna-front.webp', wornBack: 'https://cdn.example.com/b.webp' });
  assert.ok(r.ok);
  assert.equal(r.value.wornFront, '/images/worn/zayna-front.webp');
  assert.equal(r.value.wornBack, 'https://cdn.example.com/b.webp');
  const bad = validateGarment({ ...base, wornFront: 'javascript:alert(1)', wornBack: 'data:image/png;base64,AAAA' });
  assert.ok(bad.ok);
  assert.equal(bad.value.wornFront, '');
  assert.equal(bad.value.wornBack, '');
  const bag = validateGarment({ ...base, kind: 'bag', sizes: [{ n: 'ONE', ok: true }], wornFront: '/images/worn/x.webp' });
  assert.ok(bag.ok);
  assert.equal(bag.value.wornFront, '', 'accessories carry no worn photos');
});

/** A Supabase client that answers the column probe as told and records what an update writes. */
function fakeRepo(probe: () => { error: { code: string; message: string } | null }) {
  const repo = new SupabaseRepo('https://x.supabase.co', 'key');
  const writes: Record<string, unknown>[] = [];
  let probes = 0;
  const row = { id: 'zayna', name: {}, colors: [], sizes: [] };
  (repo as unknown as { sb: unknown }).sb = {
    from: () => ({
      select: () => ({ limit: async () => { probes++; return { data: [], ...probe() }; } }),
      update: (payload: Record<string, unknown>) => { writes.push(payload); return { eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }; },
    }),
  };
  return { repo, writes, probes: () => probes };
}
const input = () => {
  const r = validateGarment({ ...base, wornFront: '/images/worn/a.webp', wornBack: '' });
  assert.ok(r.ok);
  return r.value;
};

test('withWorn: writes the worn columns when the database has them', async () => {
  const f = fakeRepo(() => ({ error: null }));
  await f.repo.updateGarment('zayna', input());
  assert.equal(f.writes[0].worn_front, '/images/worn/a.webp');
});

test('withWorn: refuses to drop worn photos when the columns are missing, saves the rest otherwise', async () => {
  const f = fakeRepo(() => ({ error: { code: '42703', message: 'column does not exist' } }));
  await assert.rejects(f.repo.updateGarment('zayna', input()), /schema\.sql/);
  await f.repo.updateGarment('zayna', { ...input(), wornFront: '' });
  assert.equal('worn_front' in f.writes[0], false);
  await f.repo.updateGarment('zayna', { ...input(), wornFront: '' });
  // One probe for the worn columns and one for the gallery column, each asked once.
  assert.equal(f.probes(), 2, 'a missing column is remembered');
});

test('withWorn: a passing error is asked again instead of being remembered', async () => {
  let n = 0;
  const f = fakeRepo(() => (n++ === 0 ? { error: { code: '500', message: 'timeout' } } : { error: null }));
  await f.repo.updateGarment('zayna', input());
  await f.repo.updateGarment('zayna', input());
  // worn (timeout, not remembered), gallery (found), then worn again.
  assert.equal(f.probes(), 3);
  assert.equal(f.writes[1].worn_front, '/images/worn/a.webp');
});
