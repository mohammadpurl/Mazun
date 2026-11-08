'use client';
/* Ctrl/⌘ K: one box to jump anywhere. Pages match at once; orders (by number, name or phone), customers and products
   come from /api/admin/search as you type. Arrow keys move, Enter opens, Escape closes. */
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { OrderStatus } from '@/lib/types';
import { faId, faNum, searchable } from '../ui/format';
import { AIcon, type AIconName } from '../ui/Icon';
import { StatusChip } from '../ui/controls';
import { NAV_PAGES } from './nav';

interface Found {
  orders: { id: number; name: string; status: OrderStatus; total: number }[];
  customers: { id: string; name: string; phone: string }[];
  products: { id: string; name: string; image: string }[];
}
interface Item { key: string; group: string; title: string; sub?: string; icon: AIconName; href: string; image?: string; status?: OrderStatus }

const EXTRA: Item[] = [
  { key: 'o-add', group: 'کارها', title: 'ثبت سفارش جدید', icon: 'plus', href: '/admin/orders/new' },
  { key: 'p-new', group: 'کارها', title: 'افزودن محصول', icon: 'plus', href: '/admin/garments/new' },
  { key: 'c-new', group: 'کارها', title: 'افزودن مشتری', icon: 'userPlus', href: '/admin/customers?new=1' },
  { key: 'o-new', group: 'کارها', title: 'سفارش‌های جدید (بررسی‌نشده)', icon: 'sparkle', href: '/admin/orders?status=new' },
  { key: 's-ready', group: 'کارها', title: 'در انتظار ارسال', icon: 'package', href: '/admin/shipments' },
];

export function CommandPalette({ open, onClose, onGo, currency }: { open: boolean; onClose: () => void; onGo: (href: string) => void; currency: string }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Found | null>(null);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.querySelector<HTMLElement>('.adm')), []);
  useEffect(() => { if (open) { setQ(''); setFound(null); setActive(0); setTimeout(() => input.current?.focus(), 20); } }, [open]);
  useEffect(() => {
    // Orders, customers and products are looked up from two characters on (pages and actions match from the first).
    if (!open || q.trim().length < 2) { setFound(null); setLoading(false); return; }
    const ctl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      fetch('/api/admin/search?q=' + encodeURIComponent(q.trim()), { signal: ctl.signal })
        .then(r => (r.ok ? r.json() : null)).then(d => { setFound(d); setActive(0); }).catch(() => undefined).finally(() => { if (!ctl.signal.aborted) setLoading(false); });
    }, 160);
    return () => { clearTimeout(t); ctl.abort(); setLoading(false); };
  }, [q, open]);

  const items = useMemo<Item[]>(() => {
    const s = searchable(q);
    const pages = NAV_PAGES.filter(p => !s || searchable(p.label).includes(s)).map(p => ({ key: p.href, group: 'صفحه‌ها', title: p.label, icon: p.icon, href: p.href }));
    const acts = EXTRA.filter(a => !s || searchable(a.title).includes(s));
    const out: Item[] = [...pages, ...acts];
    if (found) {
      out.push(...found.orders.map(o => ({ key: 'o' + o.id, group: 'سفارش‌ها', title: `سفارش #${faId(o.id)} — ${o.name}`, sub: `${faNum(o.total)} ${currency}`, icon: 'orders' as const, href: `/admin/orders/${o.id}`, status: o.status })));
      out.push(...found.customers.map(c => ({ key: 'c' + c.id, group: 'مشتریان', title: c.name, sub: '+' + c.phone, icon: 'user' as const, href: `/admin/customers/${c.id}` })));
      out.push(...found.products.map(p => ({ key: 'g' + p.id, group: 'محصولات', title: p.name, icon: 'products' as const, href: `/admin/garments/${p.id}`, image: p.image })));
    }
    return out;
  }, [q, found]);
  useEffect(() => { list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(items.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && items[active]) { e.preventDefault(); onGo(items[active].href); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'Tab') e.preventDefault();
  };
  if (!host) return null;
  let lastGroup = '';
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="overlay" style={{ alignItems: 'start' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
          <motion.div className="cmdk" role="dialog" aria-modal="true" aria-label="جستجو در پنل" onKeyDown={onKey}
            initial={{ opacity: 0, y: -14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.98 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
            <div className="cmdk-input">
              <AIcon name={loading ? 'spinner' : 'search'} className={loading ? 'spin' : undefined} />
              <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder="شمارهٔ سفارش، نام یا تلفن مشتری، نام محصول…" role="combobox" aria-expanded="true"
                aria-controls="cmdk-list" aria-activedescendant={items[active] ? `cmdk-${items[active].key}` : undefined} aria-autocomplete="list" />
              <kbd>Esc</kbd>
            </div>
            <div className="cmdk-list" id="cmdk-list" role="listbox" ref={list} aria-label="نتیجه‌ها">
              {items.map((it, i) => {
                const head = it.group !== lastGroup ? it.group : '';
                lastGroup = it.group;
                return (
                  <div key={it.key} role="presentation">
                    {head && <div className="cmdk-group" role="presentation">{head}</div>}
                    <div id={`cmdk-${it.key}`} data-i={i} role="option" aria-selected={i === active} className={`cmdk-item${i === active ? ' active' : ''}`}
                      onPointerEnter={() => setActive(i)} onClick={() => onGo(it.href)}>
                      {it.image ? <span className="thumb sq" style={{ width: 36, height: 36 }}><img src={it.image} alt="" /></span> : <AIcon name={it.icon} duo />}
                      <span className="grow"><b>{it.title}</b>{it.sub && <span className="ltr" style={{ textAlign: 'start' }}>{it.sub}</span>}</span>
                      {it.status && <StatusChip status={it.status} />}
                    </div>
                  </div>
                );
              })}
              {!items.length && (loading
                ? <div className="empty sm" role="status"><AIcon name="spinner" className="spin" /><span>در حال جستجو…</span></div>
                : <div className="empty sm"><b>چیزی پیدا نشد</b><span>«{q}» را با شمارهٔ سفارش یا تلفن امتحان کنید.</span></div>)}
            </div>
            <div className="cmdk-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> جابه‌جایی</span><span><kbd>Enter</kbd> باز کردن</span><span><kbd>Esc</kbd> بستن</span></div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    host,
  );
}
