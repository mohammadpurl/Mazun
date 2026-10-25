export const LANGS = ['en', 'ar', 'fa'] as const;
export type Lang = (typeof LANGS)[number];
export type L10n = Record<Lang, string>;

/** One size of a product and whether it can be ordered right now. */
export interface Size {
  n: string;
  ok: boolean;
}

export const CHART_FIELDS = ['bust', 'waist', 'hips', 'length', 'sleeve'] as const;
export type ChartField = (typeof CHART_FIELDS)[number];
/** Measurements in cm for one size. */
export type ChartRow = Partial<Record<ChartField, number>>;
export type SizeChart = Record<string, ChartRow>;

/** A garment on the rack, or an accessory the stylist pairs with it. Accessories never appear on the rack. */
export const PRODUCT_KINDS = ['garment', 'scarf', 'bag', 'jewel', 'shoes'] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];
export const ACCESSORY_KINDS = ['scarf', 'bag', 'jewel', 'shoes'] as const;
export type AccessoryKind = (typeof ACCESSORY_KINDS)[number];

/** Outline used to draw a garment while it has no photo (see components/boutique/Silhouette). */
export const SHAPES = ['abaya', 'gown', 'dress', 'kaftan'] as const;
export type Shape = (typeof SHAPES)[number];

export interface Colour {
  name: L10n;
  hex: string;
}

/** A collection: a rack filter and a tile on the home page. */
export interface Category {
  id: string;
  name: L10n;
  description: L10n;
  image: string;
  sort: number;
  visible: boolean;
}

export interface Garment {
  id: string;
  kind: ProductKind;
  categoryId: string | null;
  name: L10n;
  /** Short line under the name, e.g. "Olive satin abaya". */
  type: L10n;
  description: L10n;
  /** Fabric and care text for the product drawer. */
  fabric: L10n;
  /** Why the stylist picks this accessory (accessories only). */
  note: L10n;
  price: number;
  /** Discounted price; null when not on sale. */
  salePrice: number | null;
  colors: Colour[];
  sizes: Size[];
  shape: Shape;
  front: string;
  back: string;
  detail: string;
  chart: SizeChart | null;
  /** Extra preparation days for this product, on top of the shop-wide prepDays. */
  leadDays: number;
  isNew: boolean;
  sort: number;
  visible: boolean;
  createdAt: string;
}

export const ORDER_STATUSES = ['new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** One line of an order. Name, colour and price are snapshots taken when the order was placed. */
export interface OrderItem {
  garmentId: string | null;
  name: string;
  size: string;
  color: string;
  qty: number;
  price: number;
}

export interface Order {
  /** Sequential order number shown to the customer and the admin. */
  id: number;
  items: OrderItem[];
  total: number;
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

/** Images on the home page, set from the admin panel. Empty means "show the placeholder". */
export interface HomeContent {
  hero: string;
  fabric: string;
  atelier: string;
  tryBefore: string;
  tryAfter: string;
  /** Product named under the hero; null = the first garment. */
  featuredId: string | null;
}

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
  home: HomeContent;
}

export type GarmentInput = Omit<Garment, 'id' | 'createdAt' | 'sort'> & { sort?: number };
export type CategoryInput = Omit<Category, 'id' | 'sort'> & { sort?: number };

/** What the shop sends: product ids and choices only; names and prices are looked up on the server. */
export interface OrderLineInput { garmentId: string; size: string; color: number; qty: number }
export interface OrderInput {
  items: OrderLineInput[];
  customerName: string;
  phone: string;
  city: string;
  address: string;
  note: string;
  eventDate: string | null;
  lang: Lang;
}
export type NewOrder = Omit<Order, 'id' | 'status' | 'adminNote' | 'createdAt' | 'updatedAt'>;
export type OrderPatch = Partial<Pick<Order, 'status' | 'adminNote'>>;
