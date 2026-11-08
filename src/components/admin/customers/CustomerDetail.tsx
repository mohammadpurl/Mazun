'use client';
/* A customer's file: who she is, what she has bought, where we deliver to, and the team's notes about her. */
import { MAX_ADDRESSES } from '@/lib/customers';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { amountDue, isSale, owedOn } from '@/lib/orders';
import { cityGroup } from '@/lib/places';
import type { Address, Customer, Order } from '@/lib/types';
import { DataTable, type Column } from '../ui/DataTable';
import { useUi } from '../ui/Dialog';
import { Menu } from '../ui/Dropdown';
import { Avatar, Empty, PayChip, SearchInput, StatusChip } from '../ui/controls';
import { faAgo, faDate, faDateTime, faId, faNum, latinDigits, phoneOut, searchable } from '../ui/format';
import { AIcon } from '../ui/Icon';
import { item, Reveal, Stagger } from '../ui/motion';
import { api } from '../api';
import { ItemThumbs, type Pics } from '../orders/bits';
import { AddressDialog, CustomerDialog } from './forms';

export function CustomerDetail({ initial, orders, pics, currency }: { initial: Customer; orders: Order[]; pics: Pics; currency: string }) {
  const router = useRouter();
  const { toast, confirm } = useUi();
  const [c, setC] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [addr, setAddr] = useState<{ open: boolean; a: Address | null }>({ open: false, a: null });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const money = (n: number) => `${faNum(Math.round(n * 1000) / 1000)} ${currency}`;
  const live = orders.filter(isSale);
  const owed = orders.reduce((a, o) => a + owedOn(o), 0);
  const [oq, setOq] = useState('');
  const shownOrders = oq ? orders.filter(o => String(o.id).includes(latinDigits(oq)) || o.items.some(i => searchable(i.name).includes(searchable(oq))) || searchable(o.city).includes(searchable(oq))) : orders;
  const spent = live.reduce((a, o) => a + o.total, 0);
  const last = orders[0];
  const home = c.addresses.find(a => a.isDefault) ?? c.addresses[0];

  async function save(next: Customer, done: string) {
    setBusy(true);
    try { const s = await api<Customer>(`/api/admin/customers/${c.id}`, 'PUT', next); setC(s); toast('ok', done); router.refresh(); return true; }
    catch (e) { toast('err', 'ذخیره نشد', (e as Error).message); return false; }
    finally { setBusy(false); }
  }
  const addNote = async () => {
    const text = note.trim();
    if (!text) return;
    if (await save({ ...c, notes: [{ id: 'n' + Date.now().toString(36), at: new Date().toISOString(), text }, ...c.notes] }, 'یادداشت اضافه شد')) setNote('');
  };
  const removeAddress = async (a: Address) => {
    if (!(await confirm({ title: 'حذف نشانی', body: `«${a.label}» از نشانی‌های ${c.name} حذف شود؟ سفارش‌های قبلی تغییری نمی‌کنند.`, confirm: 'حذف نشانی', danger: true }))) return;
    await save({ ...c, addresses: c.addresses.filter(x => x.id !== a.id) }, 'نشانی حذف شد');
  };
  const remove = async () => {
    if (!(await confirm({ title: `حذف ${c.name}`, body: 'پروندهٔ مشتری حذف می‌شود؛ سفارش‌هایش با نام و نشانی خودشان باقی می‌مانند. این کار برگشت‌پذیر نیست.', confirm: 'حذف مشتری', danger: true }))) return;
    try { await api(`/api/admin/customers/${c.id}`, 'DELETE'); toast('ok', 'مشتری حذف شد'); router.push('/admin/customers'); router.refresh(); }
    catch (e) { toast('err', 'حذف نشد', (e as Error).message); }
  };

  const cols: Column<Order>[] = [
    { key: 'id', header: 'سفارش', minWidth: 120, width: 130, card: 'title', sort: o => o.id, render: o => (
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.4 }}>
        <Link href={`/admin/orders/${o.id}`} className="strong num" style={{ color: 'var(--accent-fg)' }}>#{faId(o.id)}</Link><span className="xs muted">{faDate(o.createdAt)}</span>
      </span>
    ) },
    { key: 'items', header: 'اقلام', minWidth: 160, render: o => <ItemThumbs items={o.items} pics={pics} /> },
    { key: 'city', header: 'ارسال به', minWidth: 110, width: 110, render: o => cityGroup(o.city).name },
    { key: 'total', header: 'مبلغ', minWidth: 120, width: 140, align: 'end', sort: o => amountDue(o), render: o => <b className="num">{money(amountDue(o))}</b> },
    { key: 'pay', header: 'پرداخت', minWidth: 120, width: 140, render: o => <PayChip status={o.payment.status} /> },
    { key: 'owed', header: 'مانده', minWidth: 100, width: 120, align: 'end', sort: o => owedOn(o), render: o => owedOn(o) > 0 ? <b className="num" style={{ color: 'var(--danger-ink)' }}>{money(owedOn(o))}</b> : <span className="muted">—</span> },
    { key: 'status', header: 'وضعیت', minWidth: 140, width: 160, card: 'status', render: o => <StatusChip status={o.status} /> },
  ];

  const stats = [
    { k: 'سفارش‌ها', v: faNum(orders.length), s: [
      orders.filter(o => o.status === 'new').length ? `${faNum(orders.filter(o => o.status === 'new').length)} در انتظار تأیید` : '',
      orders.filter(o => o.status === 'cancelled').length ? `${faNum(orders.filter(o => o.status === 'cancelled').length)} لغوشده` : '',
    ].filter(Boolean).join(' · ') || 'همه پذیرفته‌شده', icon: 'orders' as const, tone: 1 },
    { k: 'مجموع خرید', v: faNum(Math.round(spent)), s: `${currency} · بدون هزینهٔ ارسال`, icon: 'coins' as const, tone: 3 },
    { k: 'مانده', v: faNum(Math.round(owed)), s: owed > 0 ? `${currency} · روی ${faNum(orders.filter(o => owedOn(o) > 0).length)} سفارش` : 'همه تسویه شده', icon: 'chartUp' as const, tone: 2 },
    { k: 'آخرین سفارش', v: last ? faAgo(last.createdAt) : '—', s: last ? faDate(last.createdAt) : 'هنوز سفارشی ندارد', icon: 'clock' as const, tone: 4 },
  ];

  return (
    <>
      <nav className="crumbs" aria-label="مسیر صفحه" style={{ paddingInline: 4 }}>
        <Link href="/admin/customers">مشتریان</Link><AIcon name="left" /><span aria-current="page">{c.name}</span>
      </nav>
      <Reveal className="profile" y={10}>
        <div className="profile-cover" aria-hidden="true" />
        <div className="profile-body">
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.1 }}>
            <Avatar name={c.name} seed={c.phone} size="lg" />
          </motion.div>
          <div className="titles">
            <h1>{c.name}</h1>
            <div className="meta">
              <span className="ltr"><AIcon name="phone" />{phoneOut(c.phone)}</span>
              {c.email && <span className="ltr"><AIcon name="mail" />{c.email}</span>}
              {home && <span><AIcon name="pin" />{cityGroup(home.city).name}</span>}
              <span><AIcon name="calendar" />مشتری از {faDate(c.createdAt)}</span>
            </div>
            {c.tags.length > 0 && <div className="row" style={{ gap: 6 }}>{c.tags.map(t => <span key={t} className={`tag${t === 'VIP' ? ' vip' : ''}`}>{t === 'VIP' && <AIcon name="crown" />}{t}</span>)}</div>}
          </div>
          <div className="actions">
            <Link className="btn" href={`/admin/orders/new?customer=${c.id}`}><AIcon name="plus" />سفارش جدید</Link>
            <a className="btn outline wa-o" href={`https://wa.me/${c.phone}`} target="_blank" rel="noreferrer"><AIcon name="whatsapp" />واتس‌اپ</a>
            <a className="btn outline" href={`tel:+${c.phone}`}><AIcon name="phone" />تماس</a>
            <button type="button" className="btn outline" onClick={() => setEditing(true)}><AIcon name="edit" />ویرایش</button>
            <Menu label="کارهای بیشتر" buttonClass="icon-btn bordered" items={[
              { label: 'کپی شماره', icon: 'copy', onSelect: () => { navigator.clipboard?.writeText('+' + c.phone); toast('ok', 'شماره کپی شد'); } },
              { label: 'سفارش‌های این مشتری', icon: 'orders', href: `/admin/orders?q=${c.phone}` },
              { divider: true, label: '' },
              { label: 'حذف مشتری', icon: 'trash', danger: true, onSelect: remove },
            ]}><AIcon name="more" /></Menu>
          </div>
        </div>
      </Reveal>

      <Stagger className="grid-4">
        {stats.map(s => (
          <motion.div key={s.k} variants={item} className={`stat s${s.tone}`}>
            <span className="blob" aria-hidden="true" />
            <span className="orb"><AIcon name={s.icon} duo /></span>
            <span className="k">{s.k}</span><span className="v num" suppressHydrationWarning>{s.v}</span><span className="s">{s.s}</span>
          </motion.div>
        ))}
      </Stagger>

      <DataTable label="سفارش‌های مشتری" rows={shownOrders} columns={cols} rowKey={o => String(o.id)} pageSize={5} initialSort={{ key: 'id', dir: 'desc' }} resetKey={oq}
            toolbar={<>
              <div className="row" style={{ gap: 12, flex: '1 1 100%' }}><span className="tile sm soft"><AIcon name="orders" duo /></span><div className="grow"><h2>سفارش‌ها</h2><p className="xs muted">همهٔ سفارش‌های {c.name}{owed > 0 ? ` · مانده کل ${money(owed)}` : ''}</p></div></div>
              {orders.length > 5 && <SearchInput value={oq} onChange={setOq} placeholder="شمارهٔ سفارش، محصول یا شهر…" />}
            </>}
            actions={o => <Link className="btn secondary sm" href={`/admin/orders/${o.id}`} aria-label={`جزئیات سفارش ${faId(o.id)}`}><span className="only-cards">جزئیات</span><AIcon name="left" /></Link>}
            empty={oq
              ? <Empty icon="search" title={`سفارشی با «${oq}» پیدا نشد`} action={<button type="button" className="btn outline sm" onClick={() => setOq('')}>پاک کردن جستجو</button>} small />
              : <Empty icon="orders" title="هنوز سفارشی ندارد" body="سفارش‌هایی که با این شماره ثبت شوند اینجا می‌آیند." action={<Link className="btn sm" href={`/admin/orders/new?customer=${c.id}`}><AIcon name="plus" />ثبت سفارش برای {c.name}</Link>} small />} />

      <div className="grid-main">
          <Reveal className="card">
            <div className="card-head">
              <span className="tile sm blue"><AIcon name="pin" duo /></span>
              <div className="titles"><h2>نشانی‌ها</h2><p>{c.addresses.length >= MAX_ADDRESSES ? `حداکثر ${faNum(MAX_ADDRESSES)} نشانی؛ برای افزودن، یکی را حذف کنید` : c.addresses.length ? `${faNum(c.addresses.length)} نشانی ذخیره‌شده` : 'نشانی‌ای ذخیره نشده'}</p></div>
              <button type="button" className="btn outline sm" disabled={c.addresses.length >= MAX_ADDRESSES} title={c.addresses.length >= MAX_ADDRESSES ? `حداکثر ${faNum(MAX_ADDRESSES)} نشانی؛ برای افزودن، یکی را حذف کنید` : undefined}
                onClick={() => setAddr({ open: true, a: null })}><AIcon name="plus" />نشانی جدید</button>
            </div>
            <div className="addr-grid">
              <AnimatePresence initial={false}>
                {c.addresses.map(a => (
                  <motion.div key={a.id} layout className={`addr${a.isDefault ? ' def' : ''}`} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}>
                    <div className="head">
                      <AIcon name={a.label === 'محل کار' ? 'work' : 'home'} duo /><b>{a.label || 'نشانی'}</b>
                      {a.isDefault && <span className="chip ok">پیش‌فرض</span>}
                    </div>
                    <p>{[cityGroup(a.city).name, a.area].filter(Boolean).join('، ')}{a.line && <><br />{a.line}</>}</p>
                    <div className="acts">
                      <button type="button" className="btn ghost sm" onClick={() => setAddr({ open: true, a })}><AIcon name="edit" />ویرایش</button>
                      {!a.isDefault && <button type="button" className="btn ghost sm" disabled={busy} onClick={() => save({ ...c, addresses: c.addresses.map(x => ({ ...x, isDefault: x.id === a.id })) }, 'نشانی پیش‌فرض تغییر کرد')}>پیش‌فرض کن</button>}
                      <button type="button" className="icon-btn sm" aria-label={`حذف ${a.label}`} disabled={busy} onClick={() => removeAddress(a)} style={{ marginInlineStart: 'auto' }}><AIcon name="trash" /></button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {!c.addresses.length && <button type="button" className="add-tile" onClick={() => setAddr({ open: true, a: null })}><AIcon name="plus" />اولین نشانی را اضافه کنید</button>}
            </div>
          </Reveal>

        <Reveal className="card stack" delay={0.05}>
          <div className="card-head" style={{ margin: 0 }}>
            <span className="tile sm gold"><AIcon name="note" duo /></span>
            <div className="titles"><h2>یادداشت‌ها</h2><p>فقط تیم آتلیه می‌بیند</p></div>
          </div>
          {!c.notes.length && <p className="xs muted">هنوز یادداشتی ثبت نشده. سلیقه، اندازه‌ها و قول‌ها را اینجا بنویسید.</p>}
          <div className="stack-sm">
            <label className="sr-only" htmlFor="new-note">یادداشت تازه</label>
            <textarea id="new-note" className="textarea" value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder="مثلاً: سایز M با آستین بلندتر، رنگ روشن دوست دارد…" style={{ minHeight: 80 }}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addNote(); } }} />
            <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} disabled={!note.trim() || busy} onClick={addNote}><AIcon name="plus" />افزودن یادداشت</button>
          </div>
          {c.notes.length ? (
            <ul className="notes">
              <AnimatePresence initial={false}>
                {c.notes.map(n => (
                  <motion.li key={n.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, paddingBlock: 0 }}>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{n.text}</p>
                    <span>{faDateTime(n.at)}
                      <button type="button" className="icon-btn sm" aria-label="حذف یادداشت" disabled={busy}
                        onClick={async () => { if (await confirm({ title: 'حذف یادداشت', body: 'این یادداشت حذف شود؟', confirm: 'حذف', danger: true })) save({ ...c, notes: c.notes.filter(x => x.id !== n.id) }, 'یادداشت حذف شد'); }}>
                        <AIcon name="trash" />
                      </button>
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          ) : null}
        </Reveal>
      </div>

      <CustomerDialog open={editing} customer={c} onClose={() => setEditing(false)} onSaved={s => { setC(s); setEditing(false); router.refresh(); }} />
      <AddressDialog open={addr.open} customer={c} address={addr.a} onClose={() => setAddr({ open: false, a: null })} onSaved={s => { setC(s); setAddr({ open: false, a: null }); router.refresh(); }} />
    </>
  );
}
