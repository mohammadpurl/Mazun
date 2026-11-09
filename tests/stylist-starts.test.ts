import assert from 'node:assert/strict';
import { test } from 'node:test';
import ar from '../src/components/shop/copy/ar.json';
import en from '../src/components/shop/copy/en.json';
import fa from '../src/components/shop/copy/fa.json';
import { readMessage } from '../src/lib/concierge';
import { setFor, type ByRole } from '../src/lib/stylist';
import type { Garment } from '../src/lib/types';

// The chat's buttons send these words as her message, so the built-in reading has to understand each one.
const EXPECTED = ['pick', 'size', 'set', 'tryon'] as const;

for (const [lang, copy] of [['en', en], ['fa', fa], ['ar', ar]] as const) {
  test(`${lang}: one opening button per intent`, () => assert.equal(copy.aiStarts.length, EXPECTED.length));
  EXPECTED.forEach((intent, i) => {
    test(`${lang}: "${copy.aiStarts[i]}" reads as ${intent}`, () => assert.equal(readMessage(copy.aiStarts[i]).intent, intent));
  });
  test(`${lang}: "${copy.aiActSet}" reads as set`, () => assert.equal(readMessage(copy.aiActSet).intent, 'set'));
}

const piece = (id: string, hex: string) => ({ id, colors: [{ hex }] }) as unknown as Garment;
const byRole: ByRole = {
  scarf: [piece('ivory-shayla', '#F2EADC'), piece('black-shayla', '#111111')],
  bag: [piece('day-bag', '#C8A97E'), piece('night-bag', '#222222')],
  jewel: [piece('day-jewel', '#E0C080'), piece('night-jewel', '#D0D0D0')],
  shoes: [piece('day-shoes', '#C8A97E'), piece('night-shoes', '#222222')],
};

test('setFor: the shayla follows the garment, whatever the occasion', () => {
  assert.equal(setFor(byRole, piece('a', '#0B0B0B'), 0).scarf, 'black-shayla');
  assert.equal(setFor(byRole, piece('a', '#F5EFE3'), 1).scarf, 'ivory-shayla');
});

test('setFor: the other pieces follow the occasion', () => {
  const day = setFor(byRole, piece('a', '#0B0B0B'), 0), evening = setFor(byRole, piece('a', '#0B0B0B'), 1);
  assert.equal(day.bag, 'day-bag');
  assert.equal(evening.bag, 'night-bag');
});

test('setFor: no two occasions give the same set', () => {
  const full: ByRole = { ...byRole, jewel: [piece('gold', '#C2A15B'), piece('pearl', '#EDE8DF'), piece('hirz', '#C9CCD1'), piece('bangles', '#C9CCD1')] };
  for (const hex of ['#0B0B0B', '#F5EFE3', '#556B2F']) {
    const sets = [0, 1, 2, 3, 4].map(o => JSON.stringify(setFor(full, piece('a', hex), o)));
    assert.equal(new Set(sets).size, 5, hex);
  }
});

test('setFor: a garment with no usable colour keeps the occasion preset', () => {
  assert.equal(setFor(byRole, { colors: [] }, 0).scarf, 'ivory-shayla');
});
