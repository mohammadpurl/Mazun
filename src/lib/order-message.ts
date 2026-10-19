/* The message the customer sends to the shop after placing an order, and the chat link that carries it.
   Shared by the shop (customer -> shop) and the admin order list (shop -> customer). */
import type { Lang, Settings } from './types';

const LOCALE: Record<Lang, string> = { fa: 'fa-IR', ar: 'ar-OM', en: 'en-US' };

export const formatPrice = (p: number, lang: Lang, s: Pick<Settings, 'currency'>) =>
  `${p.toLocaleString(LOCALE[lang], { maximumFractionDigits: 3 })} ${s.currency[lang]}`;

export const formatNumber = (n: number, lang: Lang) => n.toLocaleString(LOCALE[lang], { useGrouping: false });

export interface OrderSummary {
  id: number;
  garmentName: string;
  size: string;
  price: number;
  customerName: string;
}

export function orderMessage(o: OrderSummary, lang: Lang, s: Pick<Settings, 'currency'>): string {
  const id = formatNumber(o.id, lang), price = formatPrice(o.price, lang, s);
  if (lang === 'ar') return `مرحباً، طلب رقم ${id}\n${o.garmentName}\nالمقاس: ${o.size}\nالسعر: ${price}\nالاسم: ${o.customerName}`;
  if (lang === 'en') return `Hello, order #${id}\n${o.garmentName}\nSize: ${o.size}\nPrice: ${price}\nName: ${o.customerName}`;
  return `سلام، سفارش شمارهٔ ${id}\n${o.garmentName}\nسایز: ${o.size}\nقیمت: ${price}\nنام: ${o.customerName}`;
}

/** Chat link for the shop's configured channel. Instagram cannot prefill text, so the UI copies it first. */
export function shopChatLink(s: Pick<Settings, 'channel' | 'whatsapp' | 'telegram' | 'instagram'>, text: string): string | null {
  const t = encodeURIComponent(text);
  if (s.channel === 'whatsapp' && s.whatsapp) return `https://wa.me/${s.whatsapp}?text=${t}`;
  if (s.channel === 'telegram' && s.telegram) return `https://t.me/${s.telegram}?text=${t}`;
  if (s.channel === 'instagram' && s.instagram) return `https://ig.me/m/${s.instagram}`;
  return null;
}

/** WhatsApp link from the admin panel to a customer's number. */
export const customerWhatsAppLink = (phone: string, text = '') =>
  `https://wa.me/${phone.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
