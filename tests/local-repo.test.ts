import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { LocalRepo } from '../src/lib/db/local';
import { SEED_GARMENTS } from '../src/lib/defaults';

const dirs: string[] = [];
async function repo() {
  const d = await mkdtemp(path.join(os.tmpdir(), 'mezon-'));
  dirs.push(d);
  return new LocalRepo(d);
}
after(async () => { await Promise.all(dirs.map(d => rm(d, { recursive: true, force: true }))); });

const order = { garmentId: 'g1', garmentName: 'Royal', size: 'M', price: 55, customerName: 'Sara', phone: '96891234567', city: '', address: '', note: '', eventDate: null, lang: 'fa' as const };

test('an empty store starts with the seed catalogue', async () => {
  const r = await repo();
  assert.equal((await r.listGarments()).length, SEED_GARMENTS.length);
  assert.equal((await r.listCategories()).length, 2);
  assert.equal((await r.listOrders()).length, 0);
});

test('orders get sequential numbers from 1001, newest first, and concurrent writes are not lost', async () => {
  const r = await repo();
  await Promise.all(Array.from({ length: 10 }, () => r.createOrder(order)));
  const list = await r.listOrders();
  assert.equal(list.length, 10);
  assert.deepEqual(list.map(o => o.id), [1010, 1009, 1008, 1007, 1006, 1005, 1004, 1003, 1002, 1001]);
  assert.equal(list[0].status, 'new');
  const u = await r.updateOrder(1001, { status: 'shipped', adminNote: 'DHL' });
  assert.equal(u?.status, 'shipped');
  assert.equal(await r.updateOrder(9999, { status: 'shipped' }), null);
});

test('reorder and delete garments; deleting a category un-categorises its garments', async () => {
  const r = await repo();
  const ids = (await r.listGarments()).map(g => g.id);
  await r.reorderGarments([...ids].reverse());
  assert.deepEqual((await r.listGarments()).map(g => g.id), [...ids].reverse());
  await r.deleteGarment(ids[0]);
  assert.equal((await r.listGarments()).length, ids.length - 1);
  await r.deleteCategory('c2');
  assert.equal((await r.getGarment('g8'))?.categoryId, null);
});

test('create/update keep id, sort and createdAt under server control', async () => {
  const r = await repo();
  const { id: _id, sort: _sort, createdAt: _c, ...input } = SEED_GARMENTS[0];
  const g = await r.createGarment({ ...input, name: { fa: 'تازه', ar: '', en: '' } });
  assert.match(g.id, /^g/);
  assert.equal(g.sort, SEED_GARMENTS.length + 1);
  const u = await r.updateGarment(g.id, { ...g, price: 99 });
  assert.equal(u?.price, 99);
  assert.equal(u?.createdAt, g.createdAt);
});

test('uploadImage refuses path traversal and stores under uploads/', async () => {
  const r = await repo();
  const url = await r.uploadImage(new Uint8Array([1, 2, 3]), 'image/png', '../../etc/x.png');
  assert.match(url, /^\/uploads\/etc\/x\.png\?v=\d+$/);
  assert.deepEqual([...(await readFile(path.join(r.uploadsDir, 'etc', 'x.png')))], [1, 2, 3]);
  await assert.rejects(r.uploadImage(new Uint8Array([1]), 'image/png', '../..'));
});
