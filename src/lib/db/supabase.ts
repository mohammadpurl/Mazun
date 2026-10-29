/* Production store on Supabase. Uses the service-role key on the server only; the tables have RLS
   on with no policies, so the browser (anon key) cannot read or write anything directly.
   Schema: supabase/schema.sql. Translated fields ({en, ar, fa}) are jsonb columns. */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_SETTINGS, SEED_CATEGORIES, SEED_GARMENTS, withDefaults } from '../defaults';
import type { Category, CategoryInput, Garment, GarmentInput, L10n, NewOrder, Order, OrderPatch, Settings } from '../types';
import type { Repo } from './repo';

type Row = Record<string, unknown>;
const BUCKET = 'garments';

const tx = (v: unknown): L10n => { const o = (v ?? {}) as Partial<L10n>; return { en: o.en ?? '', ar: o.ar ?? '', fa: o.fa ?? '' }; };

const toCategory = (r: Row): Category => ({
  id: String(r.id), name: tx(r.name), description: tx(r.description), image: String(r.image ?? ''),
  sort: Number(r.sort ?? 0), visible: r.visible !== false,
});
const fromCategory = (c: CategoryInput) => ({
  name: c.name, description: c.description, image: c.image, visible: c.visible, ...(c.sort != null && { sort: c.sort }),
});

const toGarment = (r: Row): Garment => ({
  id: String(r.id), kind: (r.kind as Garment['kind']) ?? 'garment', categoryId: r.category_id == null ? null : String(r.category_id),
  name: tx(r.name), type: tx(r.type), description: tx(r.description), fabric: tx(r.fabric), note: tx(r.note),
  price: Number(r.price ?? 0), salePrice: r.sale_price == null ? null : Number(r.sale_price),
  colors: Array.isArray(r.colors) ? (r.colors as Garment['colors']) : [],
  sizes: Array.isArray(r.sizes) ? (r.sizes as Garment['sizes']) : [],
  shape: (r.shape as Garment['shape']) ?? 'abaya', front: String(r.front ?? ''), back: String(r.back ?? ''), detail: String(r.detail ?? ''),
  chart: (r.chart as Garment['chart']) ?? null, leadDays: Number(r.lead_days ?? 0), isNew: r.is_new === true,
  sort: Number(r.sort ?? 0), visible: r.visible !== false, createdAt: String(r.created_at ?? ''),
});
const fromGarment = (g: GarmentInput) => ({
  kind: g.kind, category_id: g.categoryId, name: g.name, type: g.type, description: g.description, fabric: g.fabric, note: g.note,
  price: g.price, sale_price: g.salePrice, colors: g.colors, sizes: g.sizes, shape: g.shape,
  front: g.front, back: g.back, detail: g.detail, chart: g.chart, lead_days: g.leadDays, is_new: g.isNew, visible: g.visible,
  ...(g.sort != null && { sort: g.sort }),
});

const toOrder = (r: Row): Order => ({
  id: Number(r.id), items: Array.isArray(r.items) ? (r.items as Order['items']) : [], total: Number(r.total ?? 0),
  customerName: String(r.customer_name ?? ''), phone: String(r.phone ?? ''), city: String(r.city ?? ''),
  address: String(r.address ?? ''), note: String(r.note ?? ''), eventDate: (r.event_date as string | null) ?? null,
  lang: (r.lang as Order['lang']) ?? 'en', status: (r.status as Order['status']) ?? 'new', adminNote: String(r.admin_note ?? ''),
  createdAt: String(r.created_at ?? ''), updatedAt: String(r.updated_at ?? ''),
});

type Q = PromiseLike<{ data: unknown; error: { message: string } | null }>;

export class SupabaseRepo implements Repo {
  readonly kind = 'supabase' as const;
  private sb: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  private async rows<T>(q: Q, map: (r: Row) => T): Promise<T[]> {
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return ((data as Row[]) ?? []).map(map);
  }
  private async one<T>(q: Q, map: (r: Row) => T): Promise<T | null> {
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ? map(data as Row) : null;
  }
  private async check(q: Q) {
    const { error } = await q;
    if (error) throw new Error(error.message);
  }
  private async reorder(table: string, ids: string[]) {
    const results = await Promise.all(ids.map((id, i) => this.sb.from(table).update({ sort: i + 1 }).eq('id', id)));
    const err = results.find(r => r.error)?.error;
    if (err) throw new Error(err.message);
  }
  private async nextSort(table: string) {
    const { data } = await this.sb.from(table).select('sort').order('sort', { ascending: false }).limit(1);
    return Number((data as Row[] | null)?.[0]?.sort ?? 0) + 1;
  }

  listCategories() { return this.rows(this.sb.from('categories').select('*').order('sort').order('id'), toCategory); }
  async createCategory(input: CategoryInput) {
    const sort = input.sort ?? await this.nextSort('categories');
    return (await this.one(this.sb.from('categories').insert({ ...fromCategory(input), sort }).select().single(), toCategory))!;
  }
  updateCategory(id: string, input: CategoryInput) {
    return this.one(this.sb.from('categories').update(fromCategory(input)).eq('id', id).select().maybeSingle(), toCategory);
  }
  // garments.category_id is "on delete set null", so garments survive.
  deleteCategory(id: string) { return this.check(this.sb.from('categories').delete().eq('id', id)); }
  reorderCategories(ids: string[]) { return this.reorder('categories', ids); }

  listGarments() { return this.rows(this.sb.from('garments').select('*').order('sort').order('id'), toGarment); }
  getGarment(id: string) { return this.one(this.sb.from('garments').select('*').eq('id', id).maybeSingle(), toGarment); }
  async createGarment(input: GarmentInput) {
    const sort = input.sort ?? await this.nextSort('garments');
    return (await this.one(this.sb.from('garments').insert({ ...fromGarment(input), sort }).select().single(), toGarment))!;
  }
  updateGarment(id: string, input: GarmentInput) {
    return this.one(this.sb.from('garments').update(fromGarment(input)).eq('id', id).select().maybeSingle(), toGarment);
  }
  deleteGarment(id: string) { return this.check(this.sb.from('garments').delete().eq('id', id)); }
  reorderGarments(ids: string[]) { return this.reorder('garments', ids); }

  listOrders() { return this.rows(this.sb.from('orders').select('*').order('id', { ascending: false }).limit(5000), toOrder); }
  async createOrder(o: NewOrder) {
    const row = {
      items: o.items, total: o.total, customer_name: o.customerName, phone: o.phone, city: o.city, address: o.address,
      note: o.note, event_date: o.eventDate, lang: o.lang,
    };
    return (await this.one(this.sb.from('orders').insert(row).select().single(), toOrder))!;
  }
  updateOrder(id: number, patch: OrderPatch) {
    const row: Row = { updated_at: new Date().toISOString() };
    if (patch.status) row.status = patch.status;
    if (patch.adminNote !== undefined) row.admin_note = patch.adminNote;
    return this.one(this.sb.from('orders').update(row).eq('id', id).select().maybeSingle(), toOrder);
  }

  async getSettings() {
    const { data, error } = await this.sb.from('settings').select('data').eq('id', 1).maybeSingle();
    if (error) throw new Error(error.message);
    return withDefaults((data?.data as Partial<Settings>) ?? null);
  }
  async saveSettings(s: Settings) {
    await this.check(this.sb.from('settings').upsert({ id: 1, data: s, updated_at: new Date().toISOString() }));
    return s;
  }

  async uploadImage(bytes: Uint8Array, contentType: string, path: string) {
    const { error } = await this.sb.storage.from(BUCKET).upload(path, bytes, { upsert: true, contentType, cacheControl: '31536000' });
    if (error) throw new Error(error.message);
    return this.sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
  }

  /** Problems that would break the shop: missing tables (schema.sql not run) or a missing / private image bucket. */
  async healthCheck(): Promise<string[]> {
    const problems: string[] = [];
    for (const t of ['categories', 'garments', 'orders', 'settings']) {
      // A real (1-row) read: head-only requests do not report a missing table.
      const { error } = await this.sb.from(t).select('*').limit(1);
      if (error) problems.push(`table "${t}": ${error.message} — run supabase/schema.sql in the SQL Editor`);
    }
    const { data, error } = await this.sb.storage.getBucket(BUCKET);
    if (error || !data) problems.push(`storage bucket "${BUCKET}" not found — run supabase/schema.sql`);
    else if (!data.public) problems.push(`storage bucket "${BUCKET}" is private — images would not show; make it public`);
    return problems;
  }

  /** Loads the design's starter catalogue into empty tables (scripts/seed-supabase.ts). Returns what was inserted. */
  async seedIfEmpty(): Promise<string[]> {
    const done: string[] = [];
    const count = async (t: string) => (await this.sb.from(t).select('id', { count: 'exact', head: true })).count ?? 0;
    if (!(await count('categories'))) {
      await this.check(this.sb.from('categories').insert(SEED_CATEGORIES.map(c => ({ id: c.id, ...fromCategory(c), sort: c.sort }))));
      done.push(`${SEED_CATEGORIES.length} collections`);
    }
    if (!(await count('garments'))) {
      await this.check(this.sb.from('garments').insert(SEED_GARMENTS.map(g => ({ id: g.id, ...fromGarment(g), sort: g.sort }))));
      done.push(`${SEED_GARMENTS.length} products`);
    }
    const { data } = await this.sb.from('settings').select('id').eq('id', 1).maybeSingle();
    if (!data) { await this.saveSettings(DEFAULT_SETTINGS); done.push('settings'); }
    return done;
  }
}
