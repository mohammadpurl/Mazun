/* Production store on Supabase. Uses the service-role key on the server only; the tables have RLS
   on with no policies, so the browser (anon key) cannot read or write anything directly.
   Schema: supabase/schema.sql. */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { withDefaults } from '../defaults';
import type { Category, CategoryInput, Garment, GarmentInput, NewOrder, Order, OrderPatch, Settings } from '../types';
import type { Repo } from './repo';

type Row = Record<string, unknown>;
const BUCKET = 'garments';

const toCategory = (r: Row): Category => ({
  id: String(r.id), name: { fa: String(r.name_fa ?? ''), ar: String(r.name_ar ?? ''), en: String(r.name_en ?? '') },
  sort: Number(r.sort ?? 0), visible: r.visible !== false,
});
const fromCategory = (c: CategoryInput) => ({ name_fa: c.name.fa, name_ar: c.name.ar, name_en: c.name.en, visible: c.visible, ...(c.sort != null && { sort: c.sort }) });

const toGarment = (r: Row): Garment => ({
  id: String(r.id), categoryId: r.category_id == null ? null : String(r.category_id),
  name: { fa: String(r.name_fa ?? ''), ar: String(r.name_ar ?? ''), en: String(r.name_en ?? '') },
  description: { fa: String(r.desc_fa ?? ''), ar: String(r.desc_ar ?? ''), en: String(r.desc_en ?? '') },
  price: Number(r.price ?? 0), salePrice: r.sale_price == null ? null : Number(r.sale_price),
  sizes: Array.isArray(r.sizes) ? (r.sizes as Garment['sizes']) : [],
  front: String(r.front ?? ''), back: String(r.back ?? r.front ?? ''),
  chart: (r.chart as Garment['chart']) ?? null, leadDays: Number(r.lead_days ?? 0),
  sort: Number(r.sort ?? 0), visible: r.visible !== false, createdAt: String(r.created_at ?? ''),
});
const fromGarment = (g: GarmentInput) => ({
  category_id: g.categoryId ? Number(g.categoryId) : null,
  name_fa: g.name.fa, name_ar: g.name.ar, name_en: g.name.en,
  desc_fa: g.description.fa, desc_ar: g.description.ar, desc_en: g.description.en,
  price: g.price, sale_price: g.salePrice, sizes: g.sizes, front: g.front, back: g.back,
  chart: g.chart, lead_days: g.leadDays, visible: g.visible, ...(g.sort != null && { sort: g.sort }),
});

const toOrder = (r: Row): Order => ({
  id: Number(r.id), garmentId: r.garment_id == null ? null : String(r.garment_id),
  garmentName: String(r.garment_name ?? ''), size: String(r.size ?? ''), price: Number(r.price ?? 0),
  customerName: String(r.customer_name ?? ''), phone: String(r.phone ?? ''), city: String(r.city ?? ''),
  address: String(r.address ?? ''), note: String(r.note ?? ''), eventDate: (r.event_date as string | null) ?? null,
  lang: (r.lang as Order['lang']) ?? 'fa', status: (r.status as Order['status']) ?? 'new', adminNote: String(r.admin_note ?? ''),
  createdAt: String(r.created_at ?? ''), updatedAt: String(r.updated_at ?? ''),
});

/** Ids are bigint in the database; anything else would make Postgres raise a cast error. */
const numericId = (id: string) => (/^\d+$/.test(id) ? Number(id) : null);

export class SupabaseRepo implements Repo {
  readonly kind = 'supabase' as const;
  private sb: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  private async rows<T>(q: PromiseLike<{ data: unknown; error: { message: string } | null }>, map: (r: Row) => T): Promise<T[]> {
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return ((data as Row[]) ?? []).map(map);
  }
  private async one<T>(q: PromiseLike<{ data: unknown; error: { message: string } | null }>, map: (r: Row) => T): Promise<T | null> {
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ? map(data as Row) : null;
  }
  private async reorder(table: string, ids: string[]) {
    const results = await Promise.all(ids.map((id, i) => numericId(id) == null ? null : this.sb.from(table).update({ sort: i + 1 }).eq('id', numericId(id))));
    const err = results.find(r => r?.error)?.error;
    if (err) throw new Error(err.message);
  }

  listCategories() { return this.rows(this.sb.from('categories').select('*').order('sort').order('id'), toCategory); }
  async createCategory(input: CategoryInput) {
    return (await this.one(this.sb.from('categories').insert(fromCategory(input)).select().single(), toCategory))!;
  }
  updateCategory(id: string, input: CategoryInput) {
    const n = numericId(id);
    return n == null ? Promise.resolve(null) : this.one(this.sb.from('categories').update(fromCategory(input)).eq('id', n).select().maybeSingle(), toCategory);
  }
  async deleteCategory(id: string) {
    const n = numericId(id);
    if (n == null) return;
    // garments.category_id is "on delete set null", so garments survive.
    const { error } = await this.sb.from('categories').delete().eq('id', n);
    if (error) throw new Error(error.message);
  }
  reorderCategories(ids: string[]) { return this.reorder('categories', ids); }

  listGarments() { return this.rows(this.sb.from('garments').select('*').order('sort').order('id'), toGarment); }
  getGarment(id: string) {
    const n = numericId(id);
    return n == null ? Promise.resolve(null) : this.one(this.sb.from('garments').select('*').eq('id', n).maybeSingle(), toGarment);
  }
  async createGarment(input: GarmentInput) {
    if (input.sort == null) {
      const { data } = await this.sb.from('garments').select('sort').order('sort', { ascending: false }).limit(1);
      input = { ...input, sort: Number((data as Row[] | null)?.[0]?.sort ?? 0) + 1 };
    }
    return (await this.one(this.sb.from('garments').insert(fromGarment(input)).select().single(), toGarment))!;
  }
  updateGarment(id: string, input: GarmentInput) {
    const n = numericId(id);
    return n == null ? Promise.resolve(null) : this.one(this.sb.from('garments').update(fromGarment(input)).eq('id', n).select().maybeSingle(), toGarment);
  }
  async deleteGarment(id: string) {
    const n = numericId(id);
    if (n == null) return;
    const { error } = await this.sb.from('garments').delete().eq('id', n);
    if (error) throw new Error(error.message);
  }
  reorderGarments(ids: string[]) { return this.reorder('garments', ids); }

  listOrders() { return this.rows(this.sb.from('orders').select('*').order('id', { ascending: false }).limit(5000), toOrder); }
  async createOrder(o: NewOrder) {
    const row = {
      garment_id: o.garmentId ? numericId(o.garmentId) : null, garment_name: o.garmentName, size: o.size, price: o.price,
      customer_name: o.customerName, phone: o.phone, city: o.city, address: o.address, note: o.note,
      event_date: o.eventDate, lang: o.lang,
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
    const { error } = await this.sb.from('settings').upsert({ id: 1, data: s, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return s;
  }

  async uploadImage(bytes: Uint8Array, contentType: string, path: string) {
    const { error } = await this.sb.storage.from(BUCKET).upload(path, bytes, { upsert: true, contentType, cacheControl: '31536000' });
    if (error) throw new Error(error.message);
    return this.sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
  }
}
