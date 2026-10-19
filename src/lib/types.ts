export const LANGS = ['fa', 'ar', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export type L10n = Record<Lang, string>;

/** One size of a garment and whether it can be ordered right now. */
export interface Size {
  n: string;
  ok: boolean;
}

export const CHART_FIELDS = ['bust', 'waist', 'hips', 'length', 'sleeve'] as const;
export type ChartField = (typeof CHART_FIELDS)[number];
/** Measurements in cm for one size. */
export type ChartRow = Partial<Record<ChartField, number>>;
export type SizeChart = Record<string, ChartRow>;

export interface Category {
  id: string;
  name: L10n;
  sort: number;
  visible: boolean;
}

export interface Garment {
  id: string;
  categoryId: string | null;
  name: L10n;
  description: L10n;
  price: number;
  /** Discounted price; null when the garment is not on sale. */
  salePrice: number | null;
  sizes: Size[];
  front: string;
  back: string;
  chart: SizeChart | null;
  /** Extra preparation days for this garment, on top of the shop-wide prepDays. */
  leadDays: number;
  sort: number;
  visible: boolean;
  createdAt: string;
}

export const ORDER_STATUSES = ['new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface Order {
  /** Sequential order number shown to the customer and the admin. */
  id: number;
  garmentId: string | null;
  /** Snapshot taken when the order was placed, so later edits to the garment do not rewrite history. */
  garmentName: string;
  size: string;
  price: number;
  customerName: string;
  phone: string;
  city: string;
  address: string;
  note: string;
  eventDate: string | null;
  lang: Lang;
  status: OrderStatus;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
}

export type OrderChannel = 'whatsapp' | 'telegram' | 'instagram';

export interface Settings {
  brand: L10n;
  tagline: L10n;
  ticker: L10n;
  currency: L10n;
  channel: OrderChannel;
  whatsapp: string;
  telegram: string;
  instagram: string;
  originCity: L10n;
  prepDays: number;
  shipDays: number;
  bufferDays: number;
}

export type GarmentInput = Omit<Garment, 'id' | 'createdAt' | 'sort'> & { sort?: number };
export type CategoryInput = Omit<Category, 'id' | 'sort'> & { sort?: number };
export type OrderInput = Pick<Order, 'garmentId' | 'size' | 'customerName' | 'phone' | 'city' | 'address' | 'note' | 'eventDate' | 'lang'>;
export type NewOrder = Omit<Order, 'id' | 'status' | 'adminNote' | 'createdAt' | 'updatedAt'>;
export type OrderPatch = Partial<Pick<Order, 'status' | 'adminNote'>>;
