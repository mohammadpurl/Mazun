'use client';
/* The three steps that need more than a status change, shared by the order page and the shipments page:
   - Ship: carrier, tracking code, delivery charge and date; afterwards, the tracking message for WhatsApp.
   - Deliver: if money is still owed, was it collected at the door (and how)?
   - Cancel: why, and if a deposit was paid, was it returned or kept?
   `useOrderFlows` returns the three openers and the dialogs to render once. */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CARRIER_LABEL, METHOD_LABEL } from '@/lib/labels';
import { customerMessage, customerWhatsAppLink } from '@/lib/order-message';
import { balanceOf, owedOn } from '@/lib/orders';
import { cityGroup } from '@/lib/places';
import { CARRIERS, PAYMENT_METHODS, type Carrier, type L10n, type Order, type PaymentMethod } from '@/lib/types';
import { DatePicker } from '../ui/DatePicker';
import { Dialog, useUi } from '../ui/Dialog';
import { Dropdown } from '../ui/Dropdown';
import { Field, Segmented } from '../ui/controls';
import { faDigits, faId, faNum, numInput, todayMuscat } from '../ui/format';
import { AIcon } from '../ui/Icon';
import { api } from '../api';

const REASONS = ['مشتری منصرف شد', 'مشتری پاسخ نداد', 'سایز یا پارچه تمام شد', 'سفارش تکراری بود', 'دلیل دیگر…'];

export function useOrderFlows({ currency, onSaved }: { currency: L10n; onSaved: (o: Order) => void }) {
  const router = useRouter();
  const { toast } = useUi();
  const cur = currency.fa || 'ریال';
  const [busy, setBusy] = useState(false);
  const [ship, setShip] = useState<{ o: Order; done: Order | null } | null>(null);
  const [shipForm, setShipForm] = useState({ carrier: '' as Carrier | '', tracking: '', fee: '', shippedAt: todayMuscat() as string | null });
  const [deliver, setDeliver] = useState<Order | null>(null);
  const [collected, setCollected] = useState<'yes' | 'no'>('yes');
  const [method, setMethod] = useState<PaymentMethod | ''>('cash');
  const [cancel, setCancel] = useState<Order | null>(null);
  const [reason, setReason] = useState(REASONS[0]);
  const [other, setOther] = useState('');
  const [deposit, setDeposit] = useState<'kept' | 'refunded'>('kept');

  async function patch(o: Order, body: Record<string, unknown>, done: string) {
    setBusy(true);
    try {
      const saved = await api<Order>(`/api/admin/orders/${o.id}`, 'PATCH', body);
      onSaved(saved);
      toast('ok', done);
      router.refresh();
      return saved;
    } catch (e) { toast('err', 'ذخیره نشد', (e as Error).message); return null; }
    finally { setBusy(false); }
  }

  const openShip = (o: Order) => {
    setShipForm({ carrier: o.shipping.carrier || (cityGroup(o.city).key === 'muscat' ? 'courier' : 'omanpost'), tracking: o.shipping.tracking, fee: o.shipping.fee ? String(o.shipping.fee) : '', shippedAt: todayMuscat() });
    setShip({ o, done: null });
  };
  const openDeliver = (o: Order) => { setCollected('yes'); setMethod(o.payment.method || 'cash'); setDeliver(o); };
  const openCancel = (o: Order) => { setReason(REASONS[0]); setOther(''); setDeposit('kept'); setCancel(o); };

  const owed = deliver ? balanceOf(deliver) : 0;
  const dialogs = (
    <>
      <Dialog open={!!ship} onClose={() => !busy && setShip(null)} title={ship ? (ship.done ? (ship.done.shipping.carrier === 'pickup' ? `سفارش #${faId(ship.o.id)} آمادهٔ تحویل حضوری است` : `سفارش #${faId(ship.o.id)} ارسال شد`) : `ثبت ارسال سفارش #${faId(ship.o.id)}`) : ''} icon={ship?.done ? 'done' : 'send'} busy={busy}
        footer={ship?.done ? <>
          <button type="button" className="btn outline" onClick={() => setShip(null)}>بستن</button>
          <a className="btn wa" href={customerWhatsAppLink(ship.done.phone, customerMessage(ship.done, ship.done.shipping.carrier === 'pickup' ? 'pickup' : 'shipped', { owed: balanceOf(ship.done), currency }))} target="_blank" rel="noreferrer" data-autofocus>
            <AIcon name="whatsapp" />{ship.done.shipping.carrier === 'pickup' ? 'فرستادن پیام آماده بودن' : 'فرستادن پیام رهگیری'}
          </a>
        </> : <>
          <button type="button" className="btn outline" onClick={() => setShip(null)} disabled={busy}>انصراف</button>
          <button type="button" className="btn" disabled={busy || !shipForm.carrier || !shipForm.shippedAt} onClick={async () => {
            if (!ship) return;
            const saved = await patch(ship.o, { status: 'shipped', shipping: { carrier: shipForm.carrier, tracking: shipForm.tracking, fee: shipForm.fee || 0, shippedAt: shipForm.shippedAt } }, `سفارش #${faId(ship.o.id)} ارسال شد`);
            if (saved) setShip({ o: ship.o, done: saved });
          }}>{busy ? 'در حال ثبت…' : 'ثبت ارسال'}</button>
        </>}>
        {ship && !ship.done && <>
          <p className="muted">{ship.o.customerName} · {cityGroup(ship.o.city).name}{ship.o.address ? ` · ${ship.o.address}` : ''}</p>
          {balanceOf(ship.o) > 0 && <span className="chip warn" style={{ alignSelf: 'flex-start' }}><AIcon name="wallet" />دریافت هنگام تحویل: {faNum(balanceOf(ship.o))} {cur}</span>}
          {ship.o.payment.status === 'paid' && Number(shipForm.fee) > ship.o.shipping.fee && <p className="xs" style={{ color: 'var(--warning-ink)' }}>این سفارش تسویه شده؛ {faNum(Number(shipForm.fee) - ship.o.shipping.fee)} {cur} هزینهٔ ارسال به‌عنوان مانده به حساب مشتری اضافه می‌شود.</p>}
          <div className="form-grid">
            <Field label="ارسال با">{(id, d) => <Dropdown id={id} describedBy={d} value={shipForm.carrier} onChange={v => setShipForm(f => ({ ...f, carrier: v }))} options={CARRIERS.map(c => ({ value: c, label: CARRIER_LABEL[c] }))} />}</Field>
            <Field label="تاریخ ارسال">{(id, d) => <DatePicker id={id} describedBy={d} value={shipForm.shippedAt} max={todayMuscat()} clearable={false} onChange={v => setShipForm(f => ({ ...f, shippedAt: v }))} />}</Field>
            <Field label="کد رهگیری" help="برای پیک آتلیه و تحویل حضوری لازم نیست">{(id, d) => <input id={id} className="input ltr" aria-describedby={d} value={shipForm.tracking} maxLength={60} onChange={e => setShipForm(f => ({ ...f, tracking: e.target.value }))} data-autofocus />}</Field>
            <Field label={`هزینهٔ ارسال (${cur})`} help="به مبلغی که مشتری می‌پردازد اضافه می‌شود">{(id, d) => <input id={id} className="input num" inputMode="decimal" aria-describedby={d} value={faDigits(shipForm.fee)} placeholder="۰" onChange={e => setShipForm(f => ({ ...f, fee: numInput(e.target.value) }))} />}</Field>
          </div>
        </>}
        {ship?.done && <p className="muted">{ship.done.shipping.carrier === 'pickup' ? 'به مشتری خبر دهید که سفارشش آماده است' : 'کد رهگیری و نام شرکت ارسال را با یک پیام آماده برای مشتری بفرستید'}{balanceOf(ship.done) > 0 ? '؛ مبلغ قابل پرداخت هم در پیام هست' : ''}{ship.done.lang !== 'fa' ? ` (به زبان سفارشش: ${ship.done.lang === 'ar' ? 'عربی' : 'انگلیسی'})` : ''}.</p>}
      </Dialog>

      <Dialog open={!!deliver} onClose={() => !busy && setDeliver(null)} title={deliver ? `تحویل سفارش #${faId(deliver.id)}` : ''} icon="sealCheck" busy={busy}
        footer={<>
          <button type="button" className="btn outline" onClick={() => setDeliver(null)} disabled={busy}>انصراف</button>
          <button type="button" className="btn" disabled={busy || (owed > 0 && collected === 'yes' && !method)} data-autofocus onClick={async () => {
            if (!deliver) return;
            const body: Record<string, unknown> = { status: 'delivered' };
            if (owed > 0 && collected === 'yes') body.payment = { status: 'paid', method };
            if (await patch(deliver, body, owed > 0 && collected === 'yes' ? 'تحویل و تسویه ثبت شد' : 'تحویل ثبت شد')) setDeliver(null);
          }}>{busy ? 'در حال ثبت…' : 'ثبت تحویل'}</button>
        </>}>
        {deliver && (owed > 0 ? <>
          <div className="alert"><AIcon name="wallet" duo /><div className="grow"><b>مانده {faNum(owed)} {cur} است</b><p>هنگام تحویل دریافت شد؟</p></div></div>
          <Segmented label="دریافت مانده" value={collected} onChange={setCollected} options={[{ value: 'yes', label: 'بله، تسویه شد' }, { value: 'no', label: 'هنوز نه' }]} />
          {collected === 'yes'
            ? <Field label="روش پرداخت">{(id, d) => <Dropdown id={id} describedBy={d} value={method} onChange={v => setMethod(v)} options={PAYMENT_METHODS.map(m => ({ value: m, label: METHOD_LABEL[m] }))} />}</Field>
            : <p className="xs muted">مانده روی سفارش و در «مانده دریافت» داشبورد باقی می‌ماند تا پیگیری شود.</p>}
        </> : <p className="muted">سفارش {deliver.customerName} به‌عنوان «تحویل شده» ثبت می‌شود. پرداخت آن کامل است.</p>)}
      </Dialog>

      <Dialog open={!!cancel} onClose={() => !busy && setCancel(null)} title={cancel ? `لغو سفارش #${faId(cancel.id)}` : ''} icon="xCircle" busy={busy}
        footer={<>
          <button type="button" className="btn outline" onClick={() => setCancel(null)} disabled={busy} data-autofocus>انصراف</button>
          <button type="button" className="btn danger" disabled={busy || (reason === REASONS.at(-1) && !other.trim())} onClick={async () => {
            if (!cancel) return;
            const note = reason === REASONS.at(-1) ? other.trim() : reason;
            const body: Record<string, unknown> = { status: 'cancelled', statusNote: cancel.payment.paid > 0 ? `${note} · بیعانه ${deposit === 'refunded' ? 'برگشت داده شد' : 'نزد آتلیه ماند'}` : note };
            if (cancel.payment.paid > 0 && deposit === 'refunded') body.payment = { status: 'refunded' };
            if (await patch(cancel, body, `سفارش #${faId(cancel.id)} لغو شد`)) setCancel(null);
          }}>{busy ? 'در حال ثبت…' : 'لغو سفارش'}</button>
        </>}>
        {cancel && <>
          <p className="muted">سفارش لغوشده از فروش و آمار کنار می‌رود؛ بعداً می‌توانید آن را برگردانید.</p>
          <Field label="دلیل لغو">{(id, d) => <Dropdown id={id} describedBy={d} value={reason} onChange={setReason} options={REASONS.map(r => ({ value: r, label: r }))} />}</Field>
          {reason === REASONS.at(-1) && <Field label="توضیح">{(id, d) => <input id={id} className="input" aria-describedby={d} value={other} maxLength={160} onChange={e => setOther(e.target.value)} />}</Field>}
          {cancel.payment.paid > 0 && (
            <Field label={`بیعانهٔ ${faNum(cancel.payment.paid)} ${cur}`} help={deposit === 'kept' ? 'در «دریافت‌شده» داشبورد می‌ماند' : 'پرداخت سفارش «بازپرداخت شده» می‌شود'}>{() => (
              <Segmented label="بیعانه" value={deposit} onChange={setDeposit} options={[{ value: 'kept', label: 'نزد آتلیه ماند' }, { value: 'refunded', label: 'برگشت داده شد' }]} />
            )}</Field>
          )}
        </>}
      </Dialog>
    </>
  );
  return { openShip, openDeliver, openCancel, dialogs };
}
