import assert from 'node:assert/strict';
import { test } from 'node:test';
import { linkCustomer, MAX_ADDRESSES } from '../src/lib/customers';
import { customerMessage, stageOf } from '../src/lib/order-message';
import { applyOrderPatch, balanceOf, buildAdminItems, completeOrder, isSale, OrderRuleError, overpaidOn, owedOn } from '../src/lib/orders';
import type { Garment, NewOrder, Order } from '../src/lib/types';
import { validateAdminOrder, validateCustomer, validateOrderPatch } from '../src/lib/validate';
import { numInput } from '../src/components/admin/ui/format';

const T0 = '2026-11-01T10:00:00.000Z';
const T1 = '2026-11-02T10:00:00.000Z';
const item = { garmentId: 'zayna', name: 'Zayna', size: 'M', color: 'Olive', qty: 1, price: 100 };
const make = (over: Partial<NewOrder> = {}): Order => completeOrder({
  items: [item], total: 100, customerName: 'Sara', phone: '96891234567', city: 'Muscat', address: 'Way 1', note: '', eventDate: null, lang: 'en', ...over,
}, 1001, T0);

test('editing a paid order upwards leaves the difference owed, not paid', () => {
  const paid = make({ status: 'confirmed', payment: { status: 'paid', method: 'cash', paid: 100, paidAt: null } });
  const more = applyOrderPatch(paid, { edit: { ...paid, items: [{ ...item, price: 150 }], total: 150 } }, T1);
  assert.equal(more.payment.status, 'partial');
  assert.equal(more.payment.paid, 100);
  assert.equal(balanceOf(more), 50);
  const fee = applyOrderPatch(paid, { shipping: { fee: 5 } }, T1);
  assert.equal(fee.payment.paid, 100);
  assert.equal(balanceOf(fee), 5);
});

test('editing an order below its deposit shows the overpayment instead of dropping it', () => {
  const dep = make({ status: 'confirmed', payment: { status: 'partial', method: 'cash', paid: 60, paidAt: null } });
  const less = applyOrderPatch(dep, { edit: { ...dep, items: [{ ...item, price: 40 }], total: 40 } }, T1);
  assert.equal(less.payment.paid, 60);
  assert.equal(overpaidOn(less), 20);
  assert.equal(balanceOf(less), 0);
});

test('delivered back to shipped clears the delivery time instead of failing', () => {
  const o = make({ status: 'confirmed' });
  const shipped = applyOrderPatch(o, { status: 'shipped', shipping: { shippedAt: '2026-11-01T08:00:00.000Z' } }, T0);
  const delivered = applyOrderPatch(shipped, { status: 'delivered' }, T1);
  const again = applyOrderPatch(delivered, { status: 'shipped', shipping: { shippedAt: '2026-11-03T08:00:00.000Z' } }, '2026-11-03T09:00:00.000Z');
  assert.equal(again.shipping.deliveredAt, null);
});

test('delivered on the same day as shipped is kept; an earlier day is refused', () => {
  const o = applyOrderPatch(make({ status: 'confirmed' }), { status: 'shipped', shipping: { shippedAt: '2026-11-01T14:23:00.000Z' } }, T1);
  const same = applyOrderPatch(o, { status: 'delivered', shipping: { deliveredAt: '2026-11-01T08:00:00.000Z' } }, T1);
  assert.equal(same.shipping.deliveredAt, '2026-11-01T14:23:00.000Z');
  // Mixed offsets compare as times, not text.
  const mixed = applyOrderPatch(o, { status: 'delivered', shipping: { deliveredAt: '2026-11-01T19:00:00+00:00' } }, T1);
  assert.equal(mixed.shipping.deliveredAt, '2026-11-01T19:00:00+00:00');
  assert.throws(() => applyOrderPatch(o, { status: 'delivered', shipping: { deliveredAt: '2026-10-30T08:00:00.000Z' } }, T1), OrderRuleError);
});

test('a reopened refunded order starts unpaid and counts again', () => {
  const o = make({ status: 'confirmed', payment: { status: 'partial', method: 'cash', paid: 40, paidAt: null } });
  const cancelled = applyOrderPatch(o, { status: 'cancelled', payment: { status: 'refunded' } }, T1);
  assert.equal(isSale(cancelled), false);
  const back = applyOrderPatch(applyOrderPatch(cancelled, { status: 'new' }, T1), { status: 'confirmed' }, T1);
  assert.equal(back.payment.status, 'unpaid');
  assert.equal(back.payment.paid, 0);
  assert.ok(isSale(back));
  assert.equal(owedOn(back), 100);
});

test('a step limited to some statuses refuses an order that has moved on', () => {
  const shipped = applyOrderPatch(make({ status: 'confirmed' }), { status: 'shipped' }, T1);
  assert.throws(() => applyOrderPatch(shipped, { status: 'confirmed', onlyFrom: ['new'] }, T1), OrderRuleError);
  assert.equal(applyOrderPatch(make(), { status: 'confirmed', onlyFrom: ['new'] }, T1).status, 'confirmed');
});

test('new orders owe nothing yet but their balance is still known', () => {
  const o = make();
  assert.equal(isSale(o), false);
  assert.equal(owedOn(o), 0);
  assert.equal(balanceOf(o), 100);
});

test('only real calendar days are accepted', () => {
  assert.equal(validateOrderPatch({ shipping: { shippedAt: '2026-02-30' } }).ok, false);
  const good = validateOrderPatch({ shipping: { shippedAt: '2026-02-28' } });
  assert.ok(good.ok && good.value.shipping?.shippedAt?.startsWith('2026-02-28'));
});

test('an admin order total must fit the stored amount', () => {
  const r = validateAdminOrder({ customerName: 'Sara', phone: '96891234567', lines: [{ garmentId: 'x', name: 'x', size: 'M', qty: 50, price: 9_999_999 }] });
  assert.equal(r.ok, false);
});

test('admin lines take the catalogue name in the order language and keep deleted products', () => {
  const g = { id: 'zayna', name: { en: 'Zayna', ar: 'زينة', fa: 'زینا' } } as unknown as Garment;
  const out = buildAdminItems([
    { garmentId: 'zayna', name: '?', size: 'M', color: 'Olive', qty: 1, price: 90 },
    { garmentId: 'gone', name: 'Old', size: 'S', color: '', qty: 2, price: 10 },
  ], [g], 'ar');
  assert.equal(out[0].name, 'زينة');
  assert.equal(out[1].name, 'Old');
});

test('a customer keeps at most ten addresses; the admin is told rather than losing one', () => {
  let c = linkCustomer([], { customerName: 'Sara', phone: '96891234567', city: 'City 0', address: 'Way' }, T0).customer;
  for (let i = 1; i < MAX_ADDRESSES + 3; i++) c = linkCustomer([c], { customerName: 'Sara', phone: c.phone, city: `City ${i}`, address: 'Way' }, T0).customer;
  assert.equal(c.addresses.length, MAX_ADDRESSES);
  const r = validateCustomer({ name: 'Sara', phone: c.phone, addresses: [...c.addresses, { city: 'One more', line: 'x' }] });
  assert.equal(r.ok, false);
});

test('money typed with thousands separators keeps its value', () => {
  assert.equal(numInput('1,500'), '1500');
  assert.equal(numInput('۱٫۵'), '1.5');
  assert.equal(numInput('١٬٢٠٠'), '1200');
  assert.equal(numInput('۱۲/۵۰۰'), '12.500');
});

test('messages follow the order stage and use the shop name from settings', () => {
  const o = make({ status: 'delivered' });
  assert.equal(stageOf({ ...o, owed: 0 }), 'thanks');
  assert.equal(stageOf({ ...o, owed: 5 }), 'balance');
  const msg = customerMessage(o, 'thanks', { owed: 0, currency: { en: 'OMR', ar: 'ر.ع', fa: 'ریال' }, brand: { en: 'MAZUN ATELIER', ar: 'مزون', fa: 'مزون' } });
  assert.match(msg, /Mazun Atelier/);
});
