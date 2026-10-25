import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';
import { normalizePhone, validateCategory, validateGarment, validateOrder, validateOrderPatch, validateSettings } from '../src/lib/validate';

const line = { garmentId: 'zayna', size: 'M', color: 0, qty: 1 };

test('normalizePhone keeps digits, converts Persian/Arabic digits, drops 00 prefix', () => {
  assert.equal(normalizePhone('+968 9123-4567'), '96891234567');
  assert.equal(normalizePhone('00968 91234567'), '96891234567');
  assert.equal(normalizePhone('۰۹۱۲۳۴۵۶۷۸۹'), '09123456789');
  assert.equal(normalizePhone('٩٦٨٩١٢٣٤٥٦٧'), '96891234567');
  assert.equal(normalizePhone(42), '');
});

test('validateOrder accepts a bag of lines and trims the customer fields', () => {
  const r = validateOrder({ items: [line, { ...line, garmentId: 'reem', qty: '2' }], customerName: '  Sara  ', phone: '+968 91234567', lang: 'ar', eventDate: '2026-11-01' });
  assert.ok(r.ok);
  assert.equal(r.value.items.length, 2);
  assert.equal(r.value.items[1].qty, 2);
  assert.equal(r.value.customerName, 'Sara');
  assert.equal(r.value.phone, '96891234567');
  assert.equal(r.value.lang, 'ar');
});

test('validateOrder rejects an empty bag, bad quantities, missing name, short phone, bad date', () => {
  const r = validateOrder({ items: [], customerName: 'A', phone: '123', eventDate: 'tomorrow' });
  assert.ok(!r.ok);
  assert.deepEqual(Object.keys(r.errors).sort(), ['customerName', 'eventDate', 'items', 'phone']);
  for (const qty of [0, 11, 1.5, 'x']) assert.ok(!validateOrder({ items: [{ ...line, qty }], customerName: 'Ali', phone: '91234567' }).ok, String(qty));
  assert.ok(!validateOrder({ items: Array(21).fill(line), customerName: 'Ali', phone: '91234567' }).ok, 'more than 20 lines');
  const de = validateOrder({ items: [line], customerName: 'Ali', phone: '91234567', lang: 'de' });
  assert.ok(de.ok && de.value.lang === 'en', 'unknown language falls back to English');
});

const base = { name: { en: 'Zayna' }, price: 50, sizes: [{ n: 's', ok: true }], colors: [{ name: { en: 'Olive' }, hex: '#6F7258' }] };

test('validateGarment: images are optional, colours and sizes are required, sale below price', () => {
  const r = validateGarment(base);
  assert.ok(r.ok);
  assert.equal(r.value.kind, 'garment');
  assert.equal(r.value.front, '');
  assert.equal(r.value.sizes[0].n, 'S', 'size names are upper-cased');
  assert.equal(r.value.shape, 'abaya');
  assert.ok(!validateGarment({ ...base, salePrice: 60 }).ok);
  assert.ok(validateGarment({ ...base, salePrice: '40' }).ok);
  assert.ok(!validateGarment({ ...base, name: {} }).ok);
  assert.ok(!validateGarment({ ...base, sizes: [] }).ok);
  assert.ok(!validateGarment({ ...base, colors: [{ name: { en: 'x' }, hex: 'red' }] }).ok, 'colour needs a #RRGGBB hex');
});

test('validateGarment: accessories never belong to a collection; unknown kind/shape fall back', () => {
  const a = validateGarment({ ...base, kind: 'bag', categoryId: 'abayas' });
  assert.ok(a.ok && a.value.kind === 'bag' && a.value.categoryId === null);
  const b = validateGarment({ ...base, kind: 'hat', shape: 'cube' });
  assert.ok(b.ok && b.value.kind === 'garment' && b.value.shape === 'abaya');
});

test('validateGarment refuses non-http(s) image URLs (no javascript: or data:)', () => {
  for (const front of ['javascript:alert(1)', 'data:image/png;base64,AAA', '//evil.com/x.png', 'http://plain.com/x.png']) {
    const r = validateGarment({ ...base, front });
    assert.ok(r.ok && r.value.front === '', front);
  }
  const ok = validateGarment({ ...base, front: 'https://x.supabase.co/a.webp', detail: '/uploads/g/a.webp' });
  assert.ok(ok.ok && ok.value.front.startsWith('https://') && ok.value.detail === '/uploads/g/a.webp');
});

test('validateGarment drops duplicate sizes and keeps only chart rows for real sizes', () => {
  const r = validateGarment({ ...base, sizes: [{ n: 'M' }, { n: 'm' }, { n: 'L', ok: false }], chart: { M: { bust: '98', waist: '' }, XL: { bust: 110 } } });
  assert.ok(r.ok);
  assert.deepEqual(r.value.sizes, [{ n: 'M', ok: true }, { n: 'L', ok: false }]);
  assert.deepEqual(r.value.chart, { M: { bust: 98 } });
});

test('validateCategory and validateOrderPatch', () => {
  assert.ok(!validateCategory({ name: {} }).ok);
  const c = validateCategory({ name: { fa: 'کافتان' }, image: 'javascript:x' });
  assert.ok(c.ok && c.value.image === '' && c.value.description.en === '');
  assert.ok(!validateOrderPatch({ status: 'paid' }).ok);
  const p = validateOrderPatch({ status: 'shipped', adminNote: ' sent ' });
  assert.ok(p.ok && p.value.status === 'shipped' && p.value.adminNote === 'sent');
});

test('validateSettings requires the handle of the chosen channel and cleans home images', () => {
  assert.ok(!validateSettings({ ...DEFAULT_SETTINGS, channel: 'whatsapp', whatsapp: '' }).ok);
  const ok = validateSettings({ ...DEFAULT_SETTINGS, whatsapp: '+968 9123 4567', telegram: '@shop_bot', home: { hero: '/uploads/h.webp', atelier: 'javascript:x', featuredId: 'zayna' } });
  assert.ok(ok.ok);
  assert.equal(ok.value.whatsapp, '96891234567');
  assert.equal(ok.value.telegram, 'shop_bot');
  assert.equal(ok.value.home.hero, '/uploads/h.webp');
  assert.equal(ok.value.home.atelier, '');
  assert.equal(ok.value.home.featuredId, 'zayna');
  assert.ok(!validateSettings({ ...DEFAULT_SETTINGS, channel: 'telegram', telegram: 'a b' }).ok);
});
