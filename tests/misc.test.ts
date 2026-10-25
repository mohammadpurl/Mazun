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

test('publicCatalog hides hidden products, garments of hidden collections and collections without garments', () => {
  const cats = [...SEED_CATEGORIES.map(c => (c.id === 'evening' ? { ...c, visible: false } : c)), { ...SEED_CATEGORIES[0], id: 'empty', sort: 9 }];
  const gs = SEED_GARMENTS.map(g => ({ ...g, visible: g.id !== 'zayna' }));
  const r = publicCatalog(cats, gs);
  assert.equal(r.garments.length, 16 - 1 - 2, 'hidden Zayna and the two evening pieces are out; accessories stay');
  assert.deepEqual(r.categories.map(c => c.id), ['abayas', 'modest', 'atelier']);
});

test('order message and chat links', () => {
  const s = { ...DEFAULT_SETTINGS, whatsapp: '96891234567' };
  const msg = orderMessage({ id: 1001, total: 144, customerName: 'Sara', items: [{ garmentId: 'a', name: 'Navy', size: 'M', color: 'Olive', qty: 2, price: 48 }, { garmentId: 'b', name: 'Clutch', size: 'ONE', color: '', qty: 1, price: 48 }] }, 'en', s);
  assert.match(msg, /order #1001/);
  assert.ok(msg.includes('• Navy (Olive) — Size M ×2 — 96 OMR'), msg);
  assert.match(msg, /Total: 144 OMR/);
  assert.match(orderMessage({ id: 1002, total: 5, customerName: 'س', items: [] }, 'fa', s), /سفارش شمارهٔ ۱۰۰۲/);
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
  const mk = (id: number, createdAt: string, status: Order['status'], total = 10): Order => ({
    id, createdAt, updatedAt: createdAt, status, total, items: [{ garmentId: null, name: id % 2 ? 'A' : 'B', size: 'M', color: '', qty: 1, price: total }],
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
