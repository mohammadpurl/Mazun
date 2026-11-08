'use client';
/* Orders: four stat cards that double as quick filters, then one list with search, status, payment, date and city
   filters, sortable columns, row selection with bulk status change and CSV export. */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';
import { STATUS_LABEL } from '@/lib/labels';
import { amountDue, daysNeeded, eventAtRisk, owedOn } from '@/lib/orders';
import { cityGroup } from '@/lib/places';
import { ORDER_STATUSES, type Order, type OrderStatus } from '@/lib/types';
import { DatePicker } from '../ui/DatePicker';
import { DataTable, type Column } from '../ui/DataTable';
import { useUi } from '../ui/Dialog';
import { Dropdown } from '../ui/Dropdown';
import { FilterBar } from '../ui/FilterBar';
import { Empty, PageHeader, PayChip, SearchInput, Segmented, StatusChip } from '../ui/controls';
import { faAgo, faDate, faId, faNum, searchable, todayMuscat, TZ } from '../ui/format';
import { AIcon } from '../ui/Icon';
import { item, Stagger } from '../ui/motion';
import { useMedia } from '../ui/useMedia';
import { motion } from 'motion/react';
import { api } from '../api';
import { CustomerCell, ItemThumbs, type Pics } from './bits';

/** 'active' = confirmed or being prepared (the "in progress" card). */
export type StatusFilter = 'all' | 'active' | OrderStatus;
/** 'due' = anything owed on an accepted order; 'overdue' = owed on an order already shipped or delivered. */
export type PayFilter = 'all' | 'unpaid' | 'partial' | 'paid' | 'due' | 'overdue';
type Range = 'all' | 'today' | '7' | '30' | 'month' | 'custom';
const DAY = 86_400_000;
const dayOf = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso));
/** First day (yyyy-mm-dd) of the current Persian month in Muscat: the panel's months are Persian months. */
function persianMonthStart() {
  const day = +new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { timeZone: TZ, day: 'numeric' }).format(new Date());
  return dayOf(new Date(Date.now() - (day - 1) * DAY).toISOString());
}

export function OrdersPage({ initial, pics, currency, initialStatus, initialPay, initialQ, initialRisk, days, leadDays }: {
  initial: Order[]; pics: Pics; currency: string; initialStatus: StatusFilter; initialPay: PayFilter; initialQ: string; initialRisk: boolean;
  /** The shop's preparation, shipping and margin days, and each product's extra preparation days (for "event soon"). */
  days: { prepDays: number; shipDays: number; bufferDays: number }; leadDays: Record<string, number>;
}) {
  const atRisk = (o: Order) => eventAtRisk(o, daysNeeded(o, days, leadDays), todayMuscat());
  const riskDays = days.prepDays + days.shipDays + days.bufferDays;
  const router = useRouter();
  const { toast, confirm } = useUi();
  const wide = useMedia('(min-width: 1100px)');
  const [orders, setOrders] = useState(initial);
  // A refresh (after a bulk change or elsewhere) brings the server's list.
  useEffect(() => setOrders(initial), [initial]);
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [pay, setPay] = useState<PayFilter>(initialPay);
  const [range, setRange] = useState<Range>('all');
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [city, setCity] = useState('all');
  const [risk, setRisk] = useState(initialRisk);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<OrderStatus | ''>('');
  const [busy, setBusy] = useState(false);
  const money = (n: number) => `${faNum(n)} ${currency}`;

  const counts = useMemo(() => {
    const c = Object.fromEntries(ORDER_STATUSES.map(s => [s, 0])) as Record<OrderStatus, number>;
    orders.forEach(o => c[o.status]++);
    return c;
  }, [orders]);
  const cities = useMemo(() => {
    const m = new Map<string, { name: string; n: number }>();
    orders.forEach(o => { const g = cityGroup(o.city); const r = m.get(g.key) ?? { name: g.name, n: 0 }; r.n++; m.set(g.key, r); });
    return [...m].sort((a, b) => b[1].n - a[1].n);
  }, [orders]);
  const owed = orders.filter(o => owedOn(o) > 0);
  const risky = orders.filter(atRisk).length;

  const rows = useMemo(() => {
    const s = searchable(q);
    const today = dayOf(new Date().toISOString());
    const lo = range === 'today' ? today : range === '7' ? dayOf(new Date(Date.now() - 6 * DAY).toISOString()) : range === '30' ? dayOf(new Date(Date.now() - 29 * DAY).toISOString())
      : range === 'month' ? persianMonthStart() : range === 'custom' ? from : null;
    const hi = range === 'custom' ? to : null;
    return orders.filter(o => {
      if (status === 'active' ? !(o.status === 'confirmed' || o.status === 'preparing') : status !== 'all' && o.status !== status) return false;
      if (pay === 'due' ? !(owedOn(o) > 0) : pay === 'overdue' ? !(owedOn(o) > 0 && (o.status === 'shipped' || o.status === 'delivered')) : pay !== 'all' && o.payment.status !== pay) return false;
      if (risk && !atRisk(o)) return false;
      if (city !== 'all' && cityGroup(o.city).key !== city) return false;
      const d = dayOf(o.createdAt);
      if (lo && d < lo) return false;
      if (hi && d > hi) return false;
      if (!s) return true;
      const digits = s.replace(/\D/g, '');
      return String(o.id).includes(s) || searchable(o.customerName).includes(s) || (digits.length >= 3 && o.phone.includes(digits))
        || searchable(o.city).includes(s) || o.items.some(i => searchable(i.name).includes(s));
    });
  }, [orders, q, status, pay, city, range, from, to, risk]); // eslint-disable-line react-hooks/exhaustive-deps
  const activeFilters = [status !== 'all', pay !== 'all', city !== 'all', range !== 'all', risk].filter(Boolean).length;
  const filtered = !!q || activeFilters > 0;
  const clear = () => { setQ(''); setStatus('all'); setPay('all'); setCity('all'); setRange('all'); setFrom(null); setTo(null); setRisk(false); };

  async function applyBulk() {
    if (!bulkStatus) return;
    const ids = [...selected].map(Number);
    const earlier: OrderStatus[] = bulkStatus === 'confirmed' ? ['new'] : ['new', 'confirmed'];
    const moving = orders.filter(o => selected.has(String(o.id)) && earlier.includes(o.status)).length;
    if (!moving) { toast('info', 'سفارشی برای این تغییر نیست', `فقط سفارش‌هایی که هنوز به «${STATUS_LABEL[bulkStatus]}» نرسیده‌اند جلو می‌روند.`); return; }
    const ok = await confirm({ title: 'تغییر وضعیت گروهی', confirm: 'تغییر وضعیت',
      body: `${faNum(moving)} سفارش به «${STATUS_LABEL[bulkStatus]}» می‌رود و در تاریخچهٔ هر کدام ثبت می‌شود.${ids.length > moving ? ` ${faNum(ids.length - moving)} سفارش دیگر که جلوتر یا لغوشده‌اند، دست نمی‌خورند.` : ''}` });
    if (!ok) return;
    setBusy(true);
    try {
      const { updated, skipped, failed } = await api<{ updated: Order[]; skipped: number[]; failed: number[] }>('/api/admin/orders/bulk', 'POST', { ids, status: bulkStatus });
      const byId = new Map(updated.map(o => [o.id, o]));
      setOrders(list => list.map(o => byId.get(o.id) ?? o));
      setSelected(new Set(failed.map(String))); setBulkStatus('');
      // Orders someone else moved on in the meantime are skipped on the server too.
      const late = skipped.length - (ids.length - moving);
      const detail = [failed.length ? `${faNum(failed.length)} سفارش ذخیره نشد و انتخاب‌شده ماند` : '', late > 0 ? `${faNum(late)} سفارش در این فاصله جلو رفته بود و دست نخورد` : ''].filter(Boolean).join(' · ');
      toast(failed.length ? 'err' : 'ok', `${faNum(updated.length)} سفارش به‌روز شد`, detail || STATUS_LABEL[bulkStatus]);
      router.refresh();
    } catch (e) { toast('err', 'وضعیت‌ها ذخیره نشد', (e as Error).message); }
    finally { setBusy(false); }
  }

  const cols: Column<Order>[] = [
    { key: 'id', header: 'سفارش', minWidth: 110, width: 112, card: 'title', sort: o => o.id, render: o => (
      <span className="meta" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.4 }}>
        <Link href={`/admin/orders/${o.id}`} className="strong num" style={{ color: 'var(--accent-fg)' }}>#{faId(o.id)}</Link>
        <span className="xs muted" title={faDate(o.createdAt)} suppressHydrationWarning>{faAgo(o.createdAt)}</span>
      </span>
    ) },
    { key: 'customer', header: 'مشتری', minWidth: 200, sort: o => o.customerName, render: o => <CustomerCell o={o} /> },
    { key: 'items', header: 'اقلام', minWidth: 150, width: 176, optional: true, render: o => <ItemThumbs items={o.items} pics={pics} max={2} /> },
    { key: 'city', header: 'شهر', minWidth: 104, width: 104, optional: true, sort: o => cityGroup(o.city).name, render: o => <span className="ellipsis">{cityGroup(o.city).name}</span> },
    { key: 'total', header: 'مبلغ', minWidth: 120, width: 140, align: 'end', sort: o => amountDue(o), render: o => (
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.4 }}>
        <b className="num">{money(amountDue(o))}</b>
        {owedOn(o) > 0 && o.payment.status !== 'unpaid' && <span className="xs muted num">مانده {faNum(owedOn(o))}</span>}
      </span>
    ) },
    { key: 'event', header: 'مراسم', minWidth: 120, width: 130, optional: true, sort: o => o.eventDate ?? '9999', render: o => {
      if (!o.eventDate) return <span className="muted xs">—</span>;
      const left = Math.round((Date.parse(o.eventDate + 'T00:00:00Z') - Date.parse(todayMuscat() + 'T00:00:00Z')) / DAY);
      if (left < 0 || o.status === 'delivered' || o.status === 'cancelled') return <span className="xs muted">{faDate(o.eventDate + 'T08:00:00Z')}</span>;
      return <span className={`chip ${atRisk(o) ? 'danger' : 'gold'}`} title={faDate(o.eventDate + 'T08:00:00Z')} suppressHydrationWarning><AIcon name="calendar" />{left === 0 ? 'امروز' : `${faNum(left)} روز دیگر`}</span>;
    } },
    { key: 'pay', header: 'پرداخت', minWidth: 124, width: 136, sort: o => o.payment.status, render: o => <PayChip status={o.payment.status} /> },
    { key: 'status', header: 'وضعیت', minWidth: 140, width: 170, card: 'status', sort: o => ORDER_STATUSES.indexOf(o.status), render: o => <StatusChip status={o.status} /> },
  ];

  const statusOptions: { value: StatusFilter; label: string; count: number }[] = [
    { value: 'all', label: 'همه', count: orders.length },
    ...(status === 'active' ? [{ value: 'active' as const, label: 'در دست کار', count: counts.confirmed + counts.preparing }] : []),
    ...ORDER_STATUSES.map(s => ({ value: s, label: STATUS_LABEL[s], count: counts[s] })),
  ];
  const flex = { flex: '0 1 200px', minWidth: 160 };
  const stats: { k: string; v: number; s: string; icon: 'sparkle' | 'hourglass' | 'shipments' | 'wallet'; tone: 1 | 2 | 3 | 4; on: () => void; money?: boolean }[] = [
    { k: 'سفارش‌های جدید', v: counts.new, s: 'منتظر بررسی و تأیید', icon: 'sparkle', tone: 1, on: () => { clear(); setStatus('new'); } },
    { k: 'در دست آماده‌سازی', v: counts.confirmed + counts.preparing, s: `${faNum(counts.confirmed)} تأییدشده · ${faNum(counts.preparing)} در کارگاه`, icon: 'hourglass', tone: 3, on: () => { clear(); setStatus('active'); } },
    { k: 'در راه', v: counts.shipped, s: 'ارسال‌شده، هنوز تحویل نشده', icon: 'shipments', tone: 4, on: () => { clear(); setStatus('shipped'); } },
    { k: 'مانده دریافت', v: owed.reduce((a, o) => a + owedOn(o), 0), s: `${currency} · ${faNum(owed.length)} سفارش تسویه‌نشده`, icon: 'wallet', tone: 2, on: () => { clear(); setPay('due'); }, money: true },
  ];

  return (
    <>
      <PageHeader icon="orders" title="سفارش‌ها" crumbs={[{ label: 'نمای کلی', href: '/admin' }, { label: 'سفارش‌ها' }]}
        sub={`${faNum(orders.length)} سفارش ثبت شده · ${faNum(counts.new)} سفارش جدید`}>
        <a className="btn outline" href={`/api/admin/orders/export${filtered ? `?ids=${rows.map(o => o.id).join(',')}` : ''}`} download title={filtered ? `${faNum(rows.length)} سفارشِ فیلترشده` : 'همهٔ سفارش‌ها'}><AIcon name="download" />خروجی اکسل{filtered ? ` (${faNum(rows.length)})` : ''}</a>
        <Link className="btn outline" href="/admin/shipments"><AIcon name="shipments" />ارسال‌ها</Link>
        <Link className="btn" href="/admin/orders/new"><AIcon name="plus" />سفارش جدید</Link>
      </PageHeader>

      <Stagger className="grid-4">
        {stats.map(st => (
          <motion.button key={st.k} type="button" variants={item} className={`stat s${st.tone}`} onClick={st.on}>
            <span className="blob" aria-hidden="true" />
            <span className="orb"><AIcon name={st.icon} duo /></span>
            <span className="k">{st.k}</span>
            <span className="v num">{st.money ? faNum(Math.round(st.v)) : faNum(st.v)}</span>
            <span className="s">{st.s}</span>
          </motion.button>
        ))}
      </Stagger>

      <DataTable key={risk ? 'risk' : 'all'} label="فهرست سفارش‌ها" rows={rows} columns={cols} rowKey={o => String(o.id)} initialSort={risk ? { key: 'event', dir: 'asc' } : { key: 'id', dir: 'desc' }}
        resetKey={[q, status, pay, city, range, from, to, risk].join('|')} selectable selected={selected} onSelect={setSelected}
        actions={o => (
          <span className="row" style={{ gap: 4, justifyContent: 'flex-end', width: '100%', flexWrap: 'nowrap' }}>
            <Link href={`/admin/orders/${o.id}`} className="btn secondary sm grow-sm" aria-label={`جزئیات سفارش ${faId(o.id)}`}><span className="only-cards">جزئیات</span><AIcon name="left" /></Link>
          </span>
        )}
        toolbar={<>
          {wide && <Segmented label="وضعیت سفارش" value={status} onChange={setStatus} options={statusOptions} />}
          <FilterBar active={activeFilters} onClear={clear} results={rows.length}
            search={<SearchInput value={q} onChange={setQ} placeholder="جستجوی سفارش…" label="جستجوی سفارش با شماره، نام مشتری، تلفن، شهر یا محصول" />}
            filters={<>
              {!wide && <div style={flex}><Dropdown variant="pill" label="وضعیت" prefix="وضعیت" value={status} onChange={v => setStatus(v as StatusFilter)} options={statusOptions.map(o => ({ value: o.value, label: o.label, hint: faNum(o.count) }))} /></div>}
              <div style={flex}>
                <Dropdown variant="pill" label="پرداخت" prefix="پرداخت" value={pay} onChange={v => setPay(v as PayFilter)} options={[
                  { value: 'all', label: 'همه' }, { value: 'unpaid', label: 'پرداخت نشده' }, { value: 'partial', label: 'بیعانه' }, { value: 'paid', label: 'پرداخت شده' },
                  { value: 'due', label: 'مانده‌دار' }, { value: 'overdue', label: 'ارسال‌شده و تسویه‌نشده' },
                ]} />
              </div>
              <div style={flex}>
                <Dropdown variant="pill" label="بازهٔ زمانی" prefix="تاریخ" value={range} onChange={v => setRange(v as Range)} options={[
                  { value: 'all', label: 'همهٔ زمان‌ها' }, { value: 'today', label: 'امروز' }, { value: '7', label: '۷ روز اخیر' }, { value: '30', label: '۳۰ روز اخیر' },
                  { value: 'month', label: 'این ماه' }, { value: 'custom', label: 'بازهٔ دلخواه…' },
                ]} />
              </div>
              <div style={flex}>
                <Dropdown variant="pill" label="شهر" prefix="شهر" searchable value={city} onChange={setCity}
                  options={[{ value: 'all', label: 'همهٔ شهرها' }, ...cities.map(([k, c]) => ({ value: k, label: c.name, hint: faNum(c.n) }))]} />
              </div>
              <button type="button" className={`btn ${risk ? 'secondary' : 'outline'} sm`} aria-pressed={risk} onClick={() => setRisk(r => !r)} title={`مراسمشان زودتر از زمان لازم برای دوخت و ارسال است (دست‌کم ${faNum(riskDays)} روز) و هنوز ارسال نشده‌اند`}>
                <AIcon name="calendar" duo />مراسم نزدیک{risky > 0 && <span className="chip danger" style={{ height: 20, padding: '0 6px' }}>{faNum(risky)}</span>}
              </button>
              {range === 'custom' && (
                <div className="row" style={{ flex: '1 1 100%', gap: 8 }}>
                  <div style={{ flex: '1 1 200px' }}><DatePicker label="از تاریخ" placeholder="از تاریخ" value={from} onChange={setFrom} max={to ?? undefined} /></div>
                  <div style={{ flex: '1 1 200px' }}><DatePicker label="تا تاریخ" placeholder="تا تاریخ" value={to} onChange={setTo} min={from ?? undefined} /></div>
                </div>
              )}
            </>} />
        </>}
        bulk={<>
          <div style={{ width: 190 }}>
            {/* Shipping, delivery and cancelling ask for details per order, so only these two are offered for many at once. */}
            <Dropdown label="وضعیت جدید" placeholder="تغییر وضعیت به…" value={bulkStatus} onChange={v => setBulkStatus(v)} options={(['confirmed', 'preparing'] as OrderStatus[]).map(s => ({ value: s, label: STATUS_LABEL[s] }))} />
          </div>
          <button type="button" className="btn sm" disabled={!bulkStatus || busy} onClick={applyBulk}>{busy ? 'در حال ذخیره…' : 'اعمال'}</button>
          <a className="btn outline sm" href={`/api/admin/orders/export?ids=${[...selected].join(',')}`} download><AIcon name="download" />خروجی</a>
        </>}
        empty={filtered
          ? <Empty icon="search" title="سفارشی با این فیلترها پیدا نشد" body={q ? `برای «${q}» نتیجه‌ای نیست.` : 'فیلترها را تغییر دهید.'} action={<button type="button" className="btn outline sm" onClick={clear}>پاک کردن فیلترها</button>} />
          : <Empty icon="orders" title="هنوز سفارشی ثبت نشده" body="سفارش‌های فروشگاه خودکار اینجا می‌آیند؛ سفارش واتس‌اپ یا تلفنی را خودتان ثبت کنید." action={<Link className="btn sm" href="/admin/orders/new"><AIcon name="plus" />سفارش جدید</Link>} />} />
    </>
  );
}
