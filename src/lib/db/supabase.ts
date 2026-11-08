/* Production store on Supabase. Uses the service-role key on the server only; the tables have RLS
   on with no policies, so the browser (anon key) cannot read or write anything directly.
   Schema: supabase/schema.sql. Translated fields ({en, ar, fa}) are jsonb columns. */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { linkCustomer, withOneDefault } from '../customers';
import { DEFAULT_SETTINGS, SEED_CATEGORIES, SEED_GARMENTS, withDefaults } from '../defaults';
import { applyOrderPatch, completeOrder, upgradeOrder } from '../orders';
import type { Category, CategoryInput, Customer, CustomerInput, Garment, GarmentInput, L10n, NewOrder, Order, OrderPatch, Settings } from '../types';
import { ConflictError, type Repo } from './repo';

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
  wornFront: String(r.worn_front ?? ''), wornBack: String(r.worn_back ?? ''),
  images: Array.isArray(r.images) ? (r.images as unknown[]).filter((x): x is string => typeof x === 'string') : [],
  chart: (r.chart as Garment['chart']) ?? null, leadDays: Number(r.lead_days ?? 0), isNew: r.is_new === true,
  sort: Number(r.sort ?? 0), visible: r.visible !== false, createdAt: String(r.created_at ?? ''),
});
const fromGarment = (g: GarmentInput) => ({
  kind: g.kind, category_id: g.categoryId, name: g.name, type: g.type, description: g.description, fabric: g.fabric, note: g.note,
  price: g.price, sale_price: g.salePrice, colors: g.colors, sizes: g.sizes, shape: g.shape,
  front: g.front, back: g.back, detail: g.detail, chart: g.chart, lead_days: g.leadDays, is_new: g.isNew, visible: g.visible,
  ...(g.sort != null && { sort: g.sort }),
});

const toOrder = (r: Row): Order => upgradeOrder({
  id: Number(r.id), customerId: r.customer_id == null ? null : String(r.customer_id),
  items: Array.isArray(r.items) ? (r.items as Order['items']) : [], total: Number(r.total ?? 0),
  customerName: String(r.customer_name ?? ''), phone: String(r.phone ?? ''), city: String(r.city ?? ''),
  address: String(r.address ?? ''), note: String(r.note ?? ''), eventDate: (r.event_date as string | null) ?? null,
  lang: (r.lang as Order['lang']) ?? 'en', status: (r.status as Order['status']) ?? 'new', adminNote: String(r.admin_note ?? ''),
  payment: r.payment as Order['payment'], shipping: r.shipping as Order['shipping'], history: r.history as Order['history'],
  createdAt: String(r.created_at ?? ''), updatedAt: String(r.updated_at ?? ''),
});
const fromOrderState = (o: Order) => ({
  status: o.status, admin_note: o.adminNote, payment: o.payment, shipping: o.shipping, history: o.history, updated_at: o.updatedAt,
});

const toCustomer = (r: Row): Customer => ({
  id: String(r.id), name: String(r.name ?? ''), phone: String(r.phone ?? ''), email: String(r.email ?? ''),
  tags: Array.isArray(r.tags) ? (r.tags as string[]) : [], addresses: Array.isArray(r.addresses) ? (r.addresses as Customer['addresses']) : [],
  notes: Array.isArray(r.notes) ? (r.notes as Customer['notes']) : [], createdAt: String(r.created_at ?? ''), updatedAt: String(r.updated_at ?? ''),
});
const fromCustomer = (c: CustomerInput) => ({
  name: c.name, phone: c.phone, email: c.email, tags: c.tags, addresses: withOneDefault(c.addresses), notes: c.notes,
});
/** Postgres "unique violation": another customer has this phone. */
const isDuplicate = (e: { code?: string } | null) => e?.code === '23505';
const UPGRADE = 'پایگاه داده به‌روز نیست: فایل supabase/schema.sql را یک بار دیگر در SQL Editor اجرا کنید';

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
  /** The worn-photo columns came later (supabase/schema.sql); a database without them still saves everything else. */
  private wornCols?: Promise<boolean>;
  private async withWorn(g: GarmentInput) {
    // Only "no such column" is remembered; a network blip is asked again next time rather than dropping photos.
    this.wornCols ??= Promise.resolve(this.sb.from('garments').select('worn_front').limit(1)).then(r => {
      if (!r.error) return true;
      if (r.error.code === '42703' || r.error.code === 'PGRST204') return false;
      this.wornCols = undefined;
      return true;
    });
    const row: Row = fromGarment(g);
    if (await this.wornCols) Object.assign(row, { worn_front: g.wornFront ?? '', worn_back: g.wornBack ?? '' });
    else if (g.wornFront || g.wornBack) throw new Error('worn_front/worn_back columns are missing — run supabase/schema.sql');
    if (await this.has('garments', 'images')) row.images = g.images ?? [];
    else if (g.images?.length) throw new Error(UPGRADE);
    return row;
  }
  async createGarment(input: GarmentInput) {
    const sort = input.sort ?? await this.nextSort('garments');
    return (await this.one(this.sb.from('garments').insert({ ...(await this.withWorn(input)), sort }).select().single(), toGarment))!;
  }
  async updateGarment(id: string, input: GarmentInput) {
    return this.one(this.sb.from('garments').update(await this.withWorn(input)).eq('id', id).select().maybeSingle(), toGarment);
  }
  deleteGarment(id: string) { return this.check(this.sb.from('garments').delete().eq('id', id)); }
  reorderGarments(ids: string[]) { return this.reorder('garments', ids); }

  /** Columns and tables added after the first release (supabase/schema.sql). A database without them keeps working
   *  for what it has. "Present" is remembered for good; "missing" for a minute only, so running schema.sql takes
   *  effect without a restart; a network blip is not remembered at all. */
  private probes = new Map<string, { p: Promise<boolean> }>();
  private has(table: string, column = 'id') {
    const k = table + '.' + column;
    const hit = this.probes.get(k);
    if (hit) return hit.p;
    const p = Promise.resolve(this.sb.from(table).select(column).limit(1)).then(r => {
      if (!r.error) return true;
      if (['42703', 'PGRST204', '42P01', 'PGRST205'].includes(r.error.code)) { setTimeout(() => this.probes.delete(k), 60_000); return false; }
      this.probes.delete(k);
      return true;
    });
    this.probes.set(k, { p });
    return p;
  }

  /** Every row of a query, a page at a time: the project's "max rows" setting (1000 by default) caps a single read. */
  private async all<T>(make: (from: number, to: number) => Q, map: (r: Row) => T, page = 1000): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += page) {
      const { data, error } = await make(from, from + page - 1);
      if (error) throw new Error(error.message);
      const rows = (data as Row[]) ?? [];
      out.push(...rows.map(map));
      if (rows.length < page) return out;
    }
  }

  listOrders() { return this.all((a, b) => this.sb.from('orders').select('*').order('id', { ascending: false }).range(a, b), toOrder); }
  getOrder(id: number) { return this.one(this.sb.from('orders').select('*').eq('id', id).maybeSingle(), toOrder); }
  async createOrder(o: NewOrder) {
    const row: Row = {
      items: o.items, total: o.total, customer_name: o.customerName, phone: o.phone, city: o.city, address: o.address,
      note: o.note, event_date: o.eventDate, lang: o.lang,
    };
    if (await this.has('orders', 'payment')) {
      // Linking to a customer must never stop an order from being saved.
      const customerId = await this.linkCustomer(o).catch(e => { console.error('order saved without customer link:', e); return null; });
      const done = completeOrder({ ...o, customerId }, 0, new Date().toISOString());
      Object.assign(row, { customer_id: customerId, ...fromOrderState(done) });
      delete row.updated_at;
    }
    return (await this.one(this.sb.from('orders').insert(row).select().single(), toOrder))!;
  }
  /** Finds or creates the order's customer and saves a new delivery address; returns her id. */
  async linkCustomer(o: Pick<NewOrder, 'customerId' | 'customerName' | 'phone' | 'city' | 'address'>): Promise<string | null> {
    if (!(await this.has('customers'))) return null;
    const now = new Date().toISOString();
    const q = o.customerId ? this.sb.from('customers').select('*').eq('id', o.customerId) : this.sb.from('customers').select('*').eq('phone', o.phone);
    const found = await this.rows(q.limit(1), toCustomer);
    const { customer, created, changed } = linkCustomer(found, found[0] ? { ...o, phone: found[0].phone } : o, now);
    if (created) {
      const ins = await this.sb.from('customers').insert(fromCustomer(customer)).select('id').single();
      if (isDuplicate(ins.error)) return (await this.rows(this.sb.from('customers').select('*').eq('phone', o.phone).limit(1), toCustomer))[0]?.id ?? null;
      if (ins.error) throw new Error(ins.error.message);
      return String((ins.data as Row).id);
    }
    if (changed) await this.check(this.sb.from('customers').update({ name: customer.name, addresses: customer.addresses, updated_at: now }).eq('id', customer.id));
    return customer.id;
  }
  /** Read, change, write back only if nobody else wrote in between (same updated_at); otherwise read again and redo
   *  the change, so two people saving the same order never drop each other's history or payment. */
  async updateOrder(id: number, patch: OrderPatch) {
    const v2 = await this.has('orders', 'payment');
    if (!v2 && (patch.payment || patch.shipping || patch.edit)) throw new Error(UPGRADE);
    for (let attempt = 0; attempt < 4; attempt++) {
      const cur = await this.getOrder(id);
      if (!cur) return null;
      const next = applyOrderPatch(cur, patch, new Date().toISOString());
      const row: Row = v2 ? fromOrderState(next) : { status: next.status, admin_note: next.adminNote, updated_at: next.updatedAt };
      if (v2 && patch.edit) Object.assign(row, {
        items: next.items, total: next.total, customer_name: next.customerName, phone: next.phone, city: next.city, address: next.address,
        event_date: next.eventDate, note: next.note, customer_id: next.customerId, lang: next.lang,
      });
      const saved = await this.one(this.sb.from('orders').update(row).eq('id', id).eq('updated_at', cur.updatedAt).select().maybeSingle(), toOrder);
      if (saved) return saved;
    }
    throw new Error('سفارش هم‌زمان در جای دیگری تغییر کرد؛ صفحه را تازه کنید و دوباره امتحان کنید');
  }

  private async needCustomers() { if (!(await this.has('customers'))) throw new Error(UPGRADE); }
  async listCustomers() {
    await this.needCustomers();
    return this.all((a, b) => this.sb.from('customers').select('*').order('created_at', { ascending: false }).order('id').range(a, b), toCustomer);
  }
  async getCustomer(id: string) {
    await this.needCustomers();
    return this.one(this.sb.from('customers').select('*').eq('id', id).maybeSingle(), toCustomer);
  }
  async createCustomer(input: CustomerInput) {
    await this.needCustomers();
    const { data, error } = await this.sb.from('customers').insert(fromCustomer(input)).select().single();
    if (isDuplicate(error)) throw new ConflictError('phone', 'مشتری دیگری با این شماره ثبت شده است');
    if (error) throw new Error(error.message);
    return toCustomer(data as Row);
  }
  async updateCustomer(id: string, input: CustomerInput) {
    await this.needCustomers();
    const { data, error } = await this.sb.from('customers').update({ ...fromCustomer(input), updated_at: new Date().toISOString() }).eq('id', id).select().maybeSingle();
    if (isDuplicate(error)) throw new ConflictError('phone', 'مشتری دیگری با این شماره ثبت شده است');
    if (error) throw new Error(error.message);
    return data ? toCustomer(data as Row) : null;
  }
  // orders.customer_id is "on delete set null".
  async deleteCustomer(id: string) { await this.needCustomers(); await this.check(this.sb.from('customers').delete().eq('id', id)); }

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
    for (const t of ['categories', 'garments', 'orders', 'settings', 'customers']) {
      // A real (1-row) read: head-only requests do not report a missing table.
      const { error } = await this.sb.from(t).select('*').limit(1);
      if (error) problems.push(`table "${t}": ${error.message} — run supabase/schema.sql in the SQL Editor`);
    }
    const worn = await this.sb.from('garments').select('worn_front, worn_back').limit(1);
    if (worn.error) problems.push(`garments.worn_front/worn_back: ${worn.error.message} — run supabase/schema.sql`);
    for (const [t, cols] of [['garments', 'images'], ['orders', 'customer_id, payment, shipping, history']] as const) {
      const r = await this.sb.from(t).select(cols).limit(1);
      if (r.error) problems.push(`${t}.${cols}: ${r.error.message} — run supabase/schema.sql`);
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
      await this.check(this.sb.from('garments').insert(await Promise.all(SEED_GARMENTS.map(async g => ({ id: g.id, ...(await this.withWorn(g)), sort: g.sort })))));
      done.push(`${SEED_GARMENTS.length} products`);
    }
    const { data } = await this.sb.from('settings').select('id').eq('id', 1).maybeSingle();
    if (!data) { await this.saveSettings(DEFAULT_SETTINGS); done.push('settings'); }
    return done;
  }
}
