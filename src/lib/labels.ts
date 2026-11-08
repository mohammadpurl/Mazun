import type { Carrier, OrderStatus, PaymentMethod, PaymentStatus, ProductKind, Shape } from './types';

/** Persian labels for the admin panel. */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'جدید',
  confirmed: 'تأیید شده',
  preparing: 'در حال آماده‌سازی',
  shipped: 'ارسال شده',
  delivered: 'تحویل شده',
  cancelled: 'لغو شده',
};

/** What the button that moves an order on says. */
export const STATUS_ACTION: Record<OrderStatus, string> = {
  new: 'برگرداندن به جدید',
  confirmed: 'تأیید سفارش',
  preparing: 'شروع آماده‌سازی',
  shipped: 'ثبت ارسال',
  delivered: 'ثبت تحویل',
  cancelled: 'لغو سفارش',
};

/** Statuses that count as an open order still needing work. */
export const OPEN_STATUSES: OrderStatus[] = ['new', 'confirmed', 'preparing', 'shipped'];

export const PAYMENT_LABEL: Record<PaymentStatus, string> = { unpaid: 'پرداخت نشده', partial: 'بیعانه', paid: 'پرداخت شده', refunded: 'بازپرداخت شده' };
export const METHOD_LABEL: Record<PaymentMethod, string> = { cash: 'نقدی', card: 'کارت', transfer: 'انتقال بانکی', link: 'لینک پرداخت' };
export const CARRIER_LABEL: Record<Carrier, string> = {
  courier: 'پیک آتلیه', omanpost: 'پست عمان', aramex: 'آرامکس', dhl: 'DHL', smsa: 'SMSA', pickup: 'تحویل حضوری',
};

/** Persian names of product kinds and garment shapes for the admin panel. */
export const KIND_LABEL: Record<ProductKind, string> = { garment: 'لباس', scarf: 'شال', bag: 'کیف', jewel: 'جواهر', shoes: 'کفش' };
export const SHAPE_LABEL: Record<Shape, string> = { abaya: 'عبا', gown: 'پیراهن شب', dress: 'پیراهن', kaftan: 'کافتان' };

export const FUNNEL_LABEL = { placed: 'ثبت شد', confirmed: 'تأیید شد', shipped: 'ارسال شد', delivered: 'تحویل شد' } as const;
