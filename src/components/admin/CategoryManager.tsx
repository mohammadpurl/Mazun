'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Category, L10n } from '@/lib/types';
import { api, faNum } from './api';
import { emptyL10n, ImageField, L10nFields } from './fields';
import { useReorder } from './useReorder';


export function CategoryManager({ initial, counts }: { initial: Category[]; counts: Record<string, number> }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<{ name: L10n; description: L10n; image: string; visible: boolean }>({ name: emptyL10n(), description: emptyL10n(), image: '', visible: true });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const { move, rowProps, error } = useReorder(items, setItems, '/api/admin/categories/reorder');

  function edit(c: Category | null) {
    setErr('');
    setEditing(c ? c.id : 'new');
    setDraft(c ? { name: { ...c.name }, description: { ...c.description }, image: c.image, visible: c.visible } : { name: emptyL10n(), description: emptyL10n(), image: '', visible: true });
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
    if (!confirm(`مجموعهٔ «${c.name.fa || c.name.en}» حذف شود؟${n ? ` ${faNum(n)} لباس این دسته «بدون مجموعه» می‌شوند و حذف نمی‌شوند.` : ''}`)) return;
    try { await api(`/api/admin/categories/${c.id}`, 'DELETE'); setItems(l => l.filter(x => x.id !== c.id)); router.refresh(); }
    catch (e) { setErr((e as Error).message); }
  }

  const form = (
    <div className="card stack" style={{ gap: 10, background: '#f8faf9' }}>
      <L10nFields label="نام مجموعه" value={draft.name} onChange={name => setDraft({ ...draft, name })} max={60} />
      <L10nFields label="توضیح کوتاه (زیر عکس در صفحهٔ اصلی)" value={draft.description} onChange={description => setDraft({ ...draft, description })} max={200} />
      <div style={{ maxWidth: 320 }}><ImageField label="عکس مجموعه (عمودی)" value={draft.image} onChange={image => setDraft({ ...draft, image })} /></div>
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
        <h1>مجموعه‌ها</h1>
        <button type="button" className="btn" onClick={() => edit(null)}>+ مجموعهٔ جدید</button>
      </div>
      <div className="card stack" style={{ gap: 10 }}>
        <p className="muted small" style={{ margin: 0 }}>چهار مجموعهٔ اول (به همین ترتیب) با عکس و توضیح در صفحهٔ اصلی نمایش داده می‌شوند و همهٔ مجموعه‌های دارای لباس، فیلتر رگال هستند. لباس‌های یک مجموعهٔ مخفی در سایت دیده نمی‌شوند.</p>
        {(err || error) && <div className="msg err" role="alert">{err || error}</div>}
        {editing === 'new' && form}
        {items.length === 0 && editing !== 'new' && <p className="muted">هنوز مجموعه‌ای ساخته نشده.</p>}
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
