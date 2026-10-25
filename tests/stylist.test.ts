import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SEED_GARMENTS } from '../src/lib/defaults';
import { accessoriesByRole, chipPicks, lookTotal, presetPicks, replacePick, sanitizePicks } from '../src/lib/stylist';

const byRole = accessoriesByRole(SEED_GARMENTS);
const byId = (id: string) => SEED_GARMENTS.find(g => g.id === id);

test('accessoriesByRole groups accessories in admin order and leaves garments out', () => {
  assert.deepEqual(byRole.bag.map(g => g.id), ['bag-top', 'bag-clutch']);
  assert.deepEqual(byRole.scarf.map(g => g.id), ['shayla-silk', 'shayla-jersey']);
  assert.ok(!Object.values(byRole).flat().some(g => g.kind === 'garment'));
});

test('occasion presets follow the design: day = first pieces, evening = second', () => {
  assert.deepEqual(presetPicks(byRole, 0), { scarf: 'shayla-silk', bag: 'bag-top', jewel: 'hoops-gold', shoes: 'mule-block' });
  assert.deepEqual(presetPicks(byRole, 1), { scarf: 'shayla-silk', bag: 'bag-clutch', jewel: 'pearl-drops', shoes: 'pump-satin' });
  assert.deepEqual(presetPicks(byRole, 4), { scarf: 'shayla-jersey', bag: 'bag-top', jewel: 'hoops-gold', shoes: 'mule-block' });
});

test('a role with one piece wraps, an empty role is left out', () => {
  const only = accessoriesByRole(SEED_GARMENTS.filter(g => g.id !== 'bag-clutch' && g.kind !== 'jewel'));
  const p = presetPicks(only, 1);
  assert.equal(p.bag, 'bag-top');
  assert.equal(p.jewel, undefined);
});

test('sold-out accessories are never suggested', () => {
  const gs = SEED_GARMENTS.map(g => (g.id === 'bag-top' ? { ...g, sizes: [{ n: 'ONE', ok: false }] } : g));
  assert.equal(presetPicks(accessoriesByRole(gs), 0).bag, 'bag-clutch');
});

test('chips map to looks and Replace cycles within the role', () => {
  assert.equal(chipPicks(byRole, 0).occasion, 1);
  assert.equal(chipPicks(byRole, 1).picks.scarf, 'shayla-jersey');
  const p = presetPicks(byRole, 0);
  assert.equal(replacePick(byRole, p, 'bag').bag, 'bag-clutch');
  assert.equal(replacePick(byRole, replacePick(byRole, p, 'bag'), 'bag').bag, 'bag-top');
});

test('sanitizePicks keeps only real accessories of the right role (AI output is not trusted)', () => {
  const fallback = presetPicks(byRole, 0);
  const s = sanitizePicks({ scarf: 'shayla-jersey', bag: 'zayna', jewel: 'made-up', shoes: null }, byRole, fallback);
  assert.deepEqual(s, { scarf: 'shayla-jersey', bag: 'bag-top', jewel: 'hoops-gold', shoes: 'mule-block' });
  assert.deepEqual(sanitizePicks('nonsense', byRole, {}), {});
});

test('lookTotal adds the garment and the picked accessories', () => {
  assert.equal(lookTotal(byId('zayna')!, presetPicks(byRole, 0), byId), 168 + 38 + 145 + 64 + 89);
});
