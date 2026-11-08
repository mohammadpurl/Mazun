/* Input validation shared by the API routes. Every function takes untrusted JSON and returns
   either a clean, typed value or a list of field errors (Persian for the admin, codes for the shop). */
import { CARRIERS, CHART_FIELDS, LANGS, ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES, PRODUCT_KINDS, SHAPES } from './types';
import { MAX_ADDRESSES } from './customers';
import type { AdminLine } from './orders';
import type { Address, CategoryInput, Colour, CustomerInput, CustomerNote, GarmentInput, L10n, Lang, OrderInput, OrderLineInput, OrderPatch, Payment, Settings, Shipping, SizeChart, Size } from './types';

export type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const l10n = (v: unknown, max: number): L10n => { const o = obj(v); return { en: str(o.en, max), ar: str(o.ar, max), fa: str(o.fa, max) }; };
const any = (t: L10n) => !!(t.en || t.ar || t.fa);
const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANGS as readonly string[]).includes(v);
const nonNegInt = (v: unknown, fallback = 0) => { const n = Math.floor(num(v)); return Number.isFinite(n) && n >= 0 ? Math.min(n, 365) : fallback; };
/** Image URLs must be site-relative or https, never javascript:/data: — they end up in src attributes. Empty is allowed. */
export const imageUrl = (v: unknown) => { const s = str(v, 1000); return /^(\/(?!\/)|https:\/\/)/.test(s) ? s : ''; };
const pick = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => ((list as readonly unknown[]).includes(v) ? (v as T) : fallback);

/** Keeps digits only, converting Persian/Arabic digits, and drops a 00 international prefix ("+968 9…" / "00968…" -> "9689…"). */
export function normalizePhone(v: unknown): string {
  const d = str(v, 40).replace(/[۰-۹]/g, x => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(x))).replace(/[٠-٩]/g, x => String('٠١٢٣٤٥٦٧٨٩'.indexOf(x)))
    .replace(/\D/g, '').replace(/^00/, '');
  // An Omani number written without the country code (mobile 7/9, landline 2) gets it, so one customer is one record
  // whether she typed "9123 4567" in the shop or the boutique saved "+968 9123 4567".
  return /^[279]\d{7}$/.test(d) ? '968' + d : d;
}

export const MAX_ORDER_LINES = 20;

/** A real calendar day written yyyy-mm-dd and nothing more (2026-02-30 is not), from yesterday on: a day of slack for
 *  customers west of UTC, whose today can already be yesterday in UTC. Up to five years ahead catches typed-in typos. */
function isEventDay(s: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  if (new Date(t).toISOString().slice(0, 10) !== s) return false;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return t >= today - 86400000 && t <= today + 5 * 366 * 86400000;
}

export function validateOrder(raw: unknown): Result<OrderInput> {
  const o = obj(raw);
  const errors: Record<string, string> = {};
  const customerName = str(o.customerName, 80);
  const phone = normalizePhone(o.phone);
  const eventDate = str(o.eventDate, 40);
  const lines: OrderLineInput[] = [];
  for (const it of Array.isArray(o.items) ? o.items.slice(0, MAX_ORDER_LINES + 1) : []) {
    const r = obj(it);
    const garmentId = str(r.garmentId, 60), size = str(r.size, 12);
    const qty = num(r.qty), color = Math.floor(num(r.color));
    if (!garmentId || !size || !Number.isInteger(qty) || qty < 1 || qty > 10) { errors.items = 'invalid'; break; }
    lines.push({ garmentId, size, qty, color: color >= 0 && color < 20 ? color : 0 });
  }
  if (!lines.length) errors.items ||= 'required';
  if (lines.length > MAX_ORDER_LINES) errors.items = 'too many';
  if (customerName.length < 2) errors.customerName = 'required';
  if (phone.length < 7 || phone.length > 15) errors.phone = 'invalid';
  if (eventDate && !isEventDay(eventDate)) errors.eventDate = 'invalid';
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      items: lines, customerName, phone,
      city: str(o.city, 60), address: str(o.address, 300), note: str(o.note, 500),
      eventDate: eventDate || null, lang: isLang(o.lang) ? o.lang : 'en',
    },
  };
}

function sizesOf(v: unknown): Size[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: Size[] = [];
  for (const s of v) {
    const n = str(obj(s).n, 12).toUpperCase();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push({ n, ok: obj(s).ok !== false });
  }
  return out.slice(0, 12);
}

function coloursOf(v: unknown): Colour[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 8).map(c => ({ name: l10n(obj(c).name, 40), hex: str(obj(c).hex, 7) }))
    .filter(c => /^#[0-9a-fA-F]{6}$/.test(c.hex));
}

function chartOf(v: unknown, sizes: Size[]): SizeChart | null {
  const o = obj(v);
  const chart: SizeChart = {};
  for (const s of sizes) {
    const row = obj(o[s.n]);
    for (const f of CHART_FIELDS) {
      const n = num(row[f]);
      if (Number.isFinite(n) && n > 0 && n < 400) (chart[s.n] ||= {})[f] = Math.round(n * 10) / 10;
    }
  }
  return Object.keys(chart).length ? chart : null;
}

export function validateGarment(raw: unknown): Result<GarmentInput> {
  const o = obj(raw);
  const errors: Record<string, string> = {};
  const name = l10n(o.name, 120);
  const price = num(o.price);
  const sale = o.salePrice === null || o.salePrice === '' || o.salePrice === undefined ? null : num(o.salePrice);
  const sizes = sizesOf(o.sizes);
  const colors = coloursOf(o.colors);
  const kind = pick(o.kind, PRODUCT_KINDS, 'garment');
  if (!any(name)) errors.name = 'حداقل یک نام وارد کنید';
  if (!Number.isFinite(price) || price < 0) errors.price = 'قیمت نامعتبر است';
  if (sale !== null && (!Number.isFinite(sale) || sale < 0 || sale >= price)) errors.salePrice = 'قیمت تخفیف باید کمتر از قیمت اصلی باشد';
  if (!sizes.length) errors.sizes = 'حداقل یک سایز لازم است';
  if (!colors.length) errors.colors = 'حداقل یک رنگ با کد رنگ معتبر (مثل #6F7258) لازم است';
  if (Object.keys(errors).length) return { ok: false, errors };
  const categoryId = kind === 'garment' ? str(o.categoryId, 60) : '';
  const front = imageUrl(o.front);
  return {
    ok: true,
    value: {
      kind, name, type: l10n(o.type, 120), description: l10n(o.description, 800), fabric: l10n(o.fabric, 300), note: l10n(o.note, 300),
      price, salePrice: sale, categoryId: categoryId || null, colors, sizes, chart: chartOf(o.chart, sizes),
      shape: pick(o.shape, SHAPES, 'abaya'), front, back: imageUrl(o.back), detail: imageUrl(o.detail),
      images: (Array.isArray(o.images) ? o.images : []).map(imageUrl).filter(Boolean).slice(0, MAX_GALLERY),
      wornFront: kind === 'garment' ? imageUrl(o.wornFront) : '', wornBack: kind === 'garment' ? imageUrl(o.wornBack) : '',
      leadDays: nonNegInt(o.leadDays), isNew: o.isNew === true, visible: o.visible !== false,
    },
  };
}

export function validateCategory(raw: unknown): Result<CategoryInput> {
  const o = obj(raw);
  const name = l10n(o.name, 60);
  if (!any(name)) return { ok: false, errors: { name: 'حداقل یک نام وارد کنید' } };
  return { ok: true, value: { name, description: l10n(o.description, 200), image: imageUrl(o.image), visible: o.visible !== false } };
}

/** An ISO time, a yyyy-mm-dd day (a real calendar day; stored as 08:00 UTC, midday in Muscat), or null. */
function when(v: unknown): string | null | undefined {
  if (v === null || v === '') return null;
  if (typeof v !== 'string') return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    // A picked day: today means now (so "shipped today" then "delivered today" stay in order); another day is noon
    // that day in Muscat, which no time zone shown in the panel moves to a neighbouring day.
    const t = Date.parse(v + 'T08:00:00Z');
    if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== v) return undefined;
    return v === new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Muscat' }).format(new Date()) ? new Date().toISOString() : new Date(t).toISOString();
  }
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
}
const money = (v: unknown) => { const n = num(v); return Number.isFinite(n) && n >= 0 && n < 1e7 ? Math.round(n * 1000) / 1000 : NaN; };

/** A time more than a day ahead (what happened cannot be in the future; the day allows for time zones). */
const future = (t: string | null) => !!t && Date.parse(t) > Date.now() + 86_400_000;

export function validateOrderPatch(raw: unknown): Result<OrderPatch> {
  const o = obj(raw);
  const errors: Record<string, string> = {};
  const patch: OrderPatch = {};
  if (o.status !== undefined) {
    if (!(ORDER_STATUSES as readonly unknown[]).includes(o.status)) errors.status = 'وضعیت نامعتبر است';
    else patch.status = o.status as OrderPatch['status'];
  }
  if (o.statusNote !== undefined) patch.statusNote = str(o.statusNote, 200);
  if (o.adminNote !== undefined) patch.adminNote = str(o.adminNote, 1000);
  if (o.payment !== undefined) {
    const p = obj(o.payment);
    const out: Partial<Payment> = {};
    if (p.status !== undefined) {
      if (!(PAYMENT_STATUSES as readonly unknown[]).includes(p.status)) errors.payment = 'وضعیت پرداخت نامعتبر است';
      else out.status = p.status as Payment['status'];
    }
    if (p.method !== undefined) {
      if (p.method !== '' && !(PAYMENT_METHODS as readonly unknown[]).includes(p.method)) errors.payment = 'روش پرداخت نامعتبر است';
      else out.method = p.method as Payment['method'];
    }
    if (p.paid !== undefined) { const n = money(p.paid); if (Number.isNaN(n)) errors.paid = 'مبلغ پرداختی نامعتبر است'; else out.paid = n; }
    if (p.paidAt !== undefined) { const t = when(p.paidAt); if (t === undefined) errors.paidAt = 'تاریخ پرداخت نامعتبر است'; else if (future(t)) errors.paidAt = 'تاریخ پرداخت در آینده است'; else out.paidAt = t; }
    patch.payment = out;
  }
  if (o.shipping !== undefined) {
    const sh = obj(o.shipping);
    const out: Partial<Shipping> = {};
    if (sh.carrier !== undefined) {
      if (sh.carrier !== '' && !(CARRIERS as readonly unknown[]).includes(sh.carrier)) errors.carrier = 'شرکت ارسال نامعتبر است';
      else out.carrier = sh.carrier as Shipping['carrier'];
    }
    if (sh.tracking !== undefined) out.tracking = str(sh.tracking, 60);
    if (sh.fee !== undefined) { const n = money(sh.fee); if (Number.isNaN(n)) errors.fee = 'هزینهٔ ارسال نامعتبر است'; else out.fee = n; }
    for (const k of ['shippedAt', 'deliveredAt'] as const) {
      if (sh[k] === undefined) continue;
      const t = when(sh[k]);
      if (t === undefined) errors[k] = 'تاریخ نامعتبر است'; else if (future(t)) errors[k] = 'تاریخ در آینده است'; else out[k] = t;
    }
    patch.shipping = out;
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: patch };
}

/** Bulk status change from the orders list: up to 200 order numbers and one status. */
export function validateBulkOrders(raw: unknown): Result<{ ids: number[]; status: OrderPatch['status'] }> {
  const o = obj(raw);
  const ids = (Array.isArray(o.ids) ? o.ids : []).map(Number).filter(n => Number.isSafeInteger(n) && n > 0);
  if (!ids.length || ids.length > 200) return { ok: false, errors: { ids: 'هیچ سفارشی انتخاب نشده است' } };
  if (!(ORDER_STATUSES as readonly unknown[]).includes(o.status)) return { ok: false, errors: { status: 'وضعیت نامعتبر است' } };
  return { ok: true, value: { ids: [...new Set(ids)], status: o.status as OrderPatch['status'] } };
}

export const MAX_GALLERY = 12;
const MAX_NOTES = 200;
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
const shortId = (v: unknown, p: string) => { const s = str(v, 40); return /^[\w-]{3,40}$/.test(s) ? s : p + Math.random().toString(36).slice(2, 10); };

export function validateCustomer(raw: unknown): Result<CustomerInput> {
  const o = obj(raw);
  const errors: Record<string, string> = {};
  const name = str(o.name, 80);
  const phone = normalizePhone(o.phone);
  const email = str(o.email, 120).toLowerCase();
  if (name.length < 2) errors.name = 'نام مشتری را وارد کنید';
  if (phone.length < 7 || phone.length > 15) errors.phone = 'شماره را با کد کشور وارد کنید (مثل 96891234567)';
  if (email && !isEmail(email)) errors.email = 'ایمیل نامعتبر است';
  const tags = [...new Set((Array.isArray(o.tags) ? o.tags : []).map(t => str(t, 24)).filter(Boolean))].slice(0, 12);
  const addresses: Address[] = [];
  const rawAddresses = Array.isArray(o.addresses) ? o.addresses : [];
  if (rawAddresses.length > MAX_ADDRESSES) errors.addresses = `حداکثر ${MAX_ADDRESSES.toLocaleString('fa-IR')} نشانی؛ یکی را حذف کنید`;
  const rawNotes = Array.isArray(o.notes) ? o.notes : [];
  if (rawNotes.length > MAX_NOTES) errors.notes = `حداکثر ${MAX_NOTES.toLocaleString('fa-IR')} یادداشت`;
  for (const [i, a] of rawAddresses.slice(0, MAX_ADDRESSES).entries()) {
    const r = obj(a);
    const city = str(r.city, 60), line = str(r.line, 300);
    if (!city && !line) { errors[`address${i}`] = 'شهر یا نشانی را وارد کنید'; continue; }
    addresses.push({ id: shortId(r.id, 'a'), label: str(r.label, 30) || 'آدرس', city, area: str(r.area, 60), line, isDefault: r.isDefault === true });
  }
  const notes: CustomerNote[] = rawNotes.slice(0, MAX_NOTES).map(n => {
    const r = obj(n);
    return { id: shortId(r.id, 'n'), at: when(r.at) || new Date().toISOString(), text: str(r.text, 500) };
  }).filter(n => n.text);
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, phone, email, tags, addresses, notes } };
}

export function validateSettings(raw: unknown): Result<Settings> {
  const o = obj(raw);
  const errors: Record<string, string> = {};
  const channel = o.channel === 'telegram' || o.channel === 'instagram' ? o.channel : 'whatsapp';
  const whatsapp = normalizePhone(o.whatsapp);
  const handle = (v: unknown) => str(v, 40).replace(/^@/, '');
  const telegram = handle(o.telegram), instagram = handle(o.instagram);
  if (whatsapp && (whatsapp.length < 8 || whatsapp.length > 15)) errors.whatsapp = 'شماره را با کد کشور و فقط با رقم وارد کنید';
  if (telegram && !/^[A-Za-z0-9_]{4,32}$/.test(telegram)) errors.telegram = 'نام کاربری تلگرام نامعتبر است';
  if (instagram && !/^[A-Za-z0-9_.]{1,30}$/.test(instagram)) errors.instagram = 'نام کاربری اینستاگرام نامعتبر است';
  const target = { whatsapp, telegram, instagram }[channel];
  if (!target) errors[channel] = 'برای کانال سفارش انتخاب‌شده این مقدار لازم است';
  const brand = l10n(o.brand, 60);
  if (!any(brand)) errors.brand = 'نام برند لازم است';
  if (Object.keys(errors).length) return { ok: false, errors };
  const h = obj(o.home);
  return {
    ok: true,
    value: {
      brand, tagline: l10n(o.tagline, 120), ticker: l10n(o.ticker, 120), currency: l10n(o.currency, 20),
      channel, whatsapp, telegram, instagram, originCity: l10n(o.originCity, 40),
      prepDays: nonNegInt(o.prepDays, 1), shipDays: nonNegInt(o.shipDays, 2), bufferDays: nonNegInt(o.bufferDays, 2),
      monthlyGoal: Number.isFinite(money(o.monthlyGoal)) ? money(o.monthlyGoal) : 0,
      home: {
        hero: imageUrl(h.hero), fabric: imageUrl(h.fabric), atelier: imageUrl(h.atelier),
        tryBefore: imageUrl(h.tryBefore), tryAfter: imageUrl(h.tryAfter), featuredId: str(h.featuredId, 60) || null,
      },
    },
  };
}

/** An order entered or corrected in the admin. `create` also takes the starting status, payment and delivery charge. */
export interface AdminOrderInput {
  customerId: string | null; customerName: string; phone: string; city: string; address: string; note: string; adminNote: string;
  eventDate: string | null; lang: Lang; lines: AdminLine[]; fee: number;
  status: 'new' | 'confirmed'; payment: Pick<Payment, 'status' | 'method' | 'paid'>;
}
export function validateAdminOrder(raw: unknown): Result<AdminOrderInput> {
  const o = obj(raw);
  const errors: Record<string, string> = {};
  const customerName = str(o.customerName, 80);
  const phone = normalizePhone(o.phone);
  if (customerName.length < 2) errors.customerName = 'نام مشتری را وارد کنید';
  if (phone.length < 7 || phone.length > 15) errors.phone = 'شماره را با کد کشور وارد کنید (مثل 96891234567)';
  const day = str(o.eventDate, 10);
  const t = Date.parse(day + 'T00:00:00Z');
  const eventDate = /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === day ? day : null;
  if (day && !eventDate) errors.eventDate = 'تاریخ مراسم نامعتبر است';
  const lines: AdminLine[] = [];
  for (const it of Array.isArray(o.items) ? o.items.slice(0, MAX_ORDER_LINES + 1) : []) {
    const r = obj(it);
    const qty = Math.floor(num(r.qty)), price = money(r.price);
    const garmentId = str(r.garmentId, 60) || null, name = str(r.name, 120), size = str(r.size, 12);
    if ((!garmentId && !name) || !size || !(qty >= 1 && qty <= 50) || Number.isNaN(price)) { errors.items = 'هر قلم محصول، سایز، تعداد (۱ تا ۵۰) و قیمت معتبر لازم دارد'; break; }
    lines.push({ garmentId, name, size, color: str(r.color, 40), qty, price });
  }
  if (!lines.length) errors.items ||= 'حداقل یک قلم اضافه کنید';
  if (lines.length > MAX_ORDER_LINES) errors.items = `حداکثر ${MAX_ORDER_LINES} قلم`;
  if (lines.reduce((a, l) => a + l.price * l.qty, 0) >= 1e7) errors.items = 'مبلغ کل سفارش بیش از حد مجاز است';
  const fee = o.fee === undefined || o.fee === '' ? 0 : money(o.fee);
  if (Number.isNaN(fee)) errors.fee = 'هزینهٔ ارسال نامعتبر است';
  const p = obj(o.payment);
  const payStatus = pick(p.status, ['unpaid', 'partial', 'paid'] as const, 'unpaid');
  const paid = p.paid === undefined || p.paid === '' ? 0 : money(p.paid);
  if (Number.isNaN(paid)) errors.paid = 'مبلغ پرداختی نامعتبر است';
  const method = p.method === '' || p.method === undefined ? '' : (PAYMENT_METHODS as readonly unknown[]).includes(p.method) ? (p.method as Payment['method']) : '';
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      customerId: str(o.customerId, 60) || null, customerName, phone, city: str(o.city, 60), address: str(o.address, 300), note: str(o.note, 500),
      adminNote: str(o.adminNote, 1000), eventDate, lang: isLang(o.lang) ? o.lang : 'ar', lines, fee,
      status: o.status === 'new' ? 'new' : 'confirmed', payment: { status: payStatus, method, paid },
    },
  };
}
