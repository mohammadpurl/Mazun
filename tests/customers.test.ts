import assert from 'node:assert/strict';
import { test } from 'node:test';
import { customersFromOrders, customerTotals, initials, linkCustomer, withOneDefault } from '../src/lib/customers';
import { applyOrderPatch, balanceOf, completeOrder } from '../src/lib/orders';
import { cityGroup, findCity } from '../src/lib/places';
import type { Payment, Shipping } from '../src/lib/types';
import { normalizePhone, validateCustomer, validateOrderPatch } from '../src/lib/validate';

const base = { items: [{ garmentId: 'zayna', name: 'Zayna', size: 'M', color: 'Olive', qty: 1, price: 100 }], total: 100, customerName: 'Sara', phone: '96891234567', city: 'Muscat', address: 'Way 1', note: '', eventDate: null, lang: 'en' as const };

test('an order finds its customer by phone and saves a new address once', () => {
  const now = '2026-11-01T10:00:00Z';
  const first = linkCustomer([], base, now);
  assert.ok(first.created);
  assert.equal(first.customer.addresses.length, 1);
  assert.ok(first.customer.addresses[0].isDefault);
  const again = linkCustomer([first.customer], base, now);
  assert.equal(again.created, false);
  assert.equal(again.changed, false);
  const moved = linkCustomer([first.customer], { ...base, city: 'صلالة', address: 'الحافة' }, now);
  assert.equal(moved.customer.addresses.length, 2);
  assert.equal(moved.customer.addresses.filter(a => a.isDefault).length, 1);
});

test('customers are rebuilt from older orders, and totals skip cancelled orders', () => {
  const o1 = completeOrder({ ...base, status: 'confirmed' }, 1001, '2026-10-01T10:00:00Z');
  const o2 = { ...completeOrder({ ...base, total: 50 }, 1002, '2026-10-05T10:00:00Z'), status: 'cancelled' as const };
  const o3 = completeOrder({ ...base, phone: '96899999999', customerName: 'Huda' }, 1003, '2026-10-06T10:00:00Z');
  const list = customersFromOrders([o3, o1, o2]);
  assert.equal(list.length, 2);
  const t = customerTotals(list, [o1, o2, o3]).get(list.find(c => c.phone === base.phone)!.id)!;
  assert.equal(t.orders, 2);
  assert.equal(t.spent, 100);
  assert.equal(t.owed, 100); // confirmed, nothing paid yet
  assert.equal(t.lastOrderAt, '2026-10-05T10:00:00Z');
});

test('order changes record history, set delivery times and keep payment consistent', () => {
  const o = completeOrder(base, 1001, '2026-10-01T10:00:00Z');
  assert.equal(o.history.length, 1);
  const shipped = applyOrderPatch(o, { status: 'shipped', shipping: { fee: 3 } as Shipping }, '2026-10-02T10:00:00Z');
  assert.equal(shipped.shipping.shippedAt, '2026-10-02T10:00:00Z');
  assert.equal(shipped.history.at(-1)!.status, 'shipped');
  assert.equal(balanceOf(shipped), 103);
  const deposit = applyOrderPatch(shipped, { payment: { status: 'partial', paid: 40 } as Payment }, '2026-10-02T11:00:00Z');
  assert.equal(deposit.payment.status, 'partial');
  assert.equal(balanceOf(deposit), 63);
  const paid = applyOrderPatch(deposit, { payment: { status: 'paid' } as Payment }, '2026-10-03T10:00:00Z');
  assert.equal(paid.payment.paid, 103);
  assert.equal(balanceOf(paid), 0);
  const over = applyOrderPatch(shipped, { payment: { status: 'partial', paid: 150 } as Payment }, '2026-10-02T12:00:00Z');
  assert.deepEqual([over.payment.status, over.payment.paid], ['paid', 103]); // never more than is due
  const back = applyOrderPatch(paid, { status: 'preparing' }, '2026-10-03T11:00:00Z');
  assert.equal(back.shipping.shippedAt, null);
});

test('validation of customers and order changes', () => {
  const ok = validateCustomer({ name: 'Noura', phone: '+968 9123 4567', addresses: [{ city: 'Muscat', line: 'Way 2' }], tags: ['VIP', 'VIP'] });
  assert.ok(ok.ok);
  if (ok.ok) { assert.equal(ok.value.phone, '96891234567'); assert.deepEqual(ok.value.tags, ['VIP']); }
  assert.equal(validateCustomer({ name: 'N', phone: '12' }).ok, false);
  assert.equal(validateOrderPatch({ payment: { status: 'stolen' } }).ok, false);
  // A picked day other than today is stored as noon in Muscat (08:00 UTC).
  const day = validateOrderPatch({ shipping: { shippedAt: '2026-10-05' } });
  assert.ok(day.ok && day.value.shipping?.shippedAt === '2026-10-05T08:00:00.000Z');
  // An Omani number without the country code is the same customer as with it.
  assert.equal(normalizePhone('9123 4567'), '96891234567');
  assert.equal(normalizePhone('+968 9123 4567'), '96891234567');
  assert.equal(normalizePhone('00447700900123'), '447700900123');
});

test('typed cities are matched to known Omani cities', () => {
  assert.equal(findCity('Muscat - Al Khuwair')?.key, 'muscat');
  assert.equal(findCity('صلالة')?.key, 'salalah');
  assert.equal(findCity('نزوی')?.key, 'nizwa');
  assert.equal(cityGroup('').key, 'unknown');
  assert.equal(cityGroup('Doha').name, 'Doha');
  assert.equal(initials('Noura Al-Said'), 'NS');
  assert.equal(withOneDefault([{ id: 'a', label: '', city: '', area: '', line: '', isDefault: false }])[0].isDefault, true);
});
