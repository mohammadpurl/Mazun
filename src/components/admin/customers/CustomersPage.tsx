'use client';
/* Customers: stat cards that filter, then a list with search, segments, city filter and sortable totals. */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { customerOrderSummary } from './summary';
import type { CustomerTotals } from '@/lib/customers';
import { cityGroup } from '@/lib/places';
import type { Customer } from '@/lib/types';
import { DataTable, type Column } from '../ui/DataTable';
import { Dropdown } from '../ui/Dropdown';
import { FilterBar } from '../ui/FilterBar';
import { Avatar, Empty, PageHeader, SearchInput, Segmented } from '../ui/controls';
import { daysBetween, faAgo, faNum, phoneOut, searchable } from '../ui/format';
import { AIcon } from '../ui/Icon';
import { item, Stagger } from '../ui/motion';
import { useMedia } from '../ui/useMedia';
import { CustomerDialog } from './forms';

type Segment = 'all' | 'new' | 'loyal' | 'owes' | 'vip' | 'none';
export type Row = Customer & { t: CustomerTotals };

export function CustomersPage({ initial, currency, openNew, initialSegment }: { initial: Row[]; currency: string; openNew: boolean; initialSegment: Segment }) {
  const router = useRouter();
  const wide = useMedia('(min-width: 1100px)');
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState('');
  const [segment, setSegment] = useState<Segment>(initialSegment);
  const [city, setCity] = useState('all');
  const [adding, setAdding] = useState(openNew);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const money = (n: number) => `${faNum(Math.round(n))} ${currency}`;
  const cityOf = (c: Customer) => cityGroup((c.addresses.find(a => a.isDefault) ?? c.addresses[0])?.city ?? '');

  const seg = useMemo(() => ({
    all: rows.length,
    new: rows.filter(r => daysBetween(r.createdAt) <= 30).length,
    loyal: rows.filter(r => r.t.orders >= 2).length,
    owes: rows.filter(r => r.t.owed > 0).length,
    vip: rows.filter(r => r.tags.includes('VIP')).length,
    none: rows.filter(r => r.t.orders === 0).length,
  }), [rows]);
  const cities = useMemo(() => {
    const m = new Map<string, { name: string; n: number }>();
    rows.forEach(r => { const g = cityOf(r); const x = m.get(g.key) ?? { name: g.name, n: 0 }; x.n++; m.set(g.key, x); });
    return [...m].sort((a, b) => b[1].n - a[1].n);
  }, [rows]);
  const list = useMemo(() => {
    const s = searchable(q);
    const digits = s.replace(/\D/g, '');
    return rows.filter(r => {
      if (segment === 'new' && daysBetween(r.createdAt) > 30) return false;
      if (segment === 'loyal' && r.t.orders < 2) return false;
      if (segment === 'vip' && !r.tags.includes('VIP')) return false;
      if (segment === 'none' && r.t.orders > 0) return false;
      if (segment === 'owes' && !(r.t.owed > 0)) return false;
      if (city !== 'all' && cityOf(r).key !== city) return false;
      return !s || searchable(r.name).includes(s) || (digits.length >= 3 && r.phone.includes(digits)) || searchable(r.email).includes(s)
        || r.addresses.some(a => searchable(a.city + ' ' + a.area).includes(s)) || r.tags.some(t => searchable(t).includes(s));
    });
  }, [rows, q, segment, city]);
  const buyers = rows.filter(r => r.t.orders > 0).length;
  const filtered = q || segment !== 'all' || city !== 'all';

  const cols: Column<Row>[] = [
    { key: 'name', header: 'مشتری', minWidth: 230, card: 'title', sort: r => r.name, render: r => (
      <span className="who">
        <Avatar name={r.name} seed={r.phone} />
        <span className="meta"><Link href={`/admin/customers/${r.id}`}>{r.name}</Link><span className="ltr" style={{ textAlign: 'start' }}>{phoneOut(r.phone)}</span></span>
      </span>
    ) },
    { key: 'city', header: 'شهر', minWidth: 110, width: 120, sort: r => cityOf(r).name, render: r => <span>{cityOf(r).name}</span> },
    { key: 'orders', header: 'سفارش‌ها', minWidth: 100, width: 120, sort: r => r.t.orders, render: r => <span className="row" style={{ gap: 6 }}><b className="num">{faNum(r.t.orders)}</b>{r.t.open > 0 && <span className="chip info">{faNum(r.t.open)} باز</span>}</span> },
    { key: 'spent', header: 'مجموع خرید', minWidth: 130, width: 150, align: 'end', sort: r => r.t.spent, render: r => <b className="num">{money(r.t.spent)}</b> },
    { key: 'last', header: 'آخرین سفارش', minWidth: 120, width: 140, sort: r => r.t.lastOrderAt ?? '', render: r => <span className="muted" suppressHydrationWarning>{r.t.lastOrderAt ? faAgo(r.t.lastOrderAt) : 'بدون سفارش'}</span> },
    { key: 'tags', header: 'برچسب', minWidth: 120, width: 130, optional: true, card: 'status', render: r => r.tags.length
      ? <span className="row" style={{ gap: 4 }}>{r.tags.slice(0, 2).map(t => <span key={t} className={`tag${t === 'VIP' ? ' vip' : ''}`}>{t === 'VIP' && <AIcon name="crown" />}{t}</span>)}</span>
      : r.t.orders >= 2 ? <span className="tag">وفادار</span> : null },
  ];

  const stats = [
    { k: 'همهٔ مشتریان', v: faNum(rows.length), s: `${faNum(buyers)} نفر خرید کرده‌اند`, icon: 'customers' as const, tone: 4, seg: 'all' as Segment },
    { k: 'مشتریان تازه', v: faNum(seg.new), s: 'در ۳۰ روز اخیر', icon: 'userPlus' as const, tone: 1, seg: 'new' as Segment },
    { k: 'مشتریان وفادار', v: faNum(seg.loyal), s: 'دو سفارش یا بیشتر', icon: 'repeat' as const, tone: 2, seg: 'loyal' as Segment },
    { k: 'مانده‌دار', v: faNum(seg.owes), s: `${money(rows.reduce((a, r) => a + r.t.owed, 0))} مانده روی سفارش‌ها`, icon: 'wallet' as const, tone: 3, seg: 'owes' as Segment },
  ];
  const segOptions = [
    { value: 'all' as const, label: 'همه', count: seg.all }, { value: 'new' as const, label: 'تازه', count: seg.new }, { value: 'loyal' as const, label: 'وفادار', count: seg.loyal },
    { value: 'owes' as const, label: 'مانده‌دار', count: seg.owes },
    { value: 'vip' as const, label: 'VIP', count: seg.vip }, { value: 'none' as const, label: 'بدون سفارش', count: seg.none },
  ];

  return (
    <>
      <PageHeader icon="customers" title="مشتریان" crumbs={[{ label: 'نمای کلی', href: '/admin' }, { label: 'مشتریان' }]}
        sub={`${faNum(rows.length)} مشتری، با نشانی‌ها، سفارش‌ها و یادداشت‌هایشان.`}>
        <a className="btn outline" href="/api/admin/customers/export" download><AIcon name="download" />خروجی اکسل</a>
        <button type="button" className="btn" onClick={() => setAdding(true)}><AIcon name="userPlus" />افزودن مشتری</button>
      </PageHeader>

      <Stagger className="grid-4">
        {stats.map((s, i) => (
          <motion.button key={i} type="button" variants={item} className={`stat s${s.tone}`} onClick={() => { setSegment(s.seg); setCity('all'); setQ(''); }}>
            <span className="blob" aria-hidden="true" />
            <span className="orb"><AIcon name={s.icon} duo /></span>
            <span className="k">{s.k}</span><span className="v num">{s.v}</span><span className="s">{s.s}</span>
          </motion.button>
        ))}
      </Stagger>

      <DataTable label="فهرست مشتریان" rows={list} columns={cols} rowKey={r => r.id} resetKey={q + segment + city} initialSort={{ key: 'last', dir: 'desc' }}
        selectable selected={selected} onSelect={setSelected} actionsWidth={104}
        actions={r => (
          <span className="row" style={{ gap: 6, flexWrap: 'nowrap', width: '100%', justifyContent: 'flex-end' }}>
            <a className="btn secondary sm" href={`https://wa.me/${r.phone}`} target="_blank" rel="noreferrer" aria-label={`واتس‌اپ ${r.name}`}><AIcon name="whatsapp" /><span className="only-cards">واتس‌اپ</span></a>
            <Link className="btn secondary sm" href={`/admin/customers/${r.id}`} aria-label={`پروندهٔ ${r.name}`}><span className="only-cards">پرونده</span><AIcon name="left" /></Link>
          </span>
        )}
        bulk={<a className="btn outline sm" href={`/api/admin/customers/export?ids=${[...selected].join(',')}`} download><AIcon name="download" />خروجی انتخاب‌شده‌ها</a>}
        toolbar={<>
          {wide && <Segmented label="گروه مشتری" value={segment} onChange={setSegment} options={segOptions} />}
          <FilterBar active={(segment !== 'all' ? 1 : 0) + (city !== 'all' ? 1 : 0)} results={list.length} onClear={() => { setQ(''); setSegment('all'); setCity('all'); }}
            search={<SearchInput value={q} onChange={setQ} placeholder="نام، تلفن، ایمیل یا شهر…" label="جستجوی مشتری با نام، تلفن، ایمیل، شهر یا برچسب" />}
            filters={<>
              {!wide && <div style={{ flex: '0 1 200px', minWidth: 160 }}><Dropdown variant="pill" label="گروه" prefix="گروه" value={segment} onChange={v => setSegment(v as Segment)} options={segOptions.map(o => ({ value: o.value, label: o.label, hint: faNum(o.count) }))} /></div>}
              <div style={{ flex: '0 1 200px', minWidth: 160 }}>
                <Dropdown variant="pill" label="شهر" prefix="شهر" searchable value={city} onChange={setCity} options={[{ value: 'all', label: 'همهٔ شهرها' }, ...cities.map(([k, c]) => ({ value: k, label: c.name, hint: faNum(c.n) }))]} />
              </div>
            </>} />
        </>}
        empty={filtered
          ? <Empty icon="search" title="مشتری‌ای با این فیلترها پیدا نشد" body={q ? `برای «${q}» نتیجه‌ای نیست.` : undefined} action={<button type="button" className="btn outline sm" onClick={() => { setQ(''); setSegment('all'); setCity('all'); }}>پاک کردن فیلترها</button>} />
          : <Empty icon="customers" title="هنوز مشتری‌ای ثبت نشده" body="با اولین سفارش، مشتری خودکار اضافه می‌شود؛ یا دستی اضافه کنید." action={<button type="button" className="btn sm" onClick={() => setAdding(true)}><AIcon name="userPlus" />افزودن مشتری</button>} />} />

      <CustomerDialog open={adding} customer={null} onClose={() => setAdding(false)} onSaved={c => {
        setRows(r => [{ ...c, t: customerOrderSummary() }, ...r]);
        setAdding(false);
        router.push(`/admin/customers/${c.id}`);
      }} />
    </>
  );
}
