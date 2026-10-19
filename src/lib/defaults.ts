import type { Category, Garment, L10n, Settings, Size } from './types';

export const DEFAULT_SETTINGS: Settings = {
  brand: { fa: 'عبایا عمان', ar: 'عبايا عُمان', en: 'Abaya Oman' },
  tagline: { fa: 'مجموعه عبایا', ar: 'مجموعة العبايات', en: 'Abaya collection' },
  ticker: { fa: 'طرح‌های جدید هر روز', ar: 'تصاميم جديدة كل يوم', en: 'NEW DESIGNS DAILY' },
  currency: { fa: 'ریال عمانی', ar: 'ر.ع.', en: 'OMR' },
  channel: 'whatsapp',
  whatsapp: '',
  telegram: '',
  instagram: '',
  originCity: { fa: 'مسقط', ar: 'مسقط', en: 'Muscat' },
  prepDays: 2,
  shipDays: 3,
  bufferDays: 2,
};

/** Fills any field missing from a stored settings object with its default. */
export function withDefaults(stored: Partial<Settings> | null | undefined): Settings {
  const s = stored ?? {};
  const l10n = (k: keyof Settings): L10n => ({ ...(DEFAULT_SETTINGS[k] as L10n), ...((s[k] as L10n) ?? {}) });
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    brand: l10n('brand'),
    tagline: l10n('tagline'),
    ticker: l10n('ticker'),
    currency: l10n('currency'),
    originCity: l10n('originCity'),
  };
}

export const DEFAULT_SIZES = ['S', 'M', 'L', 'XL'];

/** Size chart used when a garment has no chart of its own (cm). */
export const DEFAULT_CHART = {
  S: { bust: 92, waist: 80, hips: 98, length: 140 },
  M: { bust: 98, waist: 86, hips: 104, length: 142 },
  L: { bust: 104, waist: 92, hips: 110, length: 144 },
  XL: { bust: 110, waist: 98, hips: 116, length: 146 },
} as const;

const sizes = (spec: string): Size[] => spec.split(';').map(s => { const [n, a] = s.split(':'); return { n, ok: a !== '0' }; });
const empty: L10n = { fa: '', ar: '', en: '' };

export const SEED_CATEGORIES: Category[] = [
  { id: 'c1', name: { fa: 'عبایا', ar: 'عبايات', en: 'Abayas' }, sort: 1, visible: true },
  { id: 'c2', name: { fa: 'کافتان', ar: 'قفاطين', en: 'Caftans' }, sort: 2, visible: true },
];

/** The eight garments of the original static shop, used to seed an empty local store. */
export const SEED_GARMENTS: Garment[] = [
  ['عبایای مشکی سلطنتی', 'عباية سوداء ملكية', 'Royal Black Abaya', 55, 'S:1;M:1;L:1;XL:0'],
  ['عبایای سرمه‌ای کمربندی', 'عباية كحلية بحزام', 'Navy Belted Abaya', 48, 'S:0;M:1;L:1;XL:1'],
  ['عبایای زرشکی روباز', 'عباية عنابية مفتوحة', 'Burgundy Open Abaya', 52, 'S:1;M:1;L:0;XL:0'],
  ['عبایای سبز مریمی', 'عباية خضراء زيتية', 'Sage Everyday Abaya', 38, 'S:1;M:1;L:1;XL:1'],
  ['عبایای قهوه‌ای نقطه‌دار', 'عباية موكا منقطة', 'Mocha Dotted Abaya', 44, 'S:1;M:0;L:1;XL:1'],
  ['عبایای ذغالی کلاسیک', 'عباية فحمية كلاسيكية', 'Charcoal Classic Abaya', 40, 'S:1;M:1;L:1;XL:1'],
  ['عبایای کرم گلدوزی‌شده', 'عباية كريمية مطرزة', 'Cream Embroidered Abaya', 65, 'S:0;M:0;L:1;XL:1'],
  ['کافتان عاجی گلدوزی‌شده', 'قفطان عاجي مطرز', 'Ivory Embroidered Caftan', 50, 'S:1;M:1;L:0;XL:1'],
].map(([fa, ar, en, price, spec], i) => ({
  id: `g${i + 1}`,
  categoryId: i === 7 ? 'c2' : 'c1',
  name: { fa, ar, en } as L10n,
  description: { ...empty },
  price: price as number,
  salePrice: null,
  sizes: sizes(spec as string),
  front: `/images/transparent/abaya-${i + 1}-front.png`,
  back: `/images/transparent/abaya-${i + 1}-back.png`,
  chart: null,
  leadDays: 0,
  sort: i + 1,
  visible: true,
  createdAt: '2026-10-17T00:00:00.000Z',
}));
