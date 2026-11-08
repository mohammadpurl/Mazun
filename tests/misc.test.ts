import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicCatalog } from '../src/lib/catalog';
import { csvCell, toCsv } from '../src/lib/csv';
import { DEFAULT_SETTINGS, SEED_CATEGORIES, SEED_GARMENTS } from '../src/lib/defaults';
import { sniffImage } from '../src/lib/image';
import { customerWhatsAppLink, orderMessage, shopChatLink } from '../src/lib/order-message';
import { allow } from '../src/lib/rate-limit';
import { upgradeOrder } from '../src/lib/orders';
import { buildDashboard, dayKey } from '../src/lib/stats';
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
  assert.equal(r.garments.length, SEED_GARMENTS.length - 1 - 2, 'hidden Zayna and the two evening pieces are out; accessories stay');
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

test('buildDashboard counts by shop day, compares with the previous period, and counts only accepted orders as sales', () => {
  const now = new Date('2026-10-19T10:00:00Z'); // 14:00 in Muscat
  const mk = (id: number, createdAt: string, status: Order['status'], total = 10, city = 'Muscat'): Order => upgradeOrder({
    id, customerId: null, createdAt, updatedAt: createdAt, status, total, items: [{ garmentId: id % 2 ? 'zayna' : 'reem', name: 'x', size: 'M', color: '', qty: 1, price: total }],
    customerName: 'x', phone: String(id % 3), city, address: '', note: '', eventDate: null, lang: 'fa', adminNote: '',
  } as Order);
  const orders = [
    mk(1, '2026-10-19T09:00:00Z', 'new'),
    mk(2, '2026-10-18T21:00:00Z', 'confirmed'), // 01:00 on the 19th in Muscat -> today
    mk(3, '2026-10-18T10:00:00Z', 'delivered', 30, 'Salalah'),
    mk(4, '2026-10-19T08:00:00Z', 'cancelled', 999),
    mk(5, '2026-10-10T10:00:00Z', 'delivered', 50),
    mk(6, '2026-10-08T10:00:00Z', 'delivered', 20), // previous week
  ];
  const withSoldOut = SEED_GARMENTS.map(g => (g.id === 'reem' ? { ...g, sizes: g.sizes.map(s => (s.n === 'XL' ? { ...s, ok: false } : s)) } : g));
  const d = buildDashboard({ orders, garments: withSoldOut, categories: SEED_CATEGORIES, customers: [], monthlyGoal: 0 }, 'week', now);
  assert.equal(dayKey(new Date('2026-10-18T21:00:00Z')), '2026-10-19');
  assert.equal(d.series.length, 7);
  assert.equal(d.series.at(-1)!.key, '2026-10-19');
  assert.equal(d.series.at(-1)!.orders, 1); // the new (unconfirmed) order of the day is not a sale yet
  assert.equal(d.revenue.current, 40);
  assert.equal(d.revenue.previous, 70);
  assert.equal(d.orders.current, 2);
  assert.deepEqual(d.pending, { count: 1, amount: 10 });
  assert.equal(d.cancelled, 1);
  assert.equal(d.funnel[0].count, 4);
  assert.equal(d.funnel[3].count, 1);
  assert.equal(d.cities.find(c => c.key === 'muscat')?.orders, 1);
  assert.equal(d.cities.find(c => c.key === 'salalah')?.orders, 1);
  assert.ok(d.soldOut.some(x => x.sizes.includes('XL')));
  const y = buildDashboard({ orders, garments: SEED_GARMENTS, categories: SEED_CATEGORIES, customers: [], monthlyGoal: 100 }, 'year', now);
  assert.equal(y.series.length, 12);
  assert.equal(y.goal?.target, 100);
});
