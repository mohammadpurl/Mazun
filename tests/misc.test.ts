import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicCatalog } from '../src/lib/catalog';
import { csvCell, toCsv } from '../src/lib/csv';
import { DEFAULT_SETTINGS, SEED_CATEGORIES, SEED_GARMENTS } from '../src/lib/defaults';
import { sniffImage } from '../src/lib/image';
import { customerWhatsAppLink, orderMessage, shopChatLink } from '../src/lib/order-message';
import { allow } from '../src/lib/rate-limit';
import { dashboardStats, dayKey } from '../src/lib/stats';
import type { Order } from '../src/lib/types';

test('csvCell quotes and neutralises spreadsheet formulas', () => {
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell('+968'), "'+968");
  assert.ok(toCsv([['a']]).startsWith('﻿'));
});

test('sniffImage trusts bytes, not names', () => {
  assert.deepEqual(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), { mime: 'image/png', ext: 'png' });
  assert.deepEqual(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), { mime: 'image/jpeg', ext: 'jpg' });
  assert.deepEqual(sniffImage(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')), { mime: 'image/webp', ext: 'webp' });
  assert.equal(sniffImage(new TextEncoder().encode('<svg onload=alert(1)>')), null);
});

test('publicCatalog hides hidden garments, garments of hidden categories and empty categories', () => {
  const cats = [{ ...SEED_CATEGORIES[0] }, { ...SEED_CATEGORIES[1], visible: false }, { id: 'c3', name: { fa: 'خالی', ar: '', en: '' }, sort: 3, visible: true }];
  const gs = SEED_GARMENTS.map((g, i) => ({ ...g, visible: i !== 0 }));
  const r = publicCatalog(cats, gs);
  assert.equal(r.garments.length, 6, '8 seed garments minus 1 hidden minus 1 in a hidden category');
  assert.deepEqual(r.categories.map(c => c.id), ['c1']);
});

test('order message and chat links', () => {
  const s = { ...DEFAULT_SETTINGS, whatsapp: '96891234567' };
  const msg = orderMessage({ id: 1001, garmentName: 'Navy', size: 'M', price: 48, customerName: 'Sara' }, 'en', s);
  assert.match(msg, /order #1001/);
  assert.match(msg, /48 OMR/);
  assert.match(shopChatLink(s, msg)!, /^https:\/\/wa\.me\/96891234567\?text=Hello/);
  assert.equal(shopChatLink({ ...s, whatsapp: '' }, msg), null);
  assert.equal(shopChatLink({ ...s, channel: 'instagram', instagram: 'shop' }, msg), 'https://ig.me/m/shop');
  assert.equal(customerWhatsAppLink('+968 9123'), 'https://wa.me/9689123');
});

test('rate limiter allows the limit, then blocks until the window resets', () => {
  const k = 'test-' + Math.random();
  for (let i = 0; i < 3; i++) assert.ok(allow(k, 3, 1000, 0));
  assert.equal(allow(k, 3, 1000, 10), false);
  assert.ok(allow(k, 3, 1000, 1000));
});

test('dashboardStats counts by shop day and leaves cancelled orders out of revenue', () => {
  const now = new Date('2026-10-19T10:00:00Z'); // 14:00 in Muscat
  const mk = (id: number, createdAt: string, status: Order['status'], price = 10): Order => ({
    id, createdAt, updatedAt: createdAt, status, price, garmentId: 'g1', garmentName: id % 2 ? 'A' : 'B', size: 'M',
    customerName: 'x', phone: '1', city: '', address: '', note: '', eventDate: null, lang: 'fa', adminNote: '',
  });
  const orders = [
    mk(1, '2026-10-19T09:00:00Z', 'new'),
    mk(2, '2026-10-18T21:00:00Z', 'confirmed'), // 01:00 on the 19th in Muscat -> today
    mk(3, '2026-10-18T10:00:00Z', 'delivered', 30),
    mk(4, '2026-10-19T08:00:00Z', 'cancelled', 999),
    mk(5, '2026-09-30T10:00:00Z', 'delivered', 50),
  ];
  const s = dashboardStats(orders, SEED_GARMENTS, now);
  assert.equal(dayKey(new Date('2026-10-18T21:00:00Z')), '2026-10-19');
  assert.equal(s.ordersToday, 2);
  assert.equal(s.openOrders, 2);
  assert.equal(s.newOrders, 1);
  assert.equal(s.revenueMonth, 50);
  assert.equal(s.ordersMonth, 3);
  assert.equal(s.perDay.length, 14);
  assert.equal(s.perDay.at(-1)!.day, '2026-10-19');
  assert.equal(s.perDay.at(-1)!.count, 2);
  assert.equal(s.topGarments[0].name, 'A');
  assert.ok(s.soldOut.some(x => x.sizes.includes('XL')));
});
