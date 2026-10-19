import type { OrderStatus } from './types';

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
