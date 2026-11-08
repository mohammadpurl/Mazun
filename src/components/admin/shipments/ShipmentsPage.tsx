'use client';
/* Shipments: what is ready to leave the atelier, what is on the way, and what has arrived. "Ship" asks for the
   carrier, tracking code, charge and date in one dialog; "Delivered" closes the trip. The customer can be sent her
   tracking code on WhatsApp. */
import Link from 'next/link';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { CARRIER_LABEL } from '@/lib/labels';
import { customerMessage, customerWhatsAppLink } from '@/lib/order-message';
import { owedOn } from '@/lib/orders';
import { cityGroup } from '@/lib/places';
import { dayKey } from '@/lib/stats';
import { CARRIERS, type Carrier, type L10n, type Order } from '@/lib/types';
import { DataTable, type Column } from '../ui/DataTable';
import { Dropdown } from '../ui/Dropdown';
import { Empty, PageHeader, SearchInput, Segmented, StatusChip } from '../ui/controls';
import { daysBetween, faAgo, faDate, faId, faNum, searchable, todayMuscat } from '../ui/format';
import { AIcon } from '../ui/Icon';
import { item, Stagger } from '../ui/motion';
import { CustomerCell, ItemThumbs, type Pics } from '../orders/bits';
import { useOrderFlows } from '../orders/flows';

type Tab = 'ready' | 'transit' | 'delivered';

export function ShipmentsPage({ initial, pics, cur, initialTab }: { initial: Order[]; pics: Pics; cur: L10n; initialTab: Tab }) {
  const [orders, setOrders] = useState(initial);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [q, setQ] = useState('');
  const [carrier, setCarrier] = useState<'all' | Carrier>('all');
  const ready = orders.filter(o => o.status === 'confirmed' || o.status === 'preparing');
  const transit = orders.filter(o => o.status === 'shipped');
  const delivered = orders.filter(o => o.status === 'delivered');
  // Pickup orders wait at the atelier; only parcels on the road can be late.
  const late = transit.filter(o => o.shipping.carrier !== 'pickup' && o.shipping.shippedAt && Date.now() - Date.parse(o.shipping.shippedAt) > 5 * 86_400_000);
  // The last 30 calendar days in Muscat, today included: the same window as the dashboard, so both show one number.
  const since = new Date(Date.parse(todayMuscat() + 'T00:00:00Z') - 29 * 86_400_000).toISOString().slice(0, 10);
  const recent = delivered.filter(o => o.shipping.deliveredAt && dayKey(new Date(o.shipping.deliveredAt)) >= since);
  // Exact days, averaged then rounded once (as on the dashboard).
  const avg = recent.length ? recent.reduce((a, o) => a + (Date.parse(o.shipping.deliveredAt!) - Date.parse(o.createdAt)) / 86_400_000, 0) / recent.length : null;
  const list = tab === 'ready' ? ready : tab === 'transit' ? transit : delivered;
  const rows = useMemo(() => {
    const s = searchable(q);
    return list.filter(o => (carrier === 'all' || o.shipping.carrier === carrier)
      && (!s || String(o.id).includes(s) || searchable(o.customerName).includes(s) || searchable(o.city).includes(s) || o.shipping.tracking.toLowerCase().includes(s)));
  }, [list, q, carrier]);

  const replace = (o: Order) => setOrders(list => list.map(x => (x.id === o.id ? o : x)));
  const flows = useOrderFlows({ currency: cur, onSaved: replace });
  const trackMsg = (o: Order) => customerWhatsAppLink(o.phone, customerMessage(o, 'shipped', { owed: owedOn(o), currency: cur }));

  const cols: Column<Order>[] = [
    { key: 'id', header: 'سفارش', minWidth: 110, width: 112, card: 'title', sort: o => o.id, render: o => (
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.4 }}>
        <Link href={`/admin/orders/${o.id}`} className="strong num" style={{ color: 'var(--accent-fg)' }}>#{faId(o.id)}</Link>
        <span className="xs muted" suppressHydrationWarning>{faAgo(o.createdAt)}</span>
      </span>
    ) },
    { key: 'customer', header: 'مشتری', minWidth: 180, sort: o => o.customerName, render: o => <CustomerCell o={o} /> },
    { key: 'where', header: 'مقصد', minWidth: 150, sort: o => cityGroup(o.city).name, render: o => (
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.45, minWidth: 0 }}>
        <b>{cityGroup(o.city).name}</b><span className="xs muted ellipsis" title={o.address}>{o.address || '—'}</span>
      </span>
    ) },
    { key: 'items', header: 'اقلام', minWidth: 140, width: 140, optional: true, render: o => <ItemThumbs items={o.items} pics={pics} max={2} /> },
    { key: 'carrier', header: 'ارسال با', minWidth: 140, width: 150, sort: o => o.shipping.carrier, render: o => o.shipping.carrier ? (
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.45 }}>
        <span>{CARRIER_LABEL[o.shipping.carrier]}</span>{o.shipping.tracking && <span className="xs muted ltr" style={{ textAlign: 'start' }}>{o.shipping.tracking}</span>}
      </span>
    ) : <span className="muted">—</span> },
    { key: 'when', header: tab === 'ready' ? 'مدت انتظار' : tab === 'transit' ? 'در راه' : 'تحویل', minWidth: 140, width: 150,
      sort: o => (tab === 'ready' ? o.createdAt : tab === 'transit' ? o.shipping.shippedAt ?? '' : o.shipping.deliveredAt ?? ''), render: o => {
        if (tab === 'transit' && o.shipping.shippedAt) {
          const d = daysBetween(o.shipping.shippedAt);
          if (o.shipping.carrier === 'pickup') return <span className="chip neutral" suppressHydrationWarning><AIcon name="store" />آمادهٔ تحویل{d >= 1 ? ` (${faNum(d)} روز)` : ''}</span>;
          // Red by the same rule as the "more than 5 days" count above; the number is whole days gone, so "۵ روز" and
          // more is red, "۳ روز" and more amber.
          const hours = (Date.now() - Date.parse(o.shipping.shippedAt)) / 3_600_000;
          const full = Math.floor(hours / 24);
          return <span className={`chip ${hours > 120 ? 'danger' : hours > 72 ? 'warn' : 'info'}`} suppressHydrationWarning><AIcon name="clock" />{full < 1 ? 'امروز' : `${faNum(full)} روز`}</span>;
        }
        if (tab === 'delivered' && o.shipping.deliveredAt) return <span className="xs">{faDate(o.shipping.deliveredAt)}</span>;
        const d = daysBetween(o.createdAt);
        const ev = o.eventDate ? Math.round((Date.parse(o.eventDate + 'T00:00:00Z') - Date.parse(todayMuscat() + 'T00:00:00Z')) / 86_400_000) : null;
        return (
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <span className={`chip ${d > 3 ? 'warn' : 'neutral'}`} suppressHydrationWarning><AIcon name="hourglass" />{d < 1 ? 'امروز' : `${faNum(d)} روز`}</span>
            {ev !== null && ev >= 0 && <span className={`chip ${ev <= 7 ? 'danger' : 'gold'}`} suppressHydrationWarning><AIcon name="calendar" />مراسم {ev === 0 ? 'امروز' : `${faNum(ev)} روز دیگر`}</span>}
          </span>
        );
      } },
    { key: 'cod', header: 'دریافت در محل', minWidth: 120, width: 130, sort: o => owedOn(o), render: o => owedOn(o) > 0
      ? <span className="chip warn"><AIcon name="wallet" />{faNum(owedOn(o))} {cur.fa || 'ریال'}</span> : <span className="muted xs">—</span> },
    // The tab already says the status; the column can be shown from "ستون‌ها" (cards always show it).
    { key: 'status', header: 'وضعیت', minWidth: 140, width: 150, card: 'status', optional: true, render: o => <StatusChip status={o.status} /> },
  ];

  const stats = [
    { k: 'در انتظار ارسال', v: faNum(ready.length), s: 'تأییدشده یا در کارگاه', icon: 'package' as const, tone: 3, t: 'ready' as Tab },
    { k: 'در راه', v: faNum(transit.length), s: late.length ? `${faNum(late.length)} مورد بیش از ۵ روز` : 'همه در زمان معمول', icon: 'shipments' as const, tone: 4, t: 'transit' as Tab },
    { k: 'تحویل‌شده در ۳۰ روز', v: faNum(recent.length), s: `از ${faNum(delivered.length)} تحویل در کل`, icon: 'sealCheck' as const, tone: 2, t: 'delivered' as Tab },
    { k: 'میانگین سفارش تا تحویل', v: avg === null ? '—' : `${faNum(Math.round(avg * 10) / 10)} روز`, s: '۳۰ روز اخیر', icon: 'timer' as const, tone: 1, t: 'delivered' as Tab },
  ];

  return (
    <>
      <PageHeader icon="shipments" title="ارسال‌ها" crumbs={[{ label: 'نمای کلی', href: '/admin' }, { label: 'ارسال‌ها' }]}
        sub="از آتلیه تا در خانهٔ مشتری: آماده‌سازی، ارسال، رهگیری و تحویل." >
        <Link className="btn outline" href="/admin/orders"><AIcon name="orders" />همهٔ سفارش‌ها</Link>
      </PageHeader>

      <Stagger className="grid-4">
        {stats.map(s => (
          <motion.button key={s.k} type="button" variants={item} className={`stat s${s.tone}`} onClick={() => setTab(s.t)} aria-pressed={tab === s.t && s.k !== 'میانگین سفارش تا تحویل'}>
            <span className="blob" aria-hidden="true" />
            <span className="orb"><AIcon name={s.icon} duo /></span>
            <span className="k">{s.k}</span><span className="v num">{s.v}</span><span className="s">{s.s}</span>
          </motion.button>
        ))}
      </Stagger>

      <DataTable label="ارسال‌ها" rows={rows} columns={cols} rowKey={o => String(o.id)} resetKey={tab + q + carrier} actionsWidth={tab === 'delivered' ? 64 : tab === 'transit' ? 176 : 136}
        initialSort={{ key: 'id', dir: tab === 'ready' ? 'asc' : 'desc' }}
        actions={o => tab === 'ready'
          ? <button type="button" className="btn sm" onClick={() => flows.openShip(o)}><AIcon name="send" />ثبت ارسال</button>
          : tab === 'transit'
            ? <span className="row" style={{ gap: 6, flexWrap: 'nowrap', width: '100%' }}>
                <a className="btn secondary sm" href={trackMsg(o)} target="_blank" rel="noreferrer" aria-label="ارسال کد رهگیری در واتس‌اپ" title="ارسال کد رهگیری در واتس‌اپ"><AIcon name="whatsapp" /><span className="only-cards">کد رهگیری</span></a>
                <button type="button" className="btn sm" onClick={() => flows.openDeliver(o)}><AIcon name="done" />تحویل شد</button>
              </span>
            : <Link className="btn secondary sm" href={`/admin/orders/${o.id}`} aria-label={`جزئیات سفارش ${faId(o.id)}`}><span className="only-cards">جزئیات</span><AIcon name="left" /></Link>}
        toolbar={<>
          <Segmented label="مرحله" value={tab} onChange={setTab} options={[
            { value: 'ready', label: 'در انتظار ارسال', count: ready.length }, { value: 'transit', label: 'در راه', count: transit.length }, { value: 'delivered', label: 'تحویل‌شده', count: delivered.length },
          ]} />
          <SearchInput value={q} onChange={setQ} placeholder="شماره، نام، شهر یا کد رهگیری…" />
          <div style={{ minWidth: 170, flex: '1 1 170px' }}>
            <Dropdown variant="pill" label="شرکت ارسال" prefix="ارسال با" value={carrier} onChange={v => setCarrier(v as 'all' | Carrier)}
              options={[{ value: 'all', label: 'همه' }, ...CARRIERS.map(c => ({ value: c, label: CARRIER_LABEL[c] }))]} />
          </div>
        </>}
        empty={q || carrier !== 'all'
          ? <Empty icon="search" title="موردی با این فیلتر پیدا نشد" action={<button type="button" className="btn outline sm" onClick={() => { setQ(''); setCarrier('all'); }}>پاک کردن فیلترها</button>} />
          : <Empty icon={tab === 'ready' ? 'package' : tab === 'transit' ? 'shipments' : 'sealCheck'} title={tab === 'ready' ? 'سفارشی منتظر ارسال نیست' : tab === 'transit' ? 'مرسوله‌ای در راه نیست' : 'هنوز تحویلی ثبت نشده'}
            body={tab === 'ready' ? 'سفارش‌ها بعد از تأیید اینجا می‌آیند.' : undefined} />} />

      {flows.dialogs}
    </>
  );
}
