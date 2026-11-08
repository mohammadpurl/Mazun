'use client';
/* Collections: the rack's filters and the tiles on the home page. Cards with the cover photo, the number of pieces,
   show/hide, edit and delete; arrows move a collection earlier or later (the shop's order). */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import type { Category, L10n } from '@/lib/types';
import { Dialog, useUi } from '../ui/Dialog';
import { Empty, L10nField, PageHeader, SearchInput, Switch } from '../ui/controls';
import { Pagination } from '../ui/DataTable';
import { faNum, searchable } from '../ui/format';
import { AIcon } from '../ui/Icon';
import { api } from '../api';
import { Slot } from '../products/Media';

type Draft = { name: L10n; description: L10n; image: string; visible: boolean };
const blank = (): Draft => ({ name: { en: '', ar: '', fa: '' }, description: { en: '', ar: '', fa: '' }, image: '', visible: true });

export function Collections({ initial, counts, covers, openNew }: { initial: Category[]; counts: Record<string, number>; covers: Record<string, string>; openNew: boolean }) {
  const router = useRouter();
  const { toast, confirm } = useUi();
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<Category | 'new' | null>(openNew ? 'new' : null);
  const [draft, setDraft] = useState<Draft>(blank());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [q, setQ] = useState('');
  const matching = items.filter(c => !q || [c.name.fa, c.name.en, c.name.ar].some(t => searchable(t).includes(searchable(q))));
  const PER = 12;
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(matching.length / PER));
  const shown = matching.slice((Math.min(page, pages) - 1) * PER, Math.min(page, pages) * PER);

  const open = (c: Category | 'new') => { setErrors({}); setDraft(c === 'new' ? blank() : { name: { ...c.name }, description: { ...c.description }, image: c.image, visible: c.visible }); setEditing(c); };
  async function save() {
    setBusy(true); setErrors({});
    try {
      if (editing === 'new') { const c = await api<Category>('/api/admin/categories', 'POST', draft); setItems(l => [...l, c]); toast('ok', 'مجموعه اضافه شد', c.name.fa || c.name.en); }
      else if (editing) { const c = await api<Category>(`/api/admin/categories/${editing.id}`, 'PUT', draft); setItems(l => l.map(x => (x.id === c.id ? c : x))); toast('ok', 'مجموعه ذخیره شد'); }
      setEditing(null);
      router.refresh();
    } catch (e) {
      const er = (e as Error & { errors?: Record<string, string> }).errors;
      if (er) setErrors(er); else toast('err', 'ذخیره نشد', (e as Error).message);
    } finally { setBusy(false); }
  }
  async function toggle(c: Category) {
    try {
      const s = await api<Category>(`/api/admin/categories/${c.id}`, 'PUT', { name: c.name, description: c.description, image: c.image, visible: !c.visible });
      setItems(l => l.map(x => (x.id === s.id ? s : x)));
      toast('ok', s.visible ? 'مجموعه در فروشگاه نمایش داده می‌شود' : 'مجموعه پنهان شد');
      router.refresh();
    } catch (e) { toast('err', 'تغییر ذخیره نشد', (e as Error).message); }
  }
  async function remove(c: Category) {
    const n = counts[c.id] ?? 0;
    if (!(await confirm({ title: `حذف «${c.name.fa || c.name.en}»`, body: n ? `${faNum(n)} لباس این مجموعه حذف نمی‌شوند و «بدون مجموعه» می‌مانند.` : 'این مجموعه لباسی ندارد.', confirm: 'حذف مجموعه', danger: true }))) return;
    try { await api(`/api/admin/categories/${c.id}`, 'DELETE'); setItems(l => l.filter(x => x.id !== c.id)); toast('ok', 'مجموعه حذف شد'); router.refresh(); }
    catch (e) { toast('err', 'حذف نشد', (e as Error).message); }
  }
  async function move(id: string, d: -1 | 1) {
    const i = items.findIndex(c => c.id === id), j = i + d;
    if (i < 0 || j < 0 || j >= items.length) return;
    const prev = items, next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
    try { await api('/api/admin/categories/reorder', 'PUT', next.map(c => c.id)); router.refresh(); }
    catch (e) { setItems(prev); toast('err', 'ترتیب ذخیره نشد', (e as Error).message); }
  }

  return (
    <>
      <PageHeader icon="collections" title="مجموعه‌ها" crumbs={[{ label: 'کاتالوگ' }, { label: 'مجموعه‌ها' }]} sub="فیلترهای رگال و کاشی‌های صفحهٔ اصلی فروشگاه. ترتیب همین‌جا در فروشگاه هم رعایت می‌شود.">
        <button type="button" className="btn" onClick={() => open('new')}><AIcon name="plus" />مجموعهٔ جدید</button>
      </PageHeader>
      <div className="card flush">
        <div className="toolbar">
          <SearchInput value={q} onChange={v => { setQ(v); setPage(1); }} placeholder="جستجوی مجموعه…" />
          <span className="xs muted" style={{ marginInlineStart: 'auto' }}>{faNum(items.length)} مجموعه · {faNum(items.filter(c => c.visible).length)} در فروشگاه</span>
        </div>
        {shown.length ? (
          <motion.div layout className="collection-grid" style={{ padding: '0 20px 20px' }}>
            <AnimatePresence initial={false}>
              {shown.map(c => {
                const i = items.indexOf(c);
                return (
                  <motion.article key={c.id} layout className="ccard" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 30 }} whileHover={{ y: -3 }}>
                    <div className="ph">
                      {c.image ? <img src={c.image} alt="" loading="lazy" /> : covers[c.id] ? <img src={covers[c.id]} alt="" loading="lazy" style={{ objectPosition: 'center 20%', opacity: 0.85 }} /> : <AIcon name="collections" duo />}
                      <span className="chip" style={{ position: 'absolute', insetBlockStart: 10, insetInlineStart: 10, background: 'var(--card)', '--c': 'var(--muted-fg)', '--ci': 'var(--fg)' } as React.CSSProperties}>{faNum(i + 1)}</span>
                    </div>
                    <div className="body">
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <b>{c.name.fa || c.name.en}</b>
                        {!c.visible && <span className="chip neutral"><AIcon name="eyeOff" />پنهان</span>}
                      </div>
                      <p>{c.description.fa || c.description.en || 'بدون توضیح'}</p>
                      {!c.image && <span className="xs" style={{ color: 'var(--warning-ink)' }} title="فعلاً عکس اولین لباس این مجموعه نشان داده می‌شود"><AIcon name="image" /> بدون عکس کاشی</span>}
                      <Link className="link xs" href={`/admin/garments?cat=${c.id}`}>{faNum(counts[c.id] ?? 0)} لباس<AIcon name="left" /></Link>
                    </div>
                    <div className="foot">
                      <Switch label={c.visible ? 'نمایش' : 'پنهان'} checked={c.visible} onChange={() => toggle(c)} hideLabel />
                      <span className="grow" />
                      <button type="button" className="icon-btn sm" aria-label={`جلوتر: ${c.name.fa}`} disabled={i === 0 || !!q} onClick={() => move(c.id, -1)}><AIcon name="right" className="h-only" /><AIcon name="up" className="v-only" /></button>
                      <button type="button" className="icon-btn sm" aria-label={`عقب‌تر: ${c.name.fa}`} disabled={i === items.length - 1 || !!q} onClick={() => move(c.id, 1)}><AIcon name="left" className="h-only" /><AIcon name="down" className="v-only" /></button>
                      <button type="button" className="icon-btn sm" aria-label={`ویرایش ${c.name.fa}`} onClick={() => open(c)}><AIcon name="edit" /></button>
                      <button type="button" className="icon-btn sm" aria-label={`حذف ${c.name.fa}`} onClick={() => remove(c)}><AIcon name="trash" /></button>
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </motion.div>
        ) : q
          ? <Empty icon="search" title={`مجموعه‌ای با «${q}» پیدا نشد`} action={<button type="button" className="btn outline sm" onClick={() => setQ('')}>پاک کردن جستجو</button>} />
          : <Empty icon="collections" title="هنوز مجموعه‌ای ساخته نشده" action={<button type="button" className="btn sm" onClick={() => open('new')}><AIcon name="plus" />مجموعهٔ جدید</button>} />}
        {pages > 1 && <div className="table-foot"><span className="xs muted">{faNum(matching.length)} مجموعه</span><Pagination page={Math.min(page, pages)} pages={pages} onPage={setPage} /><span /></div>}
      </div>

      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'مجموعهٔ جدید' : 'ویرایش مجموعه'} icon="collections" wide busy={busy}
        footer={<>
          <button type="button" className="btn outline" onClick={() => setEditing(null)} disabled={busy}>انصراف</button>
          <button type="button" className="btn" onClick={save} disabled={busy || uploading > 0}>{busy ? 'در حال ذخیره…' : 'ذخیره'}</button>
        </>}>
        <L10nField label="نام مجموعه" value={draft.name} onChange={name => setDraft(d => ({ ...d, name }))} max={60} error={errors.name} />
        <L10nField label="توضیح کوتاه" value={draft.description} onChange={description => setDraft(d => ({ ...d, description }))} multiline max={200} />
        <div style={{ maxWidth: 220 }}>
          <Slot label="عکس کاشی صفحهٔ اصلی" hint="افقی یا عمودی، رها کنید یا بزنید" value={draft.image} onChange={image => setDraft(d => ({ ...d, image }))} cover onBusy={n => setUploading(u => Math.max(0, u + n))} />
        </div>
        <Switch label="در فروشگاه نمایش داده شود" hint="مجموعهٔ پنهان و لباس‌هایش در فروشگاه دیده نمی‌شوند" checked={draft.visible} onChange={visible => setDraft(d => ({ ...d, visible }))} />
      </Dialog>
    </>
  );
}
