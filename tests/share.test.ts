import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { SEED_PHOTOS } from '../src/lib/defaults';
import { fittingHref, productHref } from '../src/lib/paths';
import { originOf } from '../src/lib/share';

/** Width and height of a baseline or progressive JPEG, read from its first SOF marker. */
function jpegSize(file: string) {
  const b = readFileSync(file);
  assert.equal(b.readUInt16BE(0), 0xffd8, `${file} is not a JPEG`);
  for (let i = 2; i < b.length;) {
    const marker = b.readUInt16BE(i), len = b.readUInt16BE(i + 2);
    if (marker >= 0xffc0 && marker <= 0xffc2) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error(`${file}: no size`);
}

test('share pictures: the shop card and one card per seeded abaya, all 1200×630', () => {
  for (const file of ['public/og.jpg', ...[...SEED_PHOTOS].map(id => `public/images/share/${id}.jpg`)]) {
    assert.deepEqual(jpegSize(file), { w: 1200, h: 630 }, file);
  }
});

test('originOf: keeps an http(s) origin, adds https to a bare host, refuses anything else', () => {
  assert.equal(originOf('https://www.mazun.om/'), 'https://www.mazun.om');
  assert.equal(originOf(' mazun.om '), 'https://mazun.om');
  assert.equal(originOf('http://localhost:5188/x'), 'http://localhost:5188');
  assert.equal(originOf('javascript:alert(1)'), null);
  assert.equal(originOf('bad host<x>'), null);
  assert.equal(originOf('ftp://mazun.om'), null);
  assert.equal(originOf(''), null);
  assert.equal(originOf(undefined), null);
});

test('fittingHref: her own photo when it can be dressed, otherwise the piece on the house model', () => {
  assert.equal(fittingHref('noor', true), '/fitting-room?g=noor');
  assert.equal(fittingHref('noor', false), '/fitting-room?g=noor&model=1');
  assert.equal(fittingHref('a b&c', false), '/fitting-room?g=a%20b%26c&model=1');
  assert.equal(productHref('a b'), '/abaya/a%20b');
});
