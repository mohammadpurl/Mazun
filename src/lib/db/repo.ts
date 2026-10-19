import type { Category, CategoryInput, Garment, GarmentInput, NewOrder, Order, OrderPatch, Settings } from '../types';

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
  createOrder(order: NewOrder): Promise<Order>;
  updateOrder(id: number, patch: OrderPatch): Promise<Order | null>;

  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<Settings>;

  /** Stores an image and returns its public URL. */
  uploadImage(bytes: Uint8Array, contentType: string, path: string): Promise<string>;
}

export const bySort = <T extends { sort: number }>(a: T, b: T) => a.sort - b.sort;
