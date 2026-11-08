import { notFound } from 'next/navigation';
import { PrintButton } from '@/components/admin/invoice/PrintButton';
import { requireAdminPage } from '@/lib/auth';
import { db } from '@/lib/db';
import { ONE_SIZE } from '@/lib/defaults';
import { amountDue, balanceOf } from '@/lib/orders';
import type { Carrier, L10n, Lang } from '@/lib/types';
import './invoice.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'فاکتور', robots: { index: false, follow: false } };

/* The invoice and packing slip for one order, in the language the customer ordered in, laid out for an A4 sheet
   or a phone screen. Outside the panel frame so it prints clean. */
const T: Record<Lang, Record<string, string>> = {
  en: { slip: 'Packing slip', from: 'From', carrier: 'Shipped with', tracking: 'Tracking', cod: 'Collect on delivery', invoice: 'Invoice', order: 'Order', date: 'Date', to: 'Deliver to', phone: 'Phone', item: 'Piece', size: 'Size', qty: 'Qty', price: 'Price', amount: 'Amount', subtotal: 'Pieces', delivery: 'Delivery', total: 'Total', paid: 'Paid', due: 'Balance due', oneSize: 'One size', event: 'Event date', free: 'Free', thanks: 'Thank you for choosing us.' },
  ar: { slip: 'قائمة التعبئة', from: 'من', carrier: 'الشحن مع', tracking: 'رقم التتبع', cod: 'المبلغ عند الاستلام', invoice: 'فاتورة', order: 'طلب', date: 'التاريخ', to: 'التوصيل إلى', phone: 'الهاتف', item: 'القطعة', size: 'المقاس', qty: 'الكمية', price: 'السعر', amount: 'المبلغ', subtotal: 'القطع', delivery: 'التوصيل', total: 'الإجمالي', paid: 'المدفوع', due: 'المتبقي', oneSize: 'مقاس واحد', event: 'تاريخ المناسبة', free: 'مجاني', thanks: 'شكراً لاختياركِ لنا.' },
  fa: { slip: 'برگهٔ بسته‌بندی', from: 'فرستنده', carrier: 'ارسال با', tracking: 'کد رهگیری', cod: 'دریافت هنگام تحویل', invoice: 'فاکتور', order: 'سفارش', date: 'تاریخ', to: 'تحویل به', phone: 'تلفن', item: 'قطعه', size: 'سایز', qty: 'تعداد', price: 'قیمت', amount: 'مبلغ', subtotal: 'جمع اقلام', delivery: 'ارسال', total: 'مبلغ کل', paid: 'پرداخت‌شده', due: 'مانده', oneSize: 'تک‌سایز', event: 'تاریخ مراسم', free: 'رایگان', thanks: 'از انتخاب شما سپاسگزاریم.' },
};
const LOCALE: Record<Lang, string> = { en: 'en-GB', ar: 'ar-OM', fa: 'fa-IR' };

const CARRIER: Record<Carrier, L10n> = {
  courier: { en: 'Atelier courier', ar: 'مندوب الأتيليه', fa: 'پیک آتلیه' }, omanpost: { en: 'Oman Post', ar: 'بريد عُمان', fa: 'پست عمان' },
  aramex: { en: 'Aramex', ar: 'أرامكس', fa: 'آرامکس' }, dhl: { en: 'DHL', ar: 'DHL', fa: 'DHL' }, smsa: { en: 'SMSA', ar: 'سمسا', fa: 'SMSA' },
  pickup: { en: 'Pickup at the atelier', ar: 'الاستلام من الأتيليه', fa: 'تحویل حضوری در آتلیه' },
};

/** ?slip=1 is the packing slip: the same sheet without prices (for gifts), with the amount to collect if any. */
export default async function Invoice({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ slip?: string }> }) {
  await requireAdminPage();
  const slip = (await searchParams).slip === '1';
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id)) notFound();
  const [order, settings] = await Promise.all([db().getOrder(id), db().getSettings()]);
  if (!order) notFound();
  const L = order.lang, t = T[L], cur = settings.currency[L] || settings.currency.en;
  const num = (n: number) => n.toLocaleString(LOCALE[L], { maximumFractionDigits: 3 });
  const money = (n: number) => `${num(n)} ${cur}`;
  const date = (iso: string) => new Intl.DateTimeFormat(LOCALE[L], { timeZone: 'Asia/Muscat', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
  const paid = order.payment.status === 'refunded' ? 0 : order.payment.paid;
  return (
    <main className="inv" lang={L} dir={L === 'en' ? 'ltr' : 'rtl'}>
      <div className="inv-bar"><PrintButton /></div>
      <article className="inv-page">
        <header className="inv-head">
          <div>
            <b className="inv-brand">{settings.brand.en || 'MAZUN ATELIER'}</b>
            {L !== 'en' && settings.brand[L] && settings.brand[L] !== settings.brand.en && <span>{settings.brand[L]}</span>}
            {settings.tagline[L] && <span>{settings.tagline[L]}</span>}
            <span className="inv-contact">{[settings.originCity[L], settings.whatsapp && `WhatsApp +${settings.whatsapp}`, settings.instagram && `Instagram @${settings.instagram}`].filter(Boolean).join(' · ')}</span>
          </div>
          <div className="inv-meta">
            <h1>{slip ? t.slip : t.invoice}</h1>
            <span>{t.order} #{order.id}</span>
            <span>{t.date}: {date(order.createdAt)}</span>
          </div>
        </header>
        <section className="inv-to">
          <h2>{t.to}</h2>
          <b>{order.customerName}</b>
          <span dir="ltr">+{order.phone}</span>
          <span>{[order.city, order.address].filter(Boolean).join(' · ')}</span>
          {order.eventDate && <span>{t.event}: {date(order.eventDate + 'T12:00:00Z')}</span>}
          {order.shipping.carrier && <span>{t.carrier}: {CARRIER[order.shipping.carrier][L]}{order.shipping.tracking ? <> · {t.tracking}: <span dir="ltr">{order.shipping.tracking}</span></> : null}</span>}
        </section>
        <table className="inv-items">
          <thead><tr><th>{t.item}</th><th>{t.size}</th><th>{t.qty}</th>{!slip && <><th>{t.price}</th><th>{t.amount}</th></>}</tr></thead>
          <tbody>
            {order.items.map((it, i) => (
              <tr key={i}>
                <td>{it.name}{it.color ? <small> · {it.color}</small> : null}</td>
                <td dir="ltr">{it.size === ONE_SIZE ? t.oneSize : it.size}</td>
                <td className="inv-qty">{num(it.qty)}</td>
                {!slip && <><td>{money(it.price)}</td><td>{money(it.price * it.qty)}</td></>}
              </tr>
            ))}
          </tbody>
        </table>
        {slip ? (balanceOf(order) > 0 && <dl className="inv-sum"><dt className="due big">{t.cod}</dt><dd className="due big">{money(balanceOf(order))}</dd></dl>) : <dl className="inv-sum">
          <dt>{t.subtotal}</dt><dd>{money(order.total)}</dd>
          <dt>{t.delivery}</dt><dd>{order.shipping.fee ? money(order.shipping.fee) : t.free}</dd>
          <dt className="big">{t.total}</dt><dd className="big">{money(amountDue(order))}</dd>
          <dt>{t.paid}</dt><dd>{money(paid)}</dd>
          {balanceOf(order) > 0 && <><dt className="due">{order.status === 'shipped' || order.status === 'preparing' || order.status === 'confirmed' ? t.cod : t.due}</dt><dd className="due">{money(balanceOf(order))}</dd></>}
        </dl>}
        <footer className="inv-foot">{t.thanks}</footer>
      </article>
    </main>
  );
}
