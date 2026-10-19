import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizePhone, validateCategory, validateGarment, validateOrder, validateOrderPatch, validateSettings } from '../src/lib/validate';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';

test('normalizePhone keeps digits, converts Persian/Arabic digits, drops 00 prefix', () => {
  assert.equal(normalizePhone('+968 9123-4567'), '96891234567');
  assert.equal(normalizePhone('00968 91234567'), '96891234567');
  assert.equal(normalizePhone('۰۹۱۲۳۴۵۶۷۸۹'), '09123456789');
  assert.equal(normalizePhone('٩٦٨٩١٢٣٤٥٦٧'), '96891234567');
  assert.equal(normalizePhone(42), '');
});

test('validateOrder accepts a complete order and trims fields', () => {
  const r = validateOrder({ garmentId: 'g1', size: 'M', customerName: '  Sara  ', phone: '+968 91234567', lang: 'ar', eventDate: '2026-11-01' });
  assert.ok(r.ok);
  assert.equal(r.value.customerName, 'Sara');
  assert.equal(r.value.phone, '96891234567');
  assert.equal(r.value.lang, 'ar');
  assert.equal(r.value.eventDate, '2026-11-01');
});

test('validateOrder rejects missing name, short phone, bad date; unknown lang falls back to fa', () => {
  const r = validateOrder({ garmentId: 'g1', size: 'M', customerName: 'A', phone: '123', eventDate: 'tomorrow' });
  assert.ok(!r.ok);
  assert.deepEqual(Object.keys(r.errors).sort(), ['customerName', 'eventDate', 'phone']);
  const r2 = validateOrder({ garmentId: 'g1', size: 'M', customerName: 'Ali', phone: '91234567', lang: 'de' });
  assert.ok(r2.ok && r2.value.lang === 'fa');
});

test('validateGarment requires a name, a front image, a size; sale must be below price', () => {
  const base = { name: { fa: 'عبا' }, price: 50, sizes: [{ n: 's', ok: true }], front: '/images/a.png' };
  const r = validateGarment(base);
  assert.ok(r.ok);
  assert.equal(r.value.sizes[0].n, 'S', 'size names are upper-cased');
  assert.equal(r.value.back, '/images/a.png', 'back falls back to front');
  assert.equal(r.value.salePrice, null);

  assert.ok(!validateGarment({ ...base, salePrice: 60 }).ok);
  assert.ok(validateGarment({ ...base, salePrice: '40' }).ok);
  assert.ok(!validateGarment({ ...base, name: {} }).ok);
  assert.ok(!validateGarment({ ...base, sizes: [] }).ok);
});

test('validateGarment refuses non-http(s) image URLs (no javascript: or data:)', () => {
  for (const front of ['javascript:alert(1)', 'data:image/png;base64,AAA', '//evil.com/x.png', 'http://plain.com/x.png']) {
    assert.ok(!validateGarment({ name: { en: 'x' }, price: 1, sizes: [{ n: 'M' }], front }).ok, front);
  }
  assert.ok(validateGarment({ name: { en: 'x' }, price: 1, sizes: [{ n: 'M' }], front: 'https://x.supabase.co/a.webp' }).ok);
});

test('validateGarment drops duplicate sizes and keeps only chart rows for real sizes', () => {
  const r = validateGarment({
    name: { en: 'x' }, price: 1, front: '/a.png',
    sizes: [{ n: 'M' }, { n: 'm' }, { n: 'L', ok: false }],
    chart: { M: { bust: '98', waist: '' }, XL: { bust: 110 } },
  });
  assert.ok(r.ok);
  assert.deepEqual(r.value.sizes, [{ n: 'M', ok: true }, { n: 'L', ok: false }]);
  assert.deepEqual(r.value.chart, { M: { bust: 98 } });
});

test('validateCategory and validateOrderPatch', () => {
  assert.ok(!validateCategory({ name: {} }).ok);
  assert.ok(validateCategory({ name: { fa: 'کافتان' } }).ok);
  assert.ok(!validateOrderPatch({ status: 'paid' }).ok);
  const p = validateOrderPatch({ status: 'shipped', adminNote: ' sent ' });
  assert.ok(p.ok && p.value.status === 'shipped' && p.value.adminNote === 'sent');
});

test('validateSettings requires the handle of the chosen channel', () => {
  assert.ok(!validateSettings({ ...DEFAULT_SETTINGS, channel: 'whatsapp', whatsapp: '' }).ok);
  const ok = validateSettings({ ...DEFAULT_SETTINGS, channel: 'whatsapp', whatsapp: '+968 9123 4567', telegram: '@shop_bot' });
  assert.ok(ok.ok);
  assert.equal(ok.value.whatsapp, '96891234567');
  assert.equal(ok.value.telegram, 'shop_bot');
  assert.ok(!validateSettings({ ...DEFAULT_SETTINGS, channel: 'telegram', telegram: 'a b' }).ok);
});
