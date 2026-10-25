import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chartOf, effectivePrice, recommendSize, type SizeInputs } from '../src/lib/fit';
import type { Shape } from '../src/lib/types';

const sizes = (spec: string) => spec.split(',').map(s => ({ n: s.replace('!', ''), ok: !s.endsWith('!') }));
const g = (spec = 'XS,S,M,L,XL', shape: Shape = 'abaya') => ({ sizes: sizes(spec), chart: null, shape });
const inp = (o: Partial<SizeInputs> = {}): SizeInputs => ({ height: 165, usual: 'M', fit: 'regular', bust: 0, len: 'ankle', ...o });

test('chartOf uses the garment chart and falls back per size to the default guide', () => {
  const c = chartOf({ sizes: sizes('S,M,ONE'), chart: { M: { bust: 100 } } });
  assert.deepEqual(c.M, { bust: 100 });
  assert.deepEqual(c.S, { bust: 86, waist: 70, hips: 94, length: 142 });
  assert.equal(c.ONE, undefined, 'no default for an unknown size');
});

test('recommendSize follows the usual size, adjusted by fit preference', () => {
  assert.equal(recommendSize(inp(), g())!.size, 'M');
  assert.equal(recommendSize(inp({ fit: 'relaxed' }), g())!.size, 'L');
  assert.equal(recommendSize(inp({ fit: 'fitted' }), g())!.size, 'S', 'fitted sizes down on an abaya');
  assert.equal(recommendSize(inp({ fit: 'fitted' }), g('XS,S,M,L,XL', 'gown'))!.size, 'M', 'but not on a gown');
});

test('recommendSize uses the bust measurement when given, and reports the ease', () => {
  const r = recommendSize(inp({ bust: 95 }), g())!;
  assert.equal(r.size, 'L'); // 95 + 6 - 6 = 95 -> first size with bust >= 95 is L (98)
  assert.equal(r.ease, 98 + 8 - 95);
  assert.equal(recommendSize(inp({ bust: 140 }), g())!.size, 'XL', 'beyond the chart -> largest in stock');
});

test('recommendSize moves to the nearest size in stock', () => {
  assert.equal(recommendSize(inp({ usual: 'XL' }), g('XS,S,M,L'))!.size, 'L', 'above the range -> largest');
  assert.equal(recommendSize(inp(), g('XS,S,M!,L,XL'))!.size, 'L', 'sold out -> next size up');
  assert.equal(recommendSize(inp(), g('XS!,S!,M!,L!,XL!')), null, 'nothing in stock');
});

test('recommendSize describes the hem for the height', () => {
  assert.equal(recommendSize(inp({ height: 175 }), g())!.height, 'tall');
  assert.equal(recommendSize(inp({ height: 152 }), g())!.height, 'short');
  assert.equal(recommendSize(inp({ height: 0 }), g())!.height, 'ok', 'missing height assumes 165');
});

test('effectivePrice uses the sale price only when it is lower', () => {
  assert.equal(effectivePrice({ price: 50, salePrice: null }), 50);
  assert.equal(effectivePrice({ price: 50, salePrice: 40 }), 40);
  assert.equal(effectivePrice({ price: 50, salePrice: 60 }), 50);
});
