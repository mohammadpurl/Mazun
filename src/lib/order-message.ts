/* The message the customer sends to the shop after checkout, and the chat link that carries it.
   Shared by the shop (customer -> shop) and the admin order list (shop -> customer). */
import { ONE_SIZE } from './defaults';
import { itemsSummary } from './orders';
import type { Lang, OrderItem, Settings } from './types';

export const LOCALE: Record<Lang, string> = { en: 'en-GB', ar: 'ar-OM', fa: 'fa-IR' };

export const formatPrice = (p: number, lang: Lang, s: Pick<Settings, 'currency'>) =>
  `${p.toLocaleString(LOCALE[lang], { maximumFractionDigits: 3 })} ${s.currency[lang]}`;

export const formatNumber = (n: number, lang: Lang) => n.toLocaleString(LOCALE[lang], { useGrouping: false });

export interface OrderSummary {
  id: number;
  items: OrderItem[];
  total: number;
  customerName: string;
}

const HEAD: Record<Lang, (id: string) => string> = {
  en: id => `Hello, order #${id}`,
  ar: id => `مرحباً، طلب رقم ${id}`,
  fa: id => `سلام، سفارش شمارهٔ ${id}`,
};
const WORDS: Record<Lang, { size: string; oneSize: string; total: string; name: string }> = {
  en: { size: 'Size', oneSize: 'One size', total: 'Total', name: 'Name' },
  ar: { size: 'المقاس', oneSize: 'مقاس واحد', total: 'المجموع', name: 'الاسم' },
  fa: { size: 'سایز', oneSize: 'تک‌سایز', total: 'جمع', name: 'نام' },
};

export function orderMessage(o: OrderSummary, lang: Lang, s: Pick<Settings, 'currency'>): string {
  const w = WORDS[lang];
  const lines = o.items.map(i =>
    `• ${i.name}${i.color ? ` (${i.color})` : ''} — ${i.size === ONE_SIZE ? w.oneSize : `${w.size} ${i.size}`}${i.qty > 1 ? ` ×${formatNumber(i.qty, lang)}` : ''} — ${formatPrice(i.price * i.qty, lang, s)}`);
  return [HEAD[lang](formatNumber(o.id, lang)), ...lines, `${w.total}: ${formatPrice(o.total, lang, s)}`, `${w.name}: ${o.customerName}`].join('\n');
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
/** The admin's first message to a customer about an order, in the language the customer ordered in. */
export function customerGreeting(o: { id: number; customerName: string; items: OrderItem[]; lang: Lang }): string {
  const n = (v: number) => formatNumber(v, o.lang);
  const pieces = itemsSummary(o.items, o.lang === 'en' ? ', ' : '، ', n);
  if (o.lang === 'en') return `Hello ${o.customerName}, we are getting in touch about your order no. ${n(o.id)} (${pieces}).`;
  if (o.lang === 'ar') return `مرحباً ${o.customerName}، نتواصل معكِ بخصوص طلبكِ رقم ${n(o.id)} (${pieces}).`;
  return `سلام ${o.customerName}، دربارهٔ سفارش شمارهٔ ${n(o.id)} (${pieces}) با شما تماس می‌گیریم.`;
}

export const customerWhatsAppLink = (phone: string, text = '') =>
  `https://wa.me/${phone.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
