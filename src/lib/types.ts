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
  /** The piece worn by a model, front and back; cards and the product page prefer these, the rack keeps the cut-outs. */
  wornFront: string;
  wornBack: string;
  /** Extra photos for the gallery, in display order (fabric close-ups, styling, the piece on other models). */
  images: string[];
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

export const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'link'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Money received for an order. `paid` is what has come in so far (a deposit makes the status "partial"). */
export interface Payment {
  status: PaymentStatus;
  method: PaymentMethod | '';
  paid: number;
  paidAt: string | null;
}

export const CARRIERS = ['courier', 'omanpost', 'aramex', 'dhl', 'smsa', 'pickup'] as const;
export type Carrier = (typeof CARRIERS)[number];

/** How an order travels. Times are set when the order is marked shipped / delivered, and can be corrected. */
export interface Shipping {
  carrier: Carrier | '';
  tracking: string;
  /** Delivery charge on top of the pieces; part of what the customer owes. */
  fee: number;
  shippedAt: string | null;
  deliveredAt: string | null;
}

/** One step in an order's history: a status change, with who-knows-what context in `note`. */
export interface OrderEvent {
  at: string;
  status: OrderStatus;
  note: string;
}

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
  /** The customer record the order belongs to (matched by phone); null for orders older than customer records. */
  customerId: string | null;
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
  payment: Payment;
  shipping: Shipping;
  /** Oldest first; the first entry is the order being placed. */
  history: OrderEvent[];
  createdAt: string;
  updatedAt: string;
}

/** A delivery address the customer has used or the boutique has saved for her. */
export interface Address {
  id: string;
  /** e.g. "Home", "Work", "Mother's house". */
  label: string;
  city: string;
  /** District or neighbourhood, e.g. "Al Khuwair". */
  area: string;
  /** Street, building, way number and landmarks. */
  line: string;
  isDefault: boolean;
}

export interface CustomerNote {
  id: string;
  at: string;
  text: string;
}

export interface Customer {
  id: string;
  name: string;
  /** Digits only with country code, e.g. 96891234567; unique per customer. */
  phone: string;
  email: string;
  tags: string[];
  addresses: Address[];
  notes: CustomerNote[];
  createdAt: string;
  updatedAt: string;
}
export type CustomerInput = Pick<Customer, 'name' | 'phone' | 'email' | 'tags' | 'addresses' | 'notes'>;

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
  /** Monthly sales target shown on the dashboard; 0 = none. */
  monthlyGoal: number;
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
/** An order ready to store. Payment, shipping, history and the customer link are filled in by the store when missing. */
export type NewOrder = Omit<Order, 'id' | 'status' | 'adminNote' | 'createdAt' | 'updatedAt' | 'payment' | 'shipping' | 'history' | 'customerId'>
  & Partial<Pick<Order, 'status' | 'adminNote' | 'payment' | 'shipping' | 'customerId'>>;
/** Corrections to what was ordered and where it goes, made from the admin (recorded in the order's history). */
export type OrderEdit = Pick<Order, 'items' | 'total' | 'customerName' | 'phone' | 'city' | 'address' | 'eventDate' | 'note' | 'customerId' | 'lang'>;
/** A change from the admin. Payment and shipping carry only the fields that change; `onlyFrom` refuses the change when
 *  the order has meanwhile moved to another status (a bulk step never moves an order back). */
export type OrderPatch = Partial<Pick<Order, 'status' | 'adminNote'>> & {
  payment?: Partial<Payment>; shipping?: Partial<Shipping>; statusNote?: string; edit?: OrderEdit; onlyFrom?: OrderStatus[];
};
