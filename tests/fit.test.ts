import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chartOf, effectivePrice, planArrival, suggestSize } from '../src/lib/fit';

const sizes = (spec: string) => spec.split(',').map(s => ({ n: s.replace('!', ''), ok: !s.endsWith('!') }));

test('chartOf uses the garment chart and falls back per size to the default', () => {
  const c = chartOf({ sizes: sizes('S,M,XXL'), chart: { M: { bust: 100 } } });
  assert.deepEqual(c.M, { bust: 100 });
  assert.equal(c.S.bust, 92);
  assert.equal(c.XXL, undefined, 'no default for an unknown size');
});

test('suggestSize picks by BMI and moves to the nearest size in stock', () => {
  const g = { sizes: sizes('S,M,L,XL'), chart: null };
  assert.equal(suggestSize(g, 165, 45)!.size, 'S');
  assert.equal(suggestSize(g, 160, 95)!.size, 'XL');
  const sold = suggestSize({ sizes: sizes('S,M,L,XL!'), chart: null }, 160, 95)!;
  assert.equal(sold.size, 'XL');
  assert.equal(sold.pick, 'L');
  assert.equal(sold.soldOut, true);
});

test('suggestSize reports nothing in stock and rejects bad input', () => {
  const r = suggestSize({ sizes: sizes('S!,M!'), chart: null }, 165, 60)!;
  assert.equal(r.pick, null);
  assert.equal(r.soldOut, true);
  assert.equal(suggestSize({ sizes: sizes('M'), chart: null }, 0, 60), null);
});

test('suggestSize compares length with height', () => {
  const g = { sizes: sizes('M'), chart: { M: { length: 142 } } };
  assert.equal(suggestSize(g, 150, 55)!.length, 'long');
  assert.equal(suggestSize(g, 167, 60)!.length, 'ok');
  assert.equal(suggestSize(g, 185, 70)!.length, 'short');
});

test('planArrival: good, tight and late', () => {
  const today = new Date('2026-10-19T00:00:00Z');
  const days = { prep: 2, lead: 1, ship: 3, buffer: 2 };
  const good = planArrival(new Date('2026-11-10T00:00:00Z'), today, days);
  assert.equal(good.verdict, 'good');
  assert.equal(good.earliest.toISOString().slice(0, 10), '2026-10-25');
  assert.equal(good.latest.toISOString().slice(0, 10), '2026-11-02');
  assert.equal(planArrival(new Date('2026-10-26T00:00:00Z'), today, days).verdict, 'tight');
  assert.equal(planArrival(new Date('2026-10-22T00:00:00Z'), today, days).verdict, 'late');
});

test('effectivePrice uses the sale price only when it is lower', () => {
  assert.equal(effectivePrice({ price: 50, salePrice: null }), 50);
  assert.equal(effectivePrice({ price: 50, salePrice: 40 }), 40);
  assert.equal(effectivePrice({ price: 50, salePrice: 60 }), 50);
});
