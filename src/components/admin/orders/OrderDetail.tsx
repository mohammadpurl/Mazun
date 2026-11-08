'use client';
/* One order: where it is in the flow (with its history), the pieces and the money, delivery and payment details,
   and the customer with her address and notes. Every change is saved through PATCH /api/admin/orders/:id, which
   records status changes in the history. */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { ONE_SIZE } from '@/lib/defaults';
import { CARRIER_LABEL, METHOD_LABEL, PAYMENT_LABEL, STATUS_ACTION, STATUS_LABEL } from '@/lib/labels';
import { customerMessage, customerWhatsAppLink, stageOf } from '@/lib/order-message';
import { amountDue, balanceOf, nextStatus, overpaidOn, owedOn } from '@/lib/orders';
import { CARRIERS, PAYMENT_METHODS, type L10n, type Order, type OrderStatus, type PaymentStatus } from '@/lib/types';
import { DatePicker } from '../ui/DatePicker';
import { useUi } from '../ui/Dialog';
import { Dropdown, Menu } from '../ui/Dropdown';
import { Field, PageHeader, PayChip, Segmented, StatusChip, statusIcon } from '../ui/controls';
import { faAgo, faDate, faDateTime, faDigits, faGregorian, faId, faIsoDay, faNum, numInput, phoneOut, todayMuscat } from '../ui/format';
import { AIcon } from '../ui/Icon';
import { Reveal } from '../ui/motion';
import { dayKey } from '@/lib/stats';
import { api } from '../api';
import { CustomerCell, type Pics } from './bits';
import { useOrderFlows } from './flows';

const FLOW: OrderStatus[] = ['new', 'confirmed', 'preparing', 'shipped', 'delivered'];
/** The Muscat calendar day of a stored time, for the date pickers. */
const day = (iso: string | null) => (iso ? dayKey(new Date(iso)) : null);

export function OrderDetail({ initial, pics, cur, brand, history }: {
  initial: Order; pics: Pics; cur: L10n; brand?: L10n; history: { orders: number; spent: number; owed: number } | null;
}) {
  const router = useRouter();
  const { toast, confirm } = useUi();
  const currency = cur.fa || 'ریال';
  const [o, setO] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [ship, setShip] = useState(o.shipping);
  const [payment, setPayment] = useState(o.payment);
  const [note, setNote] = useState(o.adminNote);
  // Money fields keep the typed text ("1." while typing 1.5); the number goes into ship / payment.
  const [feeText, setFeeText] = useState(o.shipping.fee ? String(o.shipping.fee) : '');
  const [paidText, setPaidText] = useState(o.payment.paid ? String(o.payment.paid) : '');
  const resetShip = (sh: Order['shipping']) => { setShip(sh); setFeeText(sh.fee ? String(sh.fee) : ''); };
  const resetPay = (p: Order['payment']) => { setPayment(p); setPaidText(p.paid ? String(p.paid) : ''); };
  /** After a save, refresh the drafts: the part just saved takes the saved values; elsewhere only the fields the admin
   *  changed keep the draft, every other field takes the saved value (a shipping date set by the status change). */
  const merge = <T extends object>(draft: T, before: T, after: T): T =>
    Object.fromEntries(Object.keys(after).map(k => {
      const key = k as keyof T;
      return [k, draft[key] !== before[key] ? draft[key] : after[key]];
    })) as T;
  const absorb = (saved: Order, part: 'ship' | 'pay' | 'note' | 'other') => {
    const was = o;
    setO(saved);
    if (part === 'ship') resetShip(saved.shipping);
    else { const m = merge(ship, was.shipping, saved.shipping); setShip(m); if (m.fee === saved.shipping.fee && ship.fee === was.shipping.fee) setFeeText(m.fee ? String(m.fee) : ''); }
    if (part === 'pay') resetPay(saved.payment);
    else { const m = merge(payment, was.payment, saved.payment); setPayment(m); if (payment.paid === was.payment.paid) setPaidText(m.paid ? String(m.paid) : ''); }
    if (part === 'note' || note === was.adminNote) setNote(saved.adminNote);
  };
  const [errors, setErrors] = useState<Record<string, string>>({});
  const money = (n: number) => `${faNum(n)} ${currency}`;
  const next = nextStatus(o.status);
  const at = FLOW.indexOf(o.status);
  const due = amountDue(o), balance = balanceOf(o);
  const shipDirty = JSON.stringify(ship) !== JSON.stringify(o.shipping);
  const payDirty = JSON.stringify(payment) !== JSON.stringify(o.payment);

  async function patch(body: Record<string, unknown>, what: string, done: string) {
    setBusy(what); setErrors({});
    try {
      const saved = await api<Order>(`/api/admin/orders/${o.id}`, 'PATCH', body);
      absorb(saved, what === 'ship' || what === 'pay' || what === 'note' ? what : 'other');
      toast('ok', done);
      router.refresh();
      return true;
    } catch (e) {
      const er = (e as Error & { errors?: Record<string, string> }).errors;
      if (er) setErrors(er);
      toast('err', 'ذخیره نشد', (e as Error).message);
      return false;
    } finally { setBusy(null); }
  }
  const flows = useOrderFlows({ currency: cur, onSaved: saved => absorb(saved, 'other') });
  /** Shipping, delivery and cancelling ask for their details first; other steps are a plain status change. */
  const move = async (s: OrderStatus) => {
    if (FLOW.includes(s) && FLOW.indexOf(s) < FLOW.indexOf(o.status) && !(await confirm({
      title: `برگرداندن به «${STATUS_LABEL[s]}»`, confirm: 'برگرداندن',
      body: o.shipping.shippedAt ? 'تاریخ‌های ارسال و تحویل این سفارش پاک می‌شوند و در تاریخچه ثبت می‌شود.' : 'تغییر در تاریخچهٔ سفارش ثبت می‌شود.',
    }))) return;
    if (s === 'shipped') return flows.openShip(o);
    if (s === 'delivered') return flows.openDeliver(o);
    if (s === 'cancelled') return flows.openCancel(o);
    await patch({ status: s }, 'status', `وضعیت: ${STATUS_LABEL[s]}`);
  };
  const stage = stageOf({ ...o, owed: owedOn(o) });
  const over = overpaidOn(o);
  const greet = customerWhatsAppLink(o.phone, customerMessage(o, stage, { owed: owedOn(o), currency: cur, brand }));
  const STAGE_LABEL = { hello: 'پیام به مشتری', confirm: 'پیام تأیید و بیعانه', confirmPaid: 'پیام تأیید سفارش', pickup: 'پیام آماده بودن', shipped: 'پیام رهگیری', balance: 'یادآوری مانده', thanks: 'پیام تشکر' } as const;
  const mapHref = `https://www.google.com/maps/search/${encodeURIComponent(`${o.address} ${o.city} Oman`)}`;
  const daysToEvent = o.eventDate ? Math.round((Date.parse(o.eventDate + 'T00:00:00Z') - Date.parse(todayMuscat() + 'T00:00:00Z')) / 86_400_000) : null;

  return (
    <>
      <PageHeader icon="orders" title={`سفارش #${faId(o.id)}`} crumbs={[{ label: 'سفارش‌ها', href: '/admin/orders' }, { label: `#${faId(o.id)}` }]}
        sub={<span className="row" style={{ gap: 8 }}><StatusChip status={o.status} /><PayChip status={o.payment.status} /><span className="xs" suppressHydrationWarning>ثبت‌شده {faDateTime(o.createdAt)} · {faAgo(o.createdAt)}</span></span>}>
        <a className="btn outline wa-o" href={greet} target="_blank" rel="noreferrer" title={`${STAGE_LABEL[stage]} (به زبان سفارش مشتری)`} aria-label={`${STAGE_LABEL[stage]} در واتس‌اپ`}>
          <AIcon name="whatsapp" /><span className="wa-long">{STAGE_LABEL[stage]}</span><span className="wa-short" aria-hidden="true">واتس‌اپ</span>
        </a>
        {next && o.status !== 'cancelled' && (
          <button type="button" className="btn" disabled={!!busy} onClick={() => move(next)}>
            <AIcon name={busy === 'status' ? 'spinner' : statusIcon(next)} className={busy === 'status' ? 'spin' : undefined} />{STATUS_ACTION[next]}
          </button>
        )}
        <Menu label="کارهای بیشتر" buttonClass="icon-btn bordered" items={[
          ...(o.status !== 'cancelled' ? [{ label: 'ویرایش سفارش', icon: 'edit' as const, href: `/admin/orders/${o.id}/edit` }] : []),
          { label: 'فاکتور', icon: 'printer', href: `/admin/invoice/${o.id}`, external: true },
          { label: 'برگهٔ بسته‌بندی (بدون قیمت)', icon: 'package', href: `/admin/invoice/${o.id}?slip=1`, external: true },
          { label: 'خروجی اکسل این سفارش', icon: 'download', href: `/api/admin/orders/export?ids=${o.id}` },
          { label: 'تماس با مشتری', icon: 'phone', href: `tel:+${o.phone}` },
          { divider: true, label: '' },
          ...(o.status === 'cancelled'
            ? [{ label: 'بازگرداندن به جدید', icon: 'undo' as const, onSelect: () => patch({
                status: 'new', statusNote: 'سفارش لغوشده بازگردانده شد',
                // A refunded deposit is no longer held: the restored order starts unpaid.
                ...(o.payment.status === 'refunded' ? { payment: { status: 'unpaid' } } : {}),
              }, 'status', o.payment.status === 'refunded' ? 'سفارش بازگردانده شد؛ پرداختش از صفر ثبت می‌شود' : 'سفارش بازگردانده شد') }]
            : [{ label: 'لغو سفارش', icon: 'xCircle' as const, danger: true, onSelect: () => move('cancelled') }]),
        ]}><AIcon name="more" /></Menu>
      </PageHeader>

      <div className="grid-side reflow">
        <div className="stack">
          {/* where the order is */}
          <Reveal className="card">
            <div className="card-head">
              <span className="tile sm soft"><AIcon name="route" duo /></span>
              <div className="titles"><h2>مراحل سفارش</h2><p>{o.status === 'cancelled' ? 'این سفارش لغو شده است' : next ? `قدم بعدی: ${STATUS_ACTION[next]}` : 'سفارش به دست مشتری رسیده است'}</p></div>
              {o.status !== 'cancelled' && (
                <div style={{ flex: '1 1 180px', maxWidth: 240 }}>
                  <Dropdown label="تغییر وضعیت" value={o.status} onChange={v => v !== o.status && move(v)} disabled={!!busy}
                    options={(['new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'] as OrderStatus[]).map(s => ({ value: s, label: STATUS_LABEL[s], icon: statusIcon(s) }))} />
                </div>
              )}
            </div>
            {o.status !== 'cancelled' && (
              <div className="steps" aria-label={`وضعیت فعلی: ${STATUS_LABEL[o.status]}`}>
                {FLOW.map((s, i) => (
                  <div key={s} className={`s${i < at ? ' done' : ''}${i === at ? (s === 'delivered' ? ' done' : ' now') : ''}`}>
                    <motion.i initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 + i * 0.07, type: 'spring', stiffness: 300, damping: 18 }}>
                      {i < at || (i === at && s === 'delivered') ? <AIcon name="check" /> : <AIcon name={statusIcon(s)} />}
                    </motion.i>
                    <span>{STATUS_LABEL[s]}</span>
                  </div>
                ))}
              </div>
            )}
            <h3 style={{ marginBlockEnd: 12 }}>تاریخچه</h3>
            <ol className="timeline">
              <AnimatePresence initial={false}>
                {[...o.history].reverse().map((h, i) => (
                  <motion.li key={h.at + h.status} className={i === 0 ? 'now' : 'done'} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                    <span className="dotc"><AIcon name={statusIcon(h.status)} /></span>
                    <span className="grow"><b>{STATUS_LABEL[h.status]}</b><span>{faDateTime(h.at)}{h.note ? ` · ${h.note}` : ''}</span></span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          </Reveal>

          {/* pieces and money */}
          <Reveal className="card">
            <div className="card-head">
              <span className="tile sm gold"><AIcon name="bag" duo /></span>
              <div className="titles"><h2>اقلام سفارش</h2><p>{faNum(o.items.reduce((a, i) => a + i.qty, 0))} قطعه · قیمت‌ها هنگام ثبت ذخیره شده‌اند</p></div>
            </div>
            <ul className="items">
              {o.items.map((it, i) => {
                const p = it.garmentId ? pics[it.garmentId] : undefined;
                return (
                  <li key={i}>
                    <span className="thumb" style={{ background: p?.color ?? 'var(--muted)' }}>{p?.img && <img src={p.img} alt="" />}</span>
                    <span className="grow">
                      {it.garmentId ? <Link href={`/admin/garments/${it.garmentId}`} className="strong">{it.name}</Link> : <b>{it.name}</b>}
                      <span>
                        {it.color && <span className="tag">{it.color}</span>}
                        <span className="tag ltr">{it.size === ONE_SIZE ? 'تک‌سایز' : `سایز ${it.size}`}</span>
                        <span className="num">{faNum(it.qty)} × {money(it.price)}</span>
                      </span>
                    </span>
                    <b className="num">{money(it.price * it.qty)}</b>
                  </li>
                );
              })}
            </ul>
            <div className="sum">
              <div><span>جمع اقلام</span><b className="num">{money(o.total)}</b></div>
              <div><span>هزینهٔ ارسال</span><b className="num">{o.shipping.fee ? money(o.shipping.fee) : 'رایگان'}</b></div>
              <div className="total"><span>مبلغ کل</span><span className="num">{money(due)}</span></div>
              <div><span>دریافت‌شده</span><b className="num" style={{ color: 'var(--success-ink)' }}>{money(o.payment.status === 'refunded' ? 0 : o.payment.paid)}</b></div>
              {over > 0 && <div><span>اضافه‌پرداخت (برگشت دهید)</span><b className="num" style={{ color: 'var(--warning-ink)' }}>{money(over)}</b></div>}
              {balance > 0 && <div><span>مانده</span><b className="num" style={{ color: 'var(--danger-ink)' }}>{money(balance)}</b></div>}
            </div>
          </Reveal>

          <div className="grid-2" style={{ gap: 24 }}>
            {/* delivery */}
            <Reveal className="card stack">
              <div className="card-head" style={{ margin: 0 }}>
                <span className="tile sm blue"><AIcon name="shipments" duo /></span>
                <div className="titles"><h2>ارسال</h2><p>{o.shipping.shippedAt ? `ارسال‌شده ${faDate(o.shipping.shippedAt)}` : 'هنوز ارسال نشده'}</p></div>
              </div>
              <Field label="ارسال با">{(id, d) => (
                <Dropdown id={id} describedBy={d} placeholder="انتخاب کنید" value={ship.carrier} onChange={v => setShip(s => ({ ...s, carrier: v }))}
                  options={CARRIERS.map(c => ({ value: c, label: CARRIER_LABEL[c] }))} />
              )}</Field>
              {(o.status === 'shipped' || o.status === 'delivered') && <Field label="کد رهگیری" error={errors.tracking}>{(id, d, bad) => (
                <input id={id} className="input ltr" aria-describedby={d} aria-invalid={bad || undefined} value={ship.tracking} maxLength={60} onChange={e => setShip(s => ({ ...s, tracking: e.target.value }))} placeholder="مثلاً OM123456789" />
              )}</Field>}
              <Field label={`هزینهٔ ارسال (${currency})`} error={errors.fee}>{(id, d, bad) => (
                <input id={id} className="input num" inputMode="decimal" aria-describedby={d} aria-invalid={bad || undefined} value={faDigits(feeText)} placeholder="۰" onChange={e => { const t = numInput(e.target.value); setFeeText(t); setShip(s => ({ ...s, fee: Number(t) || 0 })); }} />
              )}</Field>
              {(o.status === 'shipped' || o.status === 'delivered') ? <div className="form-grid dates">
                <Field label="تاریخ ارسال" error={errors.shippedAt}>{(id, d, bad) => <DatePicker id={id} describedBy={d} invalid={bad} value={day(ship.shippedAt)} max={(o.status === 'delivered' && day(ship.deliveredAt)) || todayMuscat()} onChange={v => setShip(s => ({ ...s, shippedAt: v }))} />}</Field>
                {o.status === 'delivered' && <Field label="تاریخ تحویل" error={errors.deliveredAt}>{(id, d, bad) => <DatePicker id={id} describedBy={d} invalid={bad} value={day(ship.deliveredAt)} min={day(ship.shippedAt) ?? undefined} max={todayMuscat()} onChange={v => setShip(s => ({ ...s, deliveredAt: v }))} />}</Field>}
              </div> : o.status !== 'cancelled' && (
                <button type="button" className="btn outline" style={{ alignSelf: 'flex-start' }} disabled={!!busy || shipDirty} onClick={() => flows.openShip(o)} title={shipDirty ? 'اول تغییرها را ذخیره کنید' : undefined}>
                  <AIcon name="send" />ثبت ارسال (کد رهگیری و تاریخ)
                </button>
              )}
              <AnimatePresence>
                {shipDirty && (
                  <motion.div className="row" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    <button type="button" className="btn" disabled={!!busy} onClick={() => patch({ shipping: ship }, 'ship', 'اطلاعات ارسال ذخیره شد')}>
                      {busy === 'ship' ? 'در حال ذخیره…' : 'ذخیرهٔ ارسال'}
                    </button>
                    <button type="button" className="btn ghost" onClick={() => resetShip(o.shipping)}>انصراف</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </Reveal>

            {/* payment */}
            <Reveal className="card stack" delay={0.06}>
              <div className="card-head" style={{ margin: 0 }}>
                <span className="tile sm olive"><AIcon name="wallet" duo /></span>
                <div className="titles"><h2>پرداخت</h2><p>{balance > 0 ? `مانده: ${money(balance)}` : o.payment.status === 'refunded' ? 'مبلغ بازپرداخت شده' : 'تسویه شده'}</p></div>
              </div>
              <Segmented<PaymentStatus> grid label="وضعیت پرداخت" value={payment.status} onChange={v => { const paid = v === 'paid' ? due : v === 'unpaid' ? 0 : payment.paid; setPayment(p => ({ ...p, status: v, paid })); setPaidText(paid ? String(paid) : ''); }}
                options={(['unpaid', 'partial', 'paid', 'refunded'] as PaymentStatus[]).map(v => ({ value: v, label: PAYMENT_LABEL[v] }))} />
              <Field label="روش پرداخت">{(id, d) => (
                <Dropdown id={id} describedBy={d} placeholder="انتخاب کنید" value={payment.method} onChange={v => setPayment(p => ({ ...p, method: v }))}
                  options={PAYMENT_METHODS.map(m => ({ value: m, label: METHOD_LABEL[m] }))} />
              )}</Field>
              {payment.status === 'partial' && (
                <Field label={`مبلغ دریافت‌شده (${currency})`} help={`از ${money(due)}`} error={errors.paid}>{(id, d, bad) => (
                  <input id={id} className="input num" inputMode="decimal" aria-describedby={d} aria-invalid={bad || undefined} value={faDigits(paidText)} onChange={e => { const t = numInput(e.target.value); setPaidText(t); setPayment(p => ({ ...p, paid: Number(t) || 0 })); }} />
                )}</Field>
              )}
              {payment.status !== 'unpaid' && (
                <Field label="تاریخ دریافت" error={errors.paidAt}>{(id, d, bad) => <DatePicker id={id} describedBy={d} invalid={bad} value={day(payment.paidAt)} max={todayMuscat()} onChange={v => setPayment(p => ({ ...p, paidAt: v }))} />}</Field>
              )}
              <AnimatePresence>
                {payDirty && (
                  <motion.div className="row" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    <button type="button" className="btn" disabled={!!busy} onClick={() => patch({ payment }, 'pay', 'پرداخت ذخیره شد')}>{busy === 'pay' ? 'در حال ذخیره…' : 'ذخیرهٔ پرداخت'}</button>
                    <button type="button" className="btn ghost" onClick={() => resetPay(o.payment)}>انصراف</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </Reveal>
          </div>
        </div>

        {/* the customer */}
        <div className="stack">
          <Reveal className="card stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2>مشتری</h2>
              {o.customerId && <Link className="link xs" href={`/admin/customers/${o.customerId}`}>پروندهٔ مشتری<AIcon name="left" /></Link>}
            </div>
            <CustomerCell o={o} />
            {history && <div className="row xs muted" style={{ gap: 16 }}><span><b className="num" style={{ color: 'var(--fg)' }}>{faNum(history.orders)}</b> سفارش</span><span>مجموع خرید <b className="num" style={{ color: 'var(--fg)' }}>{money(history.spent)}</b></span>{history.owed > 0 && <span style={{ color: 'var(--danger-ink)' }}>مانده کل <b className="num">{money(history.owed)}</b></span>}</div>}
            <div className="row">
              <a className="btn secondary sm" href={`tel:+${o.phone}`}><AIcon name="phone" />تماس</a>
              <a className="btn secondary sm" href={greet} target="_blank" rel="noreferrer"><AIcon name="whatsapp" />واتس‌اپ</a>
              <button type="button" className="btn ghost sm" onClick={() => { navigator.clipboard?.writeText('+' + o.phone); toast('ok', 'شماره کپی شد', phoneOut(o.phone)); }}><AIcon name="copy" />کپی شماره</button>
            </div>
          </Reveal>
          <Reveal className="card stack" delay={0.05}>
            <div className="row" style={{ justifyContent: 'space-between' }}><h2>نشانی تحویل</h2><a className="link xs" href={mapHref} target="_blank" rel="noreferrer">روی نقشه<AIcon name="external" /></a></div>
            <div className="addr def" style={{ boxShadow: 'none' }}>
              <div className="head"><AIcon name="pin" duo /><b>{o.city || 'شهر نامشخص'}</b></div>
              <p>{o.address || 'نشانی ثبت نشده'}</p>
            </div>
            <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => { navigator.clipboard?.writeText(`${o.customerName}\n+${o.phone}\n${o.city}\n${o.address}`); toast('ok', 'نشانی برای برچسب ارسال کپی شد'); }}>
              <AIcon name="copy" />کپی برای برچسب ارسال
            </button>
          </Reveal>
          {o.eventDate && (
            <Reveal className="card" delay={0.08}>
              <div className="row" style={{ gap: 12 }}>
                <span className="tile sm gold"><AIcon name="calendar" duo /></span>
                <div className="grow"><h2>تاریخ مراسم</h2><p className="xs muted">{faIsoDay(o.eventDate)}</p><p className="xs muted">میلادی: {faGregorian(o.eventDate)}</p></div>
                {daysToEvent !== null && <span className={`chip ${daysToEvent < 0 ? 'neutral' : daysToEvent <= 7 ? 'danger' : 'gold'}`} suppressHydrationWarning>{daysToEvent < 0 ? 'گذشته' : daysToEvent === 0 ? 'امروز' : `${faNum(daysToEvent)} روز مانده`}</span>}
              </div>
            </Reveal>
          )}
          {o.note && (
            <Reveal className="card stack" delay={0.1}>
              <h2>یادداشت مشتری</h2>
              <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{o.note}</p>
            </Reveal>
          )}
          <Reveal className="card stack" delay={0.12}>
            <Field label="یادداشت داخلی (مشتری نمی‌بیند)">{(id, d) => (
              <textarea id={id} className="textarea" aria-describedby={d} value={note} maxLength={1000} onChange={e => setNote(e.target.value)} placeholder="مثلاً: آستین ۲ سانت بلندتر، تحویل بعد از ساعت ۵" />
            )}</Field>
            {note !== o.adminNote && (
              <div className="row">
                <button type="button" className="btn sm" disabled={!!busy} onClick={() => patch({ adminNote: note }, 'note', 'یادداشت ذخیره شد')}>{busy === 'note' ? 'در حال ذخیره…' : 'ذخیرهٔ یادداشت'}</button>
                <button type="button" className="btn ghost sm" onClick={() => setNote(o.adminNote)}>انصراف</button>
              </div>
            )}
          </Reveal>
        </div>
      </div>
      {flows.dialogs}
    </>
  );
}
