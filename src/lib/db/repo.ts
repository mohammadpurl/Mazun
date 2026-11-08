import type { Category, CategoryInput, Customer, CustomerInput, Garment, GarmentInput, NewOrder, Order, OrderPatch, Settings } from '../types';

/** Everything the app stores. Two implementations: local JSON file (development) and Supabase (production). */
export interface Repo {
  readonly kind: 'local' | 'supabase';

  listCategories(): Promise<Category[]>;
  createCategory(input: CategoryInput): Promise<Category>;
  updateCategory(id: string, input: CategoryInput): Promise<Category | null>;
  /** Garments of a deleted category become uncategorised; they are not deleted. */
  deleteCategory(id: string): Promise<void>;
  reorderCategories(ids: string[]): Promise<void>;

  /** All garments, hidden ones included, in display order. */
  listGarments(): Promise<Garment[]>;
  getGarment(id: string): Promise<Garment | null>;
  createGarment(input: GarmentInput): Promise<Garment>;
  updateGarment(id: string, input: GarmentInput): Promise<Garment | null>;
  deleteGarment(id: string): Promise<void>;
  reorderGarments(ids: string[]): Promise<void>;

  /** Newest first. */
  listOrders(): Promise<Order[]>;
  getOrder(id: number): Promise<Order | null>;
  /** Saves the order and links it to its customer (found by phone, or created), saving a new delivery address. */
  createOrder(order: NewOrder): Promise<Order>;
  /** The customer an order belongs to: the one chosen, else the one with its phone, else a new one; a new delivery
   *  address is saved on her. Null when customers are not stored yet. */
  linkCustomer(o: Pick<NewOrder, 'customerId' | 'customerName' | 'phone' | 'city' | 'address'>): Promise<string | null>;
  updateOrder(id: number, patch: OrderPatch): Promise<Order | null>;

  /** Newest first. */
  listCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | null>;
  /** Throws ConflictError when another customer already has the phone number. */
  createCustomer(input: CustomerInput): Promise<Customer>;
  updateCustomer(id: string, input: CustomerInput): Promise<Customer | null>;
  /** Her orders stay (they hold their own name, phone and address) and lose the link. */
  deleteCustomer(id: string): Promise<void>;

  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<Settings>;

  /** Stores an image and returns its public URL. */
  uploadImage(bytes: Uint8Array, contentType: string, path: string): Promise<string>;
}

/** A save refused because it would duplicate something unique (a customer's phone number). */
export class ConflictError extends Error {
  constructor(public field: string, message: string) { super(message); }
}

export const bySort = <T extends { sort: number }>(a: T, b: T) => a.sort - b.sort;
export const newestFirst = <T extends { createdAt: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt);
