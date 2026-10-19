'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Category, L10n } from '@/lib/types';
import { api, faNum } from './api';
import { useReorder } from './useReorder';

const empty: L10n = { fa: '', ar: '', en: '' };

export function CategoryManager({ initial, counts }: { initial: Category[]; counts: Record<string, number> }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<{ name: L10n; visible: boolean }>({ name: { ...empty }, visible: true });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const { move, rowProps, error } = useReorder(items, setItems, '/api/admin/categories/reorder');

  function edit(c: Category | null) {
    setErr('');
    setEditing(c ? c.id : 'new');
    setDraft(c ? { name: { ...c.name }, visible: c.visible } : { name: { ...empty }, visible: true });
  }

  async function save() {
    setBusy(true); setErr('');
    try {
      if (editing === 'new') { const c = await api<Category>('/api/admin/categories', 'POST', draft); setItems(l => [...l, c]); }
      else { const c = await api<Category>(`/api/admin/categories/${editing}`, 'PUT', draft); setItems(l => l.map(x => (x.id === c.id ? c : x))); }
      setEditing(null);
      router.refresh();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function remove(c: Category) {
    const n = counts[c.id] ?? 0;
    if (!confirm(`دستهٔ «${c.name.fa || c.name.en}» حذف شود؟${n ? ` ${faNum(n)} لباس این دسته «بدون دسته» می‌شوند و حذف نمی‌شوند.` : ''}`)) return;
    try { await api(`/api/admin/categories/${c.id}`, 'DELETE'); setItems(l => l.filter(x => x.id !== c.id)); router.refresh(); }
    catch (e) { setErr((e as Error).message); }
  }

  const form = (
    <div className="card stack" style={{ gap: 10, background: '#f8faf9' }}>
      <div className="grid">
        {(['fa', 'ar', 'en'] as const).map(l => (
          <label key={l} className="f">نام {{ fa: 'فارسی', ar: 'عربی', en: 'انگلیسی' }[l]}
            <input value={draft.name[l]} dir={l === 'en' ? 'ltr' : 'rtl'} maxLength={60} autoFocus={l === 'fa'}
              onChange={e => setDraft({ ...draft, name: { ...draft.name, [l]: e.target.value } })} />
          </label>
        ))}
      </div>
      <label className="check"><input type="checkbox" checked={draft.visible} onChange={e => setDraft({ ...draft, visible: e.target.checked })} /> در سایت نمایش داده شود</label>
      <div className="row">
        <button type="button" className="btn" disabled={busy} onClick={save}>ذخیره</button>
        <button type="button" className="btn alt" onClick={() => setEditing(null)}>انصراف</button>
      </div>
    </div>
  );

  return (
    <div className="stack">
      <div className="top">
        <h1>دسته‌بندی‌ها</h1>
        <button type="button" className="btn" onClick={() => edit(null)}>+ دستهٔ جدید</button>
      </div>
      <div className="card stack" style={{ gap: 10 }}>
        <p className="muted small" style={{ margin: 0 }}>دسته‌ها در سایت به صورت دکمه‌های فیلتر بالای رگال نمایش داده می‌شوند (وقتی بیش از یک دستهٔ دارای لباس باشد). لباس‌های یک دستهٔ مخفی هم در سایت دیده نمی‌شوند.</p>
        {(err || error) && <div className="msg err" role="alert">{err || error}</div>}
        {editing === 'new' && form}
        {items.length === 0 && editing !== 'new' && <p className="muted">هنوز دسته‌ای ساخته نشده.</p>}
        <div className="glist">
          {items.map((c, i) => {
            const rp = rowProps(c.id);
            return editing === c.id ? <div key={c.id}>{form}</div> : (
              <div key={c.id} {...rp} className={`gi ${rp.className}${c.visible ? '' : ' off'}`}>
                <span className="grip" aria-hidden="true">⋮⋮</span>
                <div className="meta">
                  <b>{c.name.fa || c.name.en}</b>
                  <span className="small muted">{[c.name.ar, c.name.en].filter(Boolean).join(' · ')} · {faNum(counts[c.id] ?? 0)} لباس</span>
                </div>
                <span className={`badge${c.visible ? ' live' : ''}`}>{c.visible ? 'نمایش' : 'مخفی'}</span>
                <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(c.id, i - 1)} aria-label="بالاتر">▲</button>
                <button type="button" className="icon-btn" disabled={i === items.length - 1} onClick={() => move(c.id, i + 1)} aria-label="پایین‌تر">▼</button>
                <button type="button" className="btn alt sm" onClick={() => edit(c)}>ویرایش</button>
                <button type="button" className="btn del sm" onClick={() => remove(c)}>حذف</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
