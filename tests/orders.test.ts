import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SEED_CATEGORIES, SEED_GARMENTS } from '../src/lib/defaults';
import { buildOrder, itemsSummary } from '../src/lib/orders';
import type { Garment, OrderInput } from '../src/lib/types';

const customer = { customerName: 'Sara', phone: '96891234567', city: '', address: '', note: '', eventDate: null, lang: 'en' as const };
const order = (items: OrderInput['items'], lang: OrderInput['lang'] = 'en'): OrderInput => ({ ...customer, lang, items });
const garments = (): Garment[] => structuredClone(SEED_GARMENTS);

test('buildOrder prices every line on the server and totals the bag', () => {
  const r = buildOrder(order([{ garmentId: 'zayna', size: 'M', color: 1, qty: 2 }, { garmentId: 'bag-clutch', size: 'ONE', color: 0, qty: 1 }]), garments(), SEED_CATEGORIES);
  assert.ok(r.ok);
  assert.deepEqual(r.order.items[0], { garmentId: 'zayna', name: 'Zayna', size: 'M', color: 'Espresso', qty: 2, price: 168 });
  assert.equal(r.order.total, 168 * 2 + 98);
  assert.equal(r.order.customerName, 'Sara');
  assert.ok(!('items' in r.order && (r.order as unknown as { garmentId?: string }).garmentId));
});

test('buildOrder uses the sale price and the customer language for names', () => {
  const gs = garments().map(g => (g.id === 'noor' ? { ...g, salePrice: 120 } : g));
  const r = buildOrder(order([{ garmentId: 'noor', size: 'S', color: 0, qty: 1 }], 'ar'), gs, SEED_CATEGORIES);
  assert.ok(r.ok);
  assert.equal(r.order.items[0].price, 120);
  assert.equal(r.order.items[0].name, 'نور');
  assert.equal(r.order.items[0].color, 'عاجي');
});

test('buildOrder merges the same piece, size and colour into one line (max 10)', () => {
  const r = buildOrder(order([{ garmentId: 'zayna', size: 'M', color: 0, qty: 6 }, { garmentId: 'zayna', size: 'M', color: 0, qty: 6 }]), garments(), SEED_CATEGORIES);
  assert.ok(r.ok && r.order.items.length === 1 && r.order.items[0].qty === 10);
});

test('buildOrder refuses unknown, hidden and sold-out pieces, and pieces of a hidden collection', () => {
  const gs = garments();
  assert.deepEqual(buildOrder(order([{ garmentId: 'nope', size: 'M', color: 0, qty: 1 }]), gs, SEED_CATEGORIES), { ok: false, error: 'unavailable', garmentId: 'nope' });
  assert.equal((buildOrder(order([{ garmentId: 'reem', size: 'XL', color: 0, qty: 1 }]), gs, SEED_CATEGORIES) as { error: string }).error, 'soldout');
  assert.equal((buildOrder(order([{ garmentId: 'zayna', size: 'XXXL', color: 0, qty: 1 }]), gs, SEED_CATEGORIES) as { error: string }).error, 'soldout');
  const hidden = gs.map(g => (g.id === 'zayna' ? { ...g, visible: false } : g));
  assert.equal((buildOrder(order([{ garmentId: 'zayna', size: 'M', color: 0, qty: 1 }]), hidden, SEED_CATEGORIES) as { error: string }).error, 'unavailable');
  const cats = SEED_CATEGORIES.map(c => (c.id === 'evening' ? { ...c, visible: false } : c));
  assert.equal((buildOrder(order([{ garmentId: 'layal', size: 'M', color: 0, qty: 1 }]), gs, cats) as { error: string }).error, 'unavailable');
});

test('itemsSummary lists pieces with size and quantity', () => {
  assert.equal(itemsSummary([{ garmentId: 'a', name: 'Zayna', size: 'M', color: '', qty: 2, price: 1 }, { garmentId: 'b', name: 'Reem', size: 'S', color: '', qty: 1, price: 1 }]), 'Zayna (M) ×2، Reem (S)');
});
