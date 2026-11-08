/* Local development store: one JSON file plus an uploads folder. Not for production — serverless
   hosts do not keep files, and there is no locking across processes. */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { customersFromOrders, linkCustomer, newId, withOneDefault } from '../customers';
import { DEFAULT_SETTINGS, SEED_CATEGORIES, SEED_GARMENTS, withDefaults } from '../defaults';
import { applyOrderPatch, completeOrder, upgradeOrder } from '../orders';
import type { Category, Customer, CustomerInput, Garment, Order, Settings } from '../types';
import { bySort, ConflictError, newestFirst, type Repo } from './repo';

interface Data {
  categories: Category[];
  garments: Garment[];
  orders: Order[];
  /** Missing in stores written before customer records existed; rebuilt from the orders on first read. */
  customers?: Customer[];
  settings: Settings;
  nextOrderId: number;
}
type Full = Data & { customers: Customer[] };

const seed = (): Full => ({
  categories: structuredClone(SEED_CATEGORIES),
  garments: structuredClone(SEED_GARMENTS),
  orders: [],
  customers: [],
  settings: structuredClone(DEFAULT_SETTINGS),
  nextOrderId: 1001,
});

/** Brings an older store up to date: gallery lists, order payment/shipping/history, and customer records. */
function upgrade(d: Data): Full {
  d.settings = withDefaults(d.settings);
  d.garments = d.garments.map(g => ({ ...g, images: Array.isArray(g.images) ? g.images : [] }));
  d.orders = d.orders.map(upgradeOrder);
  if (!Array.isArray(d.customers)) {
    // Ids from the phone number, so they stay the same on every read until the store is next written.
    d.customers = customersFromOrders(d.orders, phone => 'u' + phone);
    const byPhone = new Map(d.customers.map(c => [c.phone, c.id]));
    d.orders.forEach(o => { o.customerId ??= byPhone.get(o.phone) ?? null; });
  }
  return d as Full;
}

const cleanCustomer = (input: CustomerInput) => ({ ...input, addresses: withOneDefault(input.addresses) });

export class LocalRepo implements Repo {
  readonly kind = 'local' as const;
  private queue: Promise<unknown> = Promise.resolve();

  /** @param dir folder holding store.json and uploads/ */
  constructor(private dir: string, private uploadUrlPrefix = '/uploads') {}

  private get file() { return path.join(this.dir, 'store.json'); }
  get uploadsDir() { return path.join(this.dir, 'uploads'); }

  private async read(): Promise<Full> {
    try {
      return upgrade(JSON.parse(await fs.readFile(this.file, 'utf8')) as Data);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      return seed();
    }
  }

  /** Serialises writes in this process so two requests cannot overwrite each other's changes. */
  private write<T>(fn: (d: Full) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const d = await this.read();
      const out = fn(d);
      await fs.mkdir(this.dir, { recursive: true });
      const tmp = this.file + '.tmp';
      await fs.writeFile(tmp, JSON.stringify(d, null, 2));
      await fs.rename(tmp, this.file);
      return out;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Replaces the whole store (the demo-data script). */
  replaceAll(d: Full) { return this.write(cur => { Object.assign(cur, d); }); }

  async listCategories() { return (await this.read()).categories.sort(bySort); }
  createCategory(input: Parameters<Repo['createCategory']>[0]) {
    return this.write(d => {
      const c: Category = { ...input, id: newId('c'), sort: input.sort ?? Math.max(0, ...d.categories.map(x => x.sort)) + 1 };
      d.categories.push(c);
      return c;
    });
  }
  updateCategory(id: string, input: Parameters<Repo['updateCategory']>[1]) {
    return this.write(d => {
      const c = d.categories.find(x => x.id === id);
      if (!c) return null;
      Object.assign(c, input, { id, sort: input.sort ?? c.sort });
      return c;
    });
  }
  async deleteCategory(id: string) {
    await this.write(d => {
      d.categories = d.categories.filter(x => x.id !== id);
      d.garments.forEach(g => { if (g.categoryId === id) g.categoryId = null; });
    });
  }
  async reorderCategories(ids: string[]) {
    await this.write(d => d.categories.forEach(c => { const i = ids.indexOf(c.id); if (i >= 0) c.sort = i + 1; }));
  }

  async listGarments() { return (await this.read()).garments.sort(bySort); }
  async getGarment(id: string) { return (await this.read()).garments.find(g => g.id === id) ?? null; }
  createGarment(input: Parameters<Repo['createGarment']>[0]) {
    return this.write(d => {
      const g: Garment = { ...input, id: newId('g'), sort: input.sort ?? Math.max(0, ...d.garments.map(x => x.sort)) + 1, createdAt: new Date().toISOString() };
      d.garments.push(g);
      return g;
    });
  }
  updateGarment(id: string, input: Parameters<Repo['updateGarment']>[1]) {
    return this.write(d => {
      const g = d.garments.find(x => x.id === id);
      if (!g) return null;
      Object.assign(g, input, { id, sort: input.sort ?? g.sort, createdAt: g.createdAt });
      return g;
    });
  }
  async deleteGarment(id: string) { await this.write(d => { d.garments = d.garments.filter(g => g.id !== id); }); }
  async reorderGarments(ids: string[]) {
    await this.write(d => d.garments.forEach(g => { const i = ids.indexOf(g.id); if (i >= 0) g.sort = i + 1; }));
  }

  async listOrders() { return (await this.read()).orders.sort((a, b) => b.id - a.id); }
  async getOrder(id: number) { return (await this.read()).orders.find(o => o.id === id) ?? null; }
  createOrder(order: Parameters<Repo['createOrder']>[0]) {
    return this.write(d => {
      const now = new Date().toISOString();
      const chosen = order.customerId ? d.customers.find(c => c.id === order.customerId) : undefined;
      const { customer, created, changed } = linkCustomer(chosen ? [chosen] : d.customers, chosen ? { ...order, phone: chosen.phone } : order, now);
      if (created) d.customers.push(customer);
      else if (changed) d.customers = d.customers.map(c => (c.id === customer.id ? customer : c));
      const o = completeOrder({ ...order, customerId: customer.id }, d.nextOrderId++, now);
      d.orders.push(o);
      return o;
    });
  }
  linkCustomer(o: Parameters<Repo['linkCustomer']>[0]) {
    return this.write(d => {
      const chosen = o.customerId ? d.customers.find(c => c.id === o.customerId) : undefined;
      const { customer, created, changed } = linkCustomer(chosen ? [chosen] : d.customers, chosen ? { ...o, phone: chosen.phone } : o, new Date().toISOString());
      if (created) d.customers.push(customer);
      else if (changed) d.customers = d.customers.map(c => (c.id === customer.id ? customer : c));
      return customer.id;
    });
  }
  updateOrder(id: number, patch: Parameters<Repo['updateOrder']>[1]) {
    return this.write(d => {
      const i = d.orders.findIndex(x => x.id === id);
      if (i < 0) return null;
      d.orders[i] = applyOrderPatch(d.orders[i], patch, new Date().toISOString());
      return d.orders[i];
    });
  }

  async listCustomers() { return (await this.read()).customers.sort(newestFirst); }
  async getCustomer(id: string) { return (await this.read()).customers.find(c => c.id === id) ?? null; }
  createCustomer(input: CustomerInput) {
    return this.write(d => {
      if (d.customers.some(c => c.phone === input.phone)) throw new ConflictError('phone', 'مشتری دیگری با این شماره ثبت شده است');
      const now = new Date().toISOString();
      const c: Customer = { ...cleanCustomer(input), id: newId('u'), createdAt: now, updatedAt: now };
      d.customers.push(c);
      return c;
    });
  }
  updateCustomer(id: string, input: CustomerInput) {
    return this.write(d => {
      const i = d.customers.findIndex(c => c.id === id);
      if (i < 0) return null;
      if (d.customers.some(c => c.id !== id && c.phone === input.phone)) throw new ConflictError('phone', 'مشتری دیگری با این شماره ثبت شده است');
      d.customers[i] = { ...d.customers[i], ...cleanCustomer(input), updatedAt: new Date().toISOString() };
      return d.customers[i];
    });
  }
  async deleteCustomer(id: string) {
    await this.write(d => {
      d.customers = d.customers.filter(c => c.id !== id);
      d.orders.forEach(o => { if (o.customerId === id) o.customerId = null; });
    });
  }

  async getSettings() { return (await this.read()).settings; }
  saveSettings(s: Settings) { return this.write(d => (d.settings = s)); }

  async uploadImage(bytes: Uint8Array, _contentType: string, rel: string) {
    const safe = rel.split('/').filter(p => p && p !== '..' && /^[\w.-]+$/.test(p)).join('/');
    if (!safe) throw new Error('bad upload path');
    const full = path.join(this.uploadsDir, safe);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, bytes);
    return `${this.uploadUrlPrefix}/${safe}?v=${Date.now()}`;
  }
}
