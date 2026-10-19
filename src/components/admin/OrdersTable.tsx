'use client';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { OPEN_STATUSES, STATUS_LABEL } from '@/lib/labels';
import { customerWhatsAppLink } from '@/lib/order-message';
import { ORDER_STATUSES, type Order, type OrderStatus } from '@/lib/types';
import { api, faDate, faId, faNum } from './api';

type Filter = 'all' | 'open' | OrderStatus;

export function OrdersTable({ initial, currency, initialStatus }: { initial: Order[]; currency: string; initialStatus: string }) {
  const router = useRouter();
  const [orders, setOrders] = useState(initial);
  const [filter, setFilter] = useState<Filter>(
    initialStatus === 'open' || (ORDER_STATUSES as readonly string[]).includes(initialStatus) ? (initialStatus as Filter) : 'all');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [err, setErr] = useState('');

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/^#/, '');
    return orders.filter(o =>
      (filter === 'all' || (filter === 'open' ? OPEN_STATUSES.includes(o.status) : o.status === filter)) &&
      (!s || String(o.id) === s || o.customerName.toLowerCase().includes(s) || o.phone.includes(s.replace(/\D/g, '') || '\u0000') || o.garmentName.toLowerCase().includes(s)));
  }, [orders, filter, q]);
  const count = (f: Filter) => orders.filter(o => f === 'all' || (f === 'open' ? OPEN_STATUSES.includes(o.status) : o.status === f)).length;

  async function patch(id: number, body: Partial<Pick<Order, 'status' | 'adminNote'>>) {
    setErr('');
    try {
      const o = await api<Order>(`/api/admin/orders/${id}`, 'PATCH', body);
      setOrders(list => list.map(x => (x.id === id ? o : x)));
      router.refresh(); // updates the new-orders count in the sidebar
      return true;
    } catch (e) { setErr((e as Error).message); return false; }
  }

  const open = orders.find(o => o.id === openId) ?? null;
  const filters: Filter[] = ['all', 'open', ...ORDER_STATUSES];

  return (
    <div className="stack">
      <div className="top">
        <h1>سفارش‌ها</h1>
        <a className="btn alt" href="/api/admin/orders/export" download>دریافت فایل Excel (CSV)</a>
      </div>
      <div className="card stack" style={{ gap: 12 }}>
        <div className="row">
          {filters.map(f => (
            <button key={f} type="button" className={`btn sm${filter === f ? '' : ' alt'}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? 'همه' : f === 'open' ? 'باز' : STATUS_LABEL[f]} ({faNum(count(f))})
            </button>
          ))}
        </div>
        <input type="search" placeholder="جستجو: شماره سفارش، نام، تلفن یا لباس" value={q} onChange={e => setQ(e.target.value)} aria-label="جستجو" />
        {err && <div className="msg err" role="alert">{err}</div>}
        {shown.length === 0 ? <p className="muted">{orders.length ? 'سفارشی با این فیلتر نیست.' : 'هنوز سفارشی ثبت نشده. سفارش‌هایی که مشتری‌ها در سایت ثبت کنند این‌جا می‌آیند.'}</p> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>شماره</th><th>تاریخ</th><th>مشتری</th><th className="hide-sm">لباس</th><th className="hide-sm">مبلغ</th><th>وضعیت</th></tr></thead>
              <tbody>
                {shown.map(o => (
                  <tr key={o.id} className={`clickable${openId === o.id ? ' sel' : ''}`} onClick={() => setOpenId(o.id)}>
                    <td className="num"><button type="button" className="icon-btn" style={{ width: 'auto', padding: '0 8px' }} onClick={() => setOpenId(o.id)} aria-label={`جزئیات سفارش ${o.id}`}>#{faId(o.id)}</button></td>
                    <td className="small muted num">{faDate(o.createdAt)}</td>
                    <td>{o.customerName}<div className="small muted" dir="ltr" style={{ textAlign: 'end' }}>+{o.phone}</div></td>
                    <td className="hide-sm">{o.garmentName} · <b>{o.size}</b></td>
                    <td className="hide-sm num">{faNum(o.price)} {currency}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <select value={o.status} aria-label={`وضعیت سفارش ${o.id}`} onChange={e => patch(o.id, { status: e.target.value as OrderStatus })}>
                        {ORDER_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {open && <OrderDrawer key={open.id} o={open} currency={currency} onClose={() => setOpenId(null)} onPatch={b => patch(open.id, b)} />}
    </div>
  );
}

function OrderDrawer({ o, currency, onClose, onPatch }: { o: Order; currency: string; onClose: () => void; onPatch: (b: Partial<Order>) => Promise<boolean> }) {
  const [note, setNote] = useState(o.adminNote);
  const [saved, setSaved] = useState('');
  const greeting = `سلام ${o.customerName}، دربارهٔ سفارش شمارهٔ ${o.id} (${o.garmentName}، سایز ${o.size}) با شما تماس می‌گیریم.`;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`سفارش ${o.id}`}>
        <div className="row"><h2 style={{ margin: 0 }}>سفارش #{faId(o.id)}</h2><span className="spacer" /><button type="button" className="icon-btn" onClick={onClose} aria-label="بستن">✕</button></div>
        <span className={`st st-${o.status}`} style={{ alignSelf: 'flex-start' }}>{STATUS_LABEL[o.status]}</span>
        <dl>
          <dt>لباس</dt><dd>{o.garmentName}</dd>
          <dt>سایز</dt><dd>{o.size}</dd>
          <dt>مبلغ</dt><dd>{faNum(o.price)} {currency}</dd>
          <dt>مشتری</dt><dd>{o.customerName}</dd>
          <dt>تلفن</dt><dd dir="ltr" style={{ textAlign: 'end' }}>+{o.phone}</dd>
          <dt>شهر</dt><dd>{o.city || '—'}</dd>
          <dt>آدرس</dt><dd>{o.address || '—'}</dd>
          <dt>تاریخ مناسبت</dt><dd>{o.eventDate ? faDate(o.eventDate + 'T12:00:00Z', false) : '—'}</dd>
          <dt>توضیح مشتری</dt><dd>{o.note || '—'}</dd>
          <dt>زبان مشتری</dt><dd>{{ fa: 'فارسی', ar: 'عربی', en: 'انگلیسی' }[o.lang]}</dd>
          <dt>ثبت</dt><dd>{faDate(o.createdAt)}</dd>
          <dt>آخرین تغییر</dt><dd>{faDate(o.updatedAt)}</dd>
        </dl>
        <div className="row">
          <a className="btn" href={customerWhatsAppLink(o.phone, greeting)} target="_blank" rel="noopener noreferrer">پیام در واتس‌اپ</a>
          <a className="btn alt" href={`tel:+${o.phone}`}>تماس</a>
        </div>
        <label className="f">تغییر وضعیت
          <select value={o.status} onChange={e => onPatch({ status: e.target.value as OrderStatus })}>
            {ORDER_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="f">یادداشت مدیر (فقط شما می‌بینید)<textarea value={note} maxLength={1000} onChange={e => { setNote(e.target.value); setSaved(''); }} /></label>
        <div className="row">
          <button type="button" className="btn" disabled={note === o.adminNote} onClick={async () => { if (await onPatch({ adminNote: note })) setSaved('ذخیره شد ✓'); }}>ذخیرهٔ یادداشت</button>
          <span className="msg ok">{saved}</span>
        </div>
      </aside>
    </>
  );
}
