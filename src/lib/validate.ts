/* Input validation shared by the API routes. Every function takes untrusted JSON and returns
   either a clean, typed value or a list of field errors (Persian for the admin, codes for the shop). */
import { CHART_FIELDS, LANGS, ORDER_STATUSES, PRODUCT_KINDS, SHAPES } from './types';
import type { CategoryInput, Colour, GarmentInput, L10n, Lang, OrderInput, OrderLineInput, OrderPatch, Settings, SizeChart, Size } from './types';

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
  return str(v, 40).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '').replace(/^00/, '');
}

export const MAX_ORDER_LINES = 20;

export function validateOrder(raw: unknown): Result<OrderInput> {
  const o = obj(raw);
  const errors: Record<string, string> = {};
  const customerName = str(o.customerName, 80);
  const phone = normalizePhone(o.phone);
  const eventDate = str(o.eventDate, 10);
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
  if (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) errors.eventDate = 'invalid';
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

export function validateOrderPatch(raw: unknown): Result<OrderPatch> {
  const o = obj(raw);
  const patch: OrderPatch = {};
  if (o.status !== undefined) {
    if (!(ORDER_STATUSES as readonly unknown[]).includes(o.status)) return { ok: false, errors: { status: 'وضعیت نامعتبر است' } };
    patch.status = o.status as OrderPatch['status'];
  }
  if (o.adminNote !== undefined) patch.adminNote = str(o.adminNote, 1000);
  return { ok: true, value: patch };
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
      home: {
        hero: imageUrl(h.hero), fabric: imageUrl(h.fabric), atelier: imageUrl(h.atelier),
        tryBefore: imageUrl(h.tryBefore), tryAfter: imageUrl(h.tryAfter), featuredId: str(h.featuredId, 60) || null,
      },
    },
  };
}
