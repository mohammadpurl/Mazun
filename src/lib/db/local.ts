/* Local development store: one JSON file plus an uploads folder. Not for production — serverless
   hosts do not keep files, and there is no locking across processes. */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { DEFAULT_SETTINGS, SEED_CATEGORIES, SEED_GARMENTS, withDefaults } from '../defaults';
import type { Category, Garment, Order, Settings } from '../types';
import { bySort, type Repo } from './repo';

interface Data {
  categories: Category[];
  garments: Garment[];
  orders: Order[];
  settings: Settings;
  nextOrderId: number;
}

const seed = (): Data => ({
  categories: structuredClone(SEED_CATEGORIES),
  garments: structuredClone(SEED_GARMENTS),
  orders: [],
  settings: structuredClone(DEFAULT_SETTINGS),
  nextOrderId: 1001,
});

const newId = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export class LocalRepo implements Repo {
  readonly kind = 'local' as const;
  private queue: Promise<unknown> = Promise.resolve();

  /** @param dir folder holding store.json and uploads/ */
  constructor(private dir: string, private uploadUrlPrefix = '/uploads') {}

  private get file() { return path.join(this.dir, 'store.json'); }
  get uploadsDir() { return path.join(this.dir, 'uploads'); }

  private async read(): Promise<Data> {
    try {
      const d = JSON.parse(await fs.readFile(this.file, 'utf8')) as Data;
      d.settings = withDefaults(d.settings);
      return d;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      return seed();
    }
  }

  /** Serialises writes in this process so two requests cannot overwrite each other's changes. */
  private write<T>(fn: (d: Data) => T): Promise<T> {
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
  createOrder(order: Parameters<Repo['createOrder']>[0]) {
    return this.write(d => {
      const now = new Date().toISOString();
      const o: Order = { ...order, id: d.nextOrderId++, status: 'new', adminNote: '', createdAt: now, updatedAt: now };
      d.orders.push(o);
      return o;
    });
  }
  updateOrder(id: number, patch: Parameters<Repo['updateOrder']>[1]) {
    return this.write(d => {
      const o = d.orders.find(x => x.id === id);
      if (!o) return null;
      Object.assign(o, patch, { updatedAt: new Date().toISOString() });
      return o;
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
