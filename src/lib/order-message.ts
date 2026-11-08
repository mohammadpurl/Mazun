/* The message the customer sends to the shop after checkout, and the chat link that carries it.
   Shared by the shop (customer -> shop) and the admin order list (shop -> customer). */
import { ONE_SIZE } from './defaults';
import { itemsSummary } from './orders';
import type { Carrier, L10n, Lang, Order, OrderItem, Settings } from './types';

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

/** Carrier names as the customer reads them. */
const CARRIER_NAME: Record<Carrier, L10n> = {
  courier: { en: 'our own courier', ar: 'مندوب الأتيليه', fa: 'پیک آتلیه' },
  omanpost: { en: 'Oman Post', ar: 'بريد عُمان', fa: 'پست عمان' },
  aramex: { en: 'Aramex', ar: 'أرامكس', fa: 'آرامکس' },
  dhl: { en: 'DHL', ar: 'DHL', fa: 'DHL' },
  smsa: { en: 'SMSA', ar: 'سمسا', fa: 'SMSA' },
  pickup: { en: 'pickup from the atelier', ar: 'الاستلام من الأتيليه', fa: 'تحویل حضوری در آتلیه' },
};

/** Where an order stands, as far as a message to the customer is concerned. */
export type MessageStage = 'hello' | 'confirm' | 'confirmPaid' | 'shipped' | 'pickup' | 'balance' | 'thanks';

/** The stage that fits an order now: confirm a new one (asking for the deposit), share tracking once shipped, ask for
 *  what is left after delivery, otherwise a plain hello. */
export function stageOf(o: Pick<Order, 'status' | 'payment' | 'shipping'> & { owed: number }): MessageStage {
  if (o.status === 'new') return o.payment.paid > 0 ? 'confirmPaid' : 'confirm';
  if (o.status === 'shipped') return o.shipping.carrier === 'pickup' ? 'pickup' : 'shipped';
  if (o.status === 'delivered') return o.owed > 0 ? 'balance' : 'thanks';
  return 'hello';
}

/** The shop's name as it appears in a sentence: the settings' name, with an all-capitals logo name in title case. */
const brandIn = (b: L10n | undefined, L: Lang) => {
  const name = b?.[L] || DEFAULT_BRAND[L];
  return name === name.toUpperCase() && /[A-Z]/.test(name) ? name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : name;
};
const DEFAULT_BRAND: L10n = { en: 'Mazun Atelier', ar: 'مزون أتيليه', fa: 'آتلیه مزون' };

/** A message from the boutique to the customer about her order, in the language she ordered in. */
export function customerMessage(o: Pick<Order, 'id' | 'customerName' | 'items' | 'lang' | 'shipping'>, stage: MessageStage, money: { owed: number; currency: L10n; brand?: L10n }): string {
  const L = o.lang;
  const brand = brandIn(money.brand, L);
  const n = (v: number) => formatNumber(v, L);
  const pieces = itemsSummary(o.items, L === 'en' ? ', ' : '، ', n);
  const carrier = o.shipping.carrier ? CARRIER_NAME[o.shipping.carrier][L] : '';
  const owed = `${money.owed.toLocaleString(LOCALE[L], { maximumFractionDigits: 3 })} ${money.currency[L]}`;
  // Cash on delivery is common: the amount still to pay goes with the shipping message.
  const cod: L10n = money.owed > 0
    ? { en: ` Amount to pay on delivery: ${owed}.`, ar: ` المبلغ المطلوب عند الاستلام: ${owed}.`, fa: ` مبلغ قابل پرداخت هنگام تحویل: ${owed}.` }
    : { en: '', ar: '', fa: '' };
  const T: Record<MessageStage, L10n> = {
    hello: {
      en: `Hello ${o.customerName}, this is ${brand} about your order no. ${n(o.id)} (${pieces}).`,
      ar: `مرحباً ${o.customerName}، نكتب لكِ من ${brand} بخصوص طلبكِ رقم ${n(o.id)} (${pieces}).`,
      fa: `سلام ${o.customerName}، از ${brand} دربارهٔ سفارش شمارهٔ ${n(o.id)} (${pieces}) پیام می‌دهیم.`,
    },
    confirm: {
      en: `Hello ${o.customerName}, thank you for your order no. ${n(o.id)} (${pieces}). Shall we confirm it? We start work once the deposit is received.`,
      ar: `مرحباً ${o.customerName}، شكراً لطلبكِ رقم ${n(o.id)} (${pieces}). هل نؤكد الطلب؟ نبدأ العمل بعد استلام العربون.`,
      fa: `سلام ${o.customerName}، از سفارش شمارهٔ ${n(o.id)} (${pieces}) ممنونیم. سفارش را تأیید کنیم؟ کار بعد از دریافت بیعانه شروع می‌شود.`,
    },
    confirmPaid: {
      en: `Hello ${o.customerName}, thank you for your order no. ${n(o.id)} (${pieces}) and your payment. We are confirming it and starting work.`,
      ar: `مرحباً ${o.customerName}، شكراً لطلبكِ رقم ${n(o.id)} (${pieces}) وللدفعة. نؤكد الطلب ونبدأ العمل.`,
      fa: `سلام ${o.customerName}، از سفارش شمارهٔ ${n(o.id)} (${pieces}) و پرداختتان ممنونیم. سفارش تأیید شد و کار را شروع می‌کنیم.`,
    },
    shipped: {
      en: `Hello ${o.customerName}, your order no. ${n(o.id)} is on its way${carrier ? ` with ${carrier}` : ''}.${o.shipping.tracking ? ` Tracking number: ${o.shipping.tracking}.` : ''}${cod.en}`,
      ar: `مرحباً ${o.customerName}، طلبكِ رقم ${n(o.id)} في الطريق إليكِ${carrier ? ` مع ${carrier}` : ''}.${o.shipping.tracking ? ` رقم التتبع: ${o.shipping.tracking}.` : ''}${cod.ar}`,
      fa: `سلام ${o.customerName}، سفارش شمارهٔ ${n(o.id)} ارسال شد${carrier ? ` (${carrier})` : ''}.${o.shipping.tracking ? ` کد رهگیری: ${o.shipping.tracking}.` : ''}${cod.fa}`,
    },
    pickup: {
      en: `Hello ${o.customerName}, your order no. ${n(o.id)} is ready for pickup at the atelier.${cod.en.replace('on delivery', 'at pickup')}`,
      ar: `مرحباً ${o.customerName}، طلبكِ رقم ${n(o.id)} جاهز للاستلام من الأتيليه.${cod.ar}`,
      fa: `سلام ${o.customerName}، سفارش شمارهٔ ${n(o.id)} آماده است؛ می‌توانید از آتلیه تحویل بگیرید.${cod.fa}`,
    },
    balance: {
      en: `Hello ${o.customerName}, we hope you love your order no. ${n(o.id)}. ${owed} is still to be paid; thank you for settling it.`,
      ar: `مرحباً ${o.customerName}، نتمنى أن ينال طلبكِ رقم ${n(o.id)} إعجابكِ. يتبقى مبلغ ${owed}؛ شكراً لتسديده.`,
      fa: `سلام ${o.customerName}، امیدواریم از سفارش شمارهٔ ${n(o.id)} راضی باشید. مبلغ ${owed} باقی مانده است؛ ممنون می‌شویم تسویه کنید.`,
    },
    thanks: {
      en: `Hello ${o.customerName}, thank you for choosing ${brand}. We hope you love your order no. ${n(o.id)}.`,
      ar: `مرحباً ${o.customerName}، شكراً لاختياركِ ${brand}. نتمنى أن ينال طلبكِ رقم ${n(o.id)} إعجابكِ.`,
      fa: `سلام ${o.customerName}، از اینکه ${brand} را انتخاب کردید ممنونیم. امیدواریم از سفارش شمارهٔ ${n(o.id)} راضی باشید.`,
    },
  };
  return T[stage][L];
}

/** The first message to a customer about an order, in her language. */
export function customerGreeting(o: Pick<Order, 'id' | 'customerName' | 'items' | 'lang' | 'shipping'>): string {
  return customerMessage(o, 'hello', { owed: 0, currency: { en: '', ar: '', fa: '' } });
}

/** WhatsApp link from the admin panel to a customer's number. */
export const customerWhatsAppLink = (phone: string, text = '') =>
  `https://wa.me/${phone.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
