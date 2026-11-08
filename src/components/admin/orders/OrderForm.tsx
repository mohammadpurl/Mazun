'use client';
/* New order (taken by WhatsApp, phone or in the atelier) or a correction to an existing one: the customer (an
   existing one or a new one), where it goes (a saved address or another), the pieces with size, colour, quantity and
   price (hidden products and sold-out sizes allowed, with a warning), delivery charge, deposit, event date and notes. */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ONE_SIZE } from '@/lib/defaults';
import { METHOD_LABEL, PAYMENT_LABEL } from '@/lib/labels';
import { amountDue } from '@/lib/orders';
import { PAYMENT_METHODS, type Customer, type Lang, type Order, type PaymentMethod } from '@/lib/types';
import { DatePicker } from '../ui/DatePicker';
import { useUi } from '../ui/Dialog';
import { Dropdown } from '../ui/Dropdown';
import { Avatar, Field, PageHeader, Segmented } from '../ui/controls';
import { faDigits, faGregorian, faId, faNum, numInput, phoneOut } from '../ui/format';
import { AIcon } from '../ui/Icon';
import { Reveal } from '../ui/motion';
import { useLeaveGuard } from '../ui/useLeaveGuard';
import { api } from '../api';
import { CityPicker } from '../customers/forms';

/** What the form needs to know about a product. */
export interface ProductPick { id: string; name: string; names: Record<Lang, string>; img: string; color: string; price: number; visible: boolean; sizes: { n: string; ok: boolean }[]; colors: Record<Lang, string>[] }
interface Line { key: string; garmentId: string | null; name: string; size: string; color: number; colorText: string; qty: number; price: string }

const NEW = '__new', OTHER = '__other';
const key = () => Math.random().toString(36).slice(2, 9);

export function OrderForm({ products, customers, currency, initial, presetCustomer }: {
  products: ProductPick[]; customers: Customer[]; currency: string; initial: Order | null; presetCustomer?: string;
}) {
  const router = useRouter();
  const { toast } = useUi();
  const byId = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const startCustomer = initial?.customerId && customers.some(c => c.id === initial.customerId) ? initial.customerId : presetCustomer && customers.some(c => c.id === presetCustomer) ? presetCustomer : initial ? NEW : '';
  const [customerId, setCustomerId] = useState(startCustomer);
  const chosen = customers.find(c => c.id === customerId);
  const [name, setName] = useState(initial?.customerName ?? chosen?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? chosen?.phone ?? '968');
  const [lang, setLang] = useState<Lang>(initial?.lang ?? 'ar');
  const firstAddr = chosen?.addresses.find(a => a.isDefault) ?? chosen?.addresses[0];
  const [addrId, setAddrId] = useState(initial ? OTHER : firstAddr?.id ?? OTHER);
  const [city, setCity] = useState(initial?.city ?? firstAddr?.city ?? '');
  const [address, setAddress] = useState(initial?.address ?? (firstAddr ? [firstAddr.area, firstAddr.line].filter(Boolean).join('، ') : ''));
  const [lines, setLines] = useState<Line[]>(() => initial
    ? initial.items.map(i => {
      const p = i.garmentId ? byId.get(i.garmentId) : undefined;
      const ci = p ? p.colors.findIndex(c => Object.values(c).includes(i.color)) : -1;
      // A colour no longer in the catalogue stays as it was ordered (-1) until another one is picked.
      return { key: key(), garmentId: i.garmentId, name: i.name, size: i.size, color: i.color ? ci : Math.max(0, ci), colorText: i.color, qty: i.qty, price: String(i.price) };
    })
    : []);
  const [fee, setFee] = useState(initial ? String(initial.shipping.fee || '') : '');
  const [status, setStatus] = useState<'new' | 'confirmed'>('confirmed');
  const [pay, setPay] = useState<'unpaid' | 'partial' | 'paid'>('unpaid');
  const [paid, setPaid] = useState('');
  // Cash unless chosen otherwise, so a paid order always says how it was paid.
  const [method, setMethod] = useState<PaymentMethod | ''>('cash');
  const [eventDate, setEventDate] = useState<string | null>(initial?.eventDate ?? null);
  const [note, setNote] = useState(initial?.note ?? '');
  const [adminNote, setAdminNote] = useState(initial?.adminNote ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const snapshot = JSON.stringify([customerId, name, phone, lang, city, address, lines, fee, status, pay, paid, method, eventDate, note, adminNote]);
  const first = useRef(snapshot);
  useLeaveGuard(snapshot !== first.current && !busy);

  // Picking a customer fills her name, phone and default address.
  useEffect(() => {
    if (!chosen || (initial && chosen.id === initial.customerId)) return;
    setName(chosen.name); setPhone(chosen.phone);
    const a = chosen.addresses.find(x => x.isDefault) ?? chosen.addresses[0];
    setAddrId(a?.id ?? OTHER);
    if (a) { setCity(a.city); setAddress([a.area, a.line].filter(Boolean).join('، ')); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const subtotal = lines.reduce((a, l) => a + (Number(l.price) || 0) * l.qty, 0);
  const total = Math.round((subtotal + (Number(fee) || 0)) * 1000) / 1000;
  const paidN = pay === 'paid' ? total : pay === 'partial' ? Number(paid) || 0 : 0;
  const money = (n: number) => `${faNum(Math.round(n * 1000) / 1000)} ${currency}`;
  const setLine = (k: string, p: Partial<Line>) => setLines(ls => ls.map(l => (l.key === k ? { ...l, ...p } : l)));
  const addLine = (garmentId?: string) => {
    const p = garmentId ? byId.get(garmentId) : products.find(x => x.visible) ?? products[0];
    if (!p) return;
    setLines(ls => [...ls, { key: key(), garmentId: p.id, name: p.name, size: p.sizes.find(s => s.ok)?.n ?? p.sizes[0]?.n ?? ONE_SIZE, color: 0, colorText: '', qty: 1, price: String(p.price) }]);
  };
  const pickProduct = (k: string, id: string) => {
    const p = byId.get(id);
    if (!p) return;
    setLine(k, { garmentId: id, name: p.name, size: p.sizes.find(s => s.ok)?.n ?? p.sizes[0]?.n ?? ONE_SIZE, color: 0, colorText: '', price: String(p.price) });
  };

  async function save() {
    setBusy(true); setErrors({});
    const body = {
      customerId: customerId && customerId !== NEW ? customerId : null, customerName: name, phone, city, address, note, adminNote, eventDate, lang, fee,
      status, payment: { status: pay, method, paid: pay === 'partial' ? paid : 0 },
      items: lines.map(l => {
        const p = l.garmentId ? byId.get(l.garmentId) : undefined;
        const c = l.color >= 0 ? p?.colors[l.color] : undefined;
        return { garmentId: l.garmentId, name: l.name, size: l.size, color: c ? c[lang] || c.fa || c.en : l.colorText, qty: l.qty, price: l.price };
      }),
    };
    try {
      const o = initial ? await api<Order>(`/api/admin/orders/${initial.id}`, 'PUT', body) : await api<Order>('/api/admin/orders', 'POST', body);
      toast('ok', initial ? 'سفارش ویرایش شد' : `سفارش #${faId(o.id)} ثبت شد`, o.customerName);
      router.push(`/admin/orders/${o.id}`);
      router.refresh();
    } catch (e) {
      const er = (e as Error & { errors?: Record<string, string> }).errors;
      if (er) setErrors(er);
      toast('err', 'ذخیره نشد', (e as Error).message);
      setBusy(false);
    }
  }

  const productOptions = products.map(p => ({ value: p.id, label: p.name, swatch: p.color, hint: !p.visible ? 'پنهان' : p.sizes.every(s => !s.ok) ? 'ناموجود' : undefined }));
  const back = initial ? `/admin/orders/${initial.id}` : '/admin/orders';

  return (
    <>
      <PageHeader icon="orders" title={initial ? `ویرایش سفارش #${faId(initial.id)}` : 'سفارش جدید'}
        crumbs={[{ label: 'سفارش‌ها', href: '/admin/orders' }, ...(initial ? [{ label: `#${faId(initial.id)}`, href: back }] : []), { label: initial ? 'ویرایش' : 'سفارش جدید' }]}
        sub={initial ? 'تغییر اقلام، قیمت‌ها، مشتری یا نشانی؛ در تاریخچهٔ سفارش ثبت می‌شود.' : 'سفارشی که در واتس‌اپ، تلفن یا حضوری گرفته‌اید؛ مثل سفارش فروشگاه در گزارش‌ها می‌آید.'} />

      <div className="grid-side">
        <div className="stack">
          <Reveal className="card stack">
            <div className="card-head" style={{ margin: 0 }}><span className="tile sm soft"><AIcon name="user" duo /></span><div className="titles"><h2>مشتری</h2><p>از مشتریان ثبت‌شده انتخاب کنید یا مشتری تازه وارد کنید</p></div></div>
            <Field label="مشتری">{(id, d) => (
              <Dropdown id={id} describedBy={d} searchable placeholder="انتخاب مشتری" value={customerId} onChange={setCustomerId}
                options={[{ value: NEW, label: 'مشتری جدید…', icon: 'userPlus' as const }, ...customers.map(c => ({ value: c.id, label: c.name, hint: phoneOut(c.phone) }))]} />
            )}</Field>
            {(customerId === NEW || chosen) && (
              <div className="form-grid">
                <Field label="نام و نام خانوادگی" error={errors.customerName}>{(id, d, bad) => <input id={id} className="input" aria-describedby={d} aria-invalid={bad || undefined} value={name} maxLength={80} onChange={e => setName(e.target.value)} />}</Field>
                <Field label="شمارهٔ موبایل" help="با کد کشور" error={errors.phone}>{(id, d, bad) => <input id={id} className="input ltr" inputMode="tel" aria-describedby={d} aria-invalid={bad || undefined} value={phone} maxLength={20} onChange={e => setPhone(e.target.value)} />}</Field>
              </div>
            )}
            <Field label="زبان پیام‌ها و فاکتور مشتری">{() => (
              <Segmented<Lang> label="زبان مشتری" value={lang} onChange={setLang} options={[{ value: 'ar', label: 'عربی' }, { value: 'en', label: 'English' }, { value: 'fa', label: 'فارسی' }]} />
            )}</Field>
          </Reveal>

          <Reveal className="card stack">
            <div className="card-head" style={{ margin: 0 }}><span className="tile sm blue"><AIcon name="pin" duo /></span><div className="titles"><h2>نشانی تحویل</h2><p>یکی از نشانی‌های ذخیره‌شده یا نشانی دیگر؛ نشانی تازه روی مشتری هم ذخیره می‌شود</p></div></div>
            {chosen && chosen.addresses.length > 0 && (
              <Field label="نشانی">{(id, d) => (
                <Dropdown id={id} describedBy={d} value={addrId} onChange={v => {
                  setAddrId(v);
                  const a = chosen.addresses.find(x => x.id === v);
                  if (a) { setCity(a.city); setAddress([a.area, a.line].filter(Boolean).join('، ')); }
                }} options={[...chosen.addresses.map(a => ({ value: a.id, label: `${a.label} · ${a.city}`, icon: 'home' as const, hint: a.isDefault ? 'پیش‌فرض' : undefined })), { value: OTHER, label: 'نشانی دیگر…', icon: 'edit' as const }]} />
              )}</Field>
            )}
            <div className="form-grid">
              <Field label="شهر">{(id, d) => <CityPicker id={id} describedBy={d} value={city} onChange={v => { setCity(v); setAddrId(OTHER); }} />}</Field>
              <Field label="تاریخ مراسم (اختیاری)" help={eventDate ? `میلادی: ${faGregorian(eventDate)}` : 'مشتری‌های عمانی معمولاً تاریخ میلادی می‌گویند؛ معادل میلادی اینجا نشان داده می‌شود'}>{(id, d) => <DatePicker id={id} describedBy={d} value={eventDate} onChange={setEventDate} />}</Field>
              <Field label="نشانی کامل" className="full">{(id, d) => <textarea id={id} className="textarea" aria-describedby={d} value={address} maxLength={300} style={{ minHeight: 72 }} onChange={e => { setAddress(e.target.value); setAddrId(OTHER); }} />}</Field>
            </div>
          </Reveal>

          <Reveal className="card stack">
            <div className="card-head wrap-phone" style={{ margin: 0 }}>
              <span className="tile sm gold"><AIcon name="bag" duo /></span>
              <div className="titles"><h2>اقلام</h2><p>قیمت هر قلم را برای تخفیف یا هزینهٔ دوخت سفارشی تغییر دهید</p></div>
              <button type="button" className="btn outline sm" onClick={() => addLine()} disabled={lines.length >= 20}><AIcon name="plus" />افزودن قلم</button>
            </div>
            {errors.items && <span className="err" role="alert"><AIcon name="warning" />{errors.items}</span>}
            {!lines.length && <button type="button" className="add-tile" onClick={() => addLine()}><AIcon name="plus" />اولین قلم را اضافه کنید</button>}
            <AnimatePresence initial={false}>
              {lines.map((l, i) => {
                const p = l.garmentId ? byId.get(l.garmentId) : undefined;
                const size = p?.sizes.find(s => s.n === l.size);
                const listPrice = p?.price ?? 0;
                const priceN = Number(l.price) || 0;
                return (
                  <motion.div key={l.key} layout className="order-line" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginBlock: 0, paddingBlock: 0 }}>
                    <span className="thumb" style={{ background: p?.color ?? 'var(--muted)' }}>{p?.img && <img src={p.img} alt="" />}</span>
                    <div className="fields">
                      <Field label={`قلم ${faNum(i + 1)}`} className="wide">{(id, d) => (
                        p || !l.garmentId
                          ? <Dropdown id={id} describedBy={d} searchable placeholder="انتخاب محصول" value={l.garmentId ?? ''} onChange={v => pickProduct(l.key, v)} options={productOptions} />
                          : <input id={id} className="input" aria-describedby={d} value={l.name} readOnly title="این محصول از کاتالوگ حذف شده است" />
                      )}</Field>
                      <Field label="سایز">{(id, d) => (
                        p ? <Dropdown id={id} describedBy={d} value={l.size} onChange={v => setLine(l.key, { size: v })}
                          options={p.sizes.map(s => ({ value: s.n, label: s.n === ONE_SIZE ? 'تک‌سایز' : s.n, hint: s.ok ? undefined : 'تمام شده' }))} />
                          : <input id={id} className="input ltr" aria-describedby={d} value={l.size} maxLength={12} onChange={e => setLine(l.key, { size: e.target.value.toUpperCase() })} />
                      )}</Field>
                      {p && (p.colors.length > 1 || l.color < 0) && (
                        <Field label="رنگ">{(id, d) => <Dropdown id={id} describedBy={d} value={String(l.color)} onChange={v => setLine(l.key, { color: Number(v) })}
                          options={[...(l.color < 0 ? [{ value: '-1', label: `${l.colorText} (سفارش‌داده‌شده)` }] : []), ...p.colors.map((c, j) => ({ value: String(j), label: c.fa || c.en }))]} />}</Field>
                      )}
                      <Field label="تعداد">{(id) => (
                        <div className="qty">
                          <button type="button" className="icon-btn sm" aria-label="یکی کمتر" disabled={l.qty <= 1} onClick={() => setLine(l.key, { qty: l.qty - 1 })}><AIcon name="minus" /></button>
                          <output id={id} className="num" aria-live="polite">{faNum(l.qty)}</output>
                          <button type="button" className="icon-btn sm" aria-label="یکی بیشتر" disabled={l.qty >= 50} onClick={() => setLine(l.key, { qty: l.qty + 1 })}><AIcon name="plus" /></button>
                        </div>
                      )}</Field>
                      <Field label={`قیمت واحد (${currency})`} help={p && priceN !== listPrice ? (priceN < listPrice ? `${faNum(Math.round((1 - priceN / listPrice) * 100))}٪ کمتر از قیمت فروشگاه` : 'بیشتر از قیمت فروشگاه') : undefined}>{(id, d) => (
                        <input id={id} className="input num" inputMode="decimal" aria-describedby={d} value={faDigits(l.price)} onChange={e => setLine(l.key, { price: numInput(e.target.value) })} />
                      )}</Field>
                    </div>
                    <div className="end">
                      <b className="num">{money(priceN * l.qty)}</b>
                      <button type="button" className="icon-btn sm" aria-label={`حذف قلم ${faNum(i + 1)}`} onClick={() => setLines(ls => ls.filter(x => x.key !== l.key))}><AIcon name="trash" /></button>
                    </div>
                    {p && (!p.visible || (size && !size.ok)) && (
                      <span className="chip warn line-warn"><AIcon name="warning" />{!p.visible ? 'این محصول در فروشگاه پنهان است' : 'این سایز در فروشگاه «تمام شده» است'}</span>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </Reveal>

          <Reveal className="card stack">
            <div className="card-head" style={{ margin: 0 }}><span className="tile sm soft"><AIcon name="note" duo /></span><div className="titles"><h2>یادداشت‌ها</h2></div></div>
            <div className="form-grid">
              <Field label="خواستهٔ مشتری">{(id, d) => <textarea id={id} className="textarea" aria-describedby={d} value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder="مثلاً: آستین ۲ سانت کوتاه‌تر" />}</Field>
              <Field label="یادداشت داخلی (مشتری نمی‌بیند)">{(id, d) => <textarea id={id} className="textarea" aria-describedby={d} value={adminNote} maxLength={1000} onChange={e => setAdminNote(e.target.value)} />}</Field>
            </div>
          </Reveal>
        </div>

        <div className="stack form-aside">
          <Reveal className="card stack">
            <h2>جمع سفارش</h2>
            {chosen && <span className="who"><Avatar name={chosen.name} seed={chosen.phone} size="sm" /><span className="meta"><b>{chosen.name}</b><span className="ltr" style={{ textAlign: 'start' }}>{phoneOut(chosen.phone)}</span></span></span>}
            <Field label={`هزینهٔ ارسال (${currency})`} error={errors.fee}>{(id, d, bad) => <input id={id} className="input num" inputMode="decimal" aria-describedby={d} aria-invalid={bad || undefined} value={faDigits(fee)} placeholder="۰" onChange={e => setFee(numInput(e.target.value))} />}</Field>
            <div className="sum">
              <div><span>جمع اقلام ({faNum(lines.reduce((a, l) => a + l.qty, 0))} قطعه)</span><b className="num">{money(subtotal)}</b></div>
              <div><span>هزینهٔ ارسال</span><b className="num">{Number(fee) ? money(Number(fee)) : 'رایگان'}</b></div>
              <div className="total"><span>مبلغ کل</span><span className="num">{money(total)}</span></div>
              {!initial && paidN > 0 && <div><span>مانده</span><b className="num" style={{ color: 'var(--danger-ink)' }}>{money(Math.max(0, total - paidN))}</b></div>}
            </div>
            {!initial && <>
              <Field label="وضعیت سفارش">{() => <Segmented label="وضعیت شروع" value={status} onChange={setStatus} options={[{ value: 'confirmed', label: 'تأییدشده' }, { value: 'new', label: 'جدید (منتظر تأیید)' }]} />}</Field>
              <Field label="پرداخت">{() => <Segmented label="پرداخت" value={pay} onChange={setPay} options={[{ value: 'unpaid', label: PAYMENT_LABEL.unpaid }, { value: 'partial', label: PAYMENT_LABEL.partial }, { value: 'paid', label: PAYMENT_LABEL.paid }]} />}</Field>
              {pay === 'partial' && <Field label={`بیعانهٔ دریافت‌شده (${currency})`} error={errors.paid}>{(id, d, bad) => <input id={id} className="input num" inputMode="decimal" aria-describedby={d} aria-invalid={bad || undefined} value={faDigits(paid)} onChange={e => setPaid(numInput(e.target.value))} />}</Field>}
              {pay !== 'unpaid' && <Field label="روش پرداخت">{(id, d) => <Dropdown id={id} describedBy={d} value={method} onChange={v => setMethod(v)} options={PAYMENT_METHODS.map(m => ({ value: m, label: METHOD_LABEL[m] }))} />}</Field>}
            </>}
            {initial && <p className="xs muted">پرداخت و ارسال را در صفحهٔ سفارش ثبت کنید.{initial.payment.paid > 0 ? ` تا الان ${money(initial.payment.paid)} دریافت شده.` : ''}</p>}
            {initial && initial.payment.status !== 'refunded' && initial.payment.paid > 0 && total !== amountDue(initial) && (
              total < initial.payment.paid
                ? <p className="xs" role="status" style={{ color: 'var(--warning-ink)' }}>مبلغ کل از دریافتی کمتر می‌شود: {money(initial.payment.paid - total)} اضافه‌پرداخت روی سفارش نشان داده می‌شود تا به مشتری برگردانده شود.</p>
                : total > initial.payment.paid && <p className="xs" role="status" style={{ color: 'var(--warning-ink)' }}>با این تغییر {money(total - initial.payment.paid)} مانده روی سفارش ثبت می‌شود.</p>
            )}
            <button type="button" className="btn block" onClick={save} disabled={busy || !lines.length || (!customerId && !initial)} aria-describedby={!lines.length || (!customerId && !initial) ? 'save-why' : undefined}>
              {busy ? <><AIcon name="spinner" className="spin" />در حال ذخیره…</> : <><AIcon name="check" />{initial ? 'ذخیرهٔ تغییرات' : 'ثبت سفارش'}</>}
            </button>
            {(!lines.length || (!customerId && !initial)) && <p id="save-why" className="xs muted" style={{ textAlign: 'center' }}>برای ثبت، مشتری و دست‌کم یک قلم لازم است</p>}
            <Link className="btn ghost block" href={back}>انصراف</Link>
          </Reveal>
        </div>
      </div>
    </>
  );
}
