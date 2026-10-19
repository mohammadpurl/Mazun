'use client';
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useState } from 'react';
import type { Category, Garment } from '@/lib/types';
import { api, faNum } from './api';
import { useReorder } from './useReorder';

export function GarmentList({ initial, categories, currency }: { initial: Garment[]; categories: Category[]; currency: string }) {
  const [items, setItems] = useState(initial);
  const [err, setErr] = useState('');
  const { move, rowProps, error } = useReorder(items, setItems, '/api/admin/garments/reorder');
  const catName = (id: string | null) => (id ? categories.find(c => c.id === id)?.name.fa ?? '—' : 'بدون دسته');

  async function toggle(g: Garment) {
    setErr('');
    try {
      const { id, createdAt, sort, ...rest } = g;
      void createdAt; void sort;
      const saved = await api<Garment>(`/api/admin/garments/${id}`, 'PUT', { ...rest, visible: !g.visible });
      setItems(list => list.map(x => (x.id === id ? saved : x)));
    } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div className="stack">
      <div className="top">
        <h1>لباس‌ها</h1>
        <Link className="btn" href="/admin/garments/new">+ لباس جدید</Link>
      </div>
      <div className="card stack" style={{ gap: 10 }}>
        <p className="muted small" style={{ margin: 0 }}>ترتیب این فهرست همان ترتیب نمایش روی رگال سایت است. برای جابه‌جایی، ردیف را بکشید یا از دکمه‌های ▲▼ استفاده کنید.</p>
        {(err || error) && <div className="msg err" role="alert">{err || error}</div>}
        {items.length === 0 ? <p className="muted">هنوز لباسی ثبت نشده.</p> : (
          <div className="glist">
            {items.map((g, i) => {
              const rp = rowProps(g.id);
              const out = g.sizes.filter(s => !s.ok).map(s => s.n);
              return (
                <div key={g.id} {...rp} className={`gi ${rp.className}${g.visible ? '' : ' off'}`}>
                  <span className="grip" aria-hidden="true">⋮⋮</span>
                  <img src={g.front} alt="" />
                  <div className="meta">
                    <b>{g.name.fa || g.name.en}</b>
                    <span className="small muted">
                      {catName(g.categoryId)} · {g.salePrice != null ? <><s>{faNum(g.price)}</s> {faNum(g.salePrice)}</> : faNum(g.price)} {currency}
                      {out.length > 0 && <> · <span className="err">تمام‌شده: <span dir="ltr">{out.join(', ')}</span></span></>}
                    </span>
                  </div>
                  <span className={`badge${g.visible ? ' live' : ''} hide-sm`}>{g.visible ? 'نمایش' : 'مخفی'}</span>
                  <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(g.id, i - 1)} aria-label="بالاتر">▲</button>
                  <button type="button" className="icon-btn" disabled={i === items.length - 1} onClick={() => move(g.id, i + 1)} aria-label="پایین‌تر">▼</button>
                  <button type="button" className="btn alt sm hide-sm" onClick={() => toggle(g)}>{g.visible ? 'مخفی کن' : 'نمایش بده'}</button>
                  <Link className="btn sm" href={`/admin/garments/${g.id}`}>ویرایش</Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
