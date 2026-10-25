import type { OrderStatus, ProductKind, Shape } from './types';

/** Persian labels for the admin panel. */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'جدید',
  confirmed: 'تأیید شده',
  preparing: 'در حال آماده‌سازی',
  shipped: 'ارسال شده',
  delivered: 'تحویل شده',
  cancelled: 'لغو شده',
};

/** Statuses that count as an open order still needing work. */
export const OPEN_STATUSES: OrderStatus[] = ['new', 'confirmed', 'preparing', 'shipped'];

/** Persian names of product kinds and garment shapes for the admin panel. */
export const KIND_LABEL: Record<ProductKind, string> = { garment: 'لباس', scarf: 'شال', bag: 'کیف', jewel: 'جواهر', shoes: 'کفش' };
export const SHAPE_LABEL: Record<Shape, string> = { abaya: 'عبا', gown: 'پیراهن شب', dress: 'پیراهن', kaftan: 'کافتان' };
