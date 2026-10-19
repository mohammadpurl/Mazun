'use client';
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DEFAULT_CHART, DEFAULT_SIZES } from '@/lib/defaults';
import { CHART_FIELDS, type Category, type ChartField, type Garment, type L10n, type Size } from '@/lib/types';
import { api, uploadImage } from './api';

const FIELD_LABEL: Record<ChartField, string> = { bust: 'دور سینه', waist: 'دور کمر', hips: 'دور باسن', length: 'قد لباس', sleeve: 'آستین' };
const LANG_LABEL = { fa: 'فارسی', ar: 'عربی', en: 'انگلیسی' } as const;
const empty: L10n = { fa: '', ar: '', en: '' };

export function GarmentEditor({ initial, categories }: { initial: Garment | null; categories: Category[] }) {
  const router = useRouter();
  const [name, setName] = useState<L10n>(initial?.name ?? { ...empty });
  const [description, setDescription] = useState<L10n>(initial?.description ?? { ...empty });
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? '');
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [salePrice, setSalePrice] = useState(initial?.salePrice != null ? String(initial.salePrice) : '');
  const [leadDays, setLeadDays] = useState(String(initial?.leadDays ?? 0));
  const [visible, setVisible] = useState(initial?.visible ?? true);
  const [sizes, setSizes] = useState<Size[]>(initial?.sizes ?? DEFAULT_SIZES.map(n => ({ n, ok: true })));
  const [chart, setChart] = useState<Record<string, Record<string, string>>>(() => {
    const c: Record<string, Record<string, string>> = {};
    for (const [n, row] of Object.entries(initial?.chart ?? {})) c[n] = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v)]));
    return c;
  });
  const [images, setImages] = useState({ front: initial?.front ?? '', back: initial?.back ?? '' });
  const [uploading, setUploading] = useState<'' | 'front' | 'back'>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick(k: 'front' | 'back', file: File | undefined) {
    if (!file) return;
    setUploading(k); setErrors(e => ({ ...e, [k]: '' }));
    try { const url = await uploadImage(file); setImages(i => ({ ...i, [k]: url })); }
    catch (e) { setErrors(er => ({ ...er, [k]: (e as Error).message })); }
    finally { setUploading(''); }
  }

  function setSize(i: number, patch: Partial<Size>) { setSizes(list => list.map((s, j) => (j === i ? { ...s, ...patch } : s))); }

  async function save() {
    setBusy(true); setMsg(''); setErrors({});
    const body = {
      name, description, categoryId: categoryId || null, price, salePrice: salePrice.trim() === '' ? null : salePrice,
      leadDays, visible, sizes, chart, front: images.front, back: images.back || images.front,
    };
    try {
      if (initial) await api(`/api/admin/garments/${initial.id}`, 'PUT', body);
      else await api('/api/admin/garments', 'POST', body);
      router.push('/admin/garments');
      router.refresh();
    } catch (e) {
      const er = (e as Error & { errors?: Record<string, string> }).errors;
      if (er) setErrors(er);
      setMsg((e as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!initial || !confirm(`«${initial.name.fa || initial.name.en}» حذف شود؟ سفارش‌های قبلی این لباس باقی می‌مانند.`)) return;
    setBusy(true);
    try { await api(`/api/admin/garments/${initial.id}`, 'DELETE'); router.push('/admin/garments'); router.refresh(); }
    catch (e) { setMsg((e as Error).message); setBusy(false); }
  }

  const err = (k: string) => errors[k] && <span className="err">{errors[k]}</span>;

  return (
    <div className="stack">
      <div className="top">
        <h1>{initial ? 'ویرایش لباس' : 'لباس جدید'}</h1>
        <Link className="btn alt" href="/admin/garments">بازگشت به فهرست</Link>
      </div>

      <section className="card stack">
        <h2>نام و قیمت</h2>
        <div className="grid">
          {(['fa', 'ar', 'en'] as const).map(l => (
            <label key={l} className="f">نام {LANG_LABEL[l]}
              <input value={name[l]} dir={l === 'en' ? 'ltr' : 'rtl'} maxLength={120} onChange={e => setName({ ...name, [l]: e.target.value })} />
            </label>
          ))}
        </div>
        {err('name')}
        <div className="grid">
          <label className="f">دسته
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">بدون دسته</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name.fa || c.name.en}</option>)}
            </select>
          </label>
          <label className="f">قیمت<input type="number" min={0} step="0.001" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} />{err('price')}</label>
          <label className="f">قیمت با تخفیف (خالی = بدون تخفیف)<input type="number" min={0} step="0.001" inputMode="decimal" value={salePrice} onChange={e => setSalePrice(e.target.value)} />{err('salePrice')}</label>
          <label className="f">روزهای آماده‌سازی اضافه<input type="number" min={0} max={365} value={leadDays} onChange={e => setLeadDays(e.target.value)} /></label>
        </div>
        <label className="check"><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} /> در سایت نمایش داده شود</label>
      </section>

      <section className="card stack">
        <h2>تصاویر</h2>
        <p className="muted small" style={{ margin: 0 }}>PNG یا WebP با پس‌زمینهٔ شفاف بهترین نتیجه را روی رگال می‌دهد. تصویر خودکار کوچک و بهینه می‌شود.</p>
        <div className="imgs">
          {(['front', 'back'] as const).map(k => (
            <div key={k} className="drop">
              {images[k] ? <img src={images[k]} alt="" /> : <div className="ph">{k === 'back' ? 'اگر خالی بماند، تصویر رو استفاده می‌شود' : 'بدون تصویر'}</div>}
              <label className="f" style={{ alignItems: 'center' }}>{k === 'front' ? 'روی لباس' : 'پشت لباس'}
                <input type="file" accept="image/png,image/jpeg,image/webp" disabled={!!uploading} onChange={e => pick(k, e.target.files?.[0])} />
              </label>
              {uploading === k && <span className="small muted">در حال بارگذاری…</span>}
              {err(k)}
            </div>
          ))}
        </div>
      </section>

      <section className="card stack">
        <h2>سایزها و موجودی</h2>
        <div className="row">
          {sizes.map((s, i) => (
            <div key={i} className="sizerow">
              <input type="text" aria-label="نام سایز" value={s.n} maxLength={12} dir="ltr" onChange={e => setSize(i, { n: e.target.value.toUpperCase() })} />
              <label className="check"><input type="checkbox" checked={s.ok} onChange={e => setSize(i, { ok: e.target.checked })} /> موجود</label>
              <button type="button" className="icon-btn" aria-label={`حذف سایز ${s.n}`} onClick={() => setSizes(list => list.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button type="button" className="btn alt sm" onClick={() => setSizes(list => [...list, { n: '', ok: true }])}>+ سایز</button>
        </div>
        {err('sizes')}
      </section>

      <section className="card stack">
        <h2>جدول سایز (سانتی‌متر)</h2>
        <p className="muted small" style={{ margin: 0 }}>خانه‌های خالی از جدول پیش‌فرض پر می‌شوند (کم‌رنگ نشان داده شده). این جدول در «راهنمای سایز» سایت دیده می‌شود.</p>
        <div className="tbl-wrap">
          <table className="tbl chart-tbl">
            <thead><tr><th>سایز</th>{CHART_FIELDS.map(f => <th key={f}>{FIELD_LABEL[f]}</th>)}</tr></thead>
            <tbody>
              {sizes.filter(s => s.n).map(s => (
                <tr key={s.n}>
                  <td dir="ltr">{s.n}</td>
                  {CHART_FIELDS.map(f => (
                    <td key={f}>
                      <input type="number" min={0} max={400} aria-label={`${FIELD_LABEL[f]} ${s.n}`}
                        placeholder={String(DEFAULT_CHART[s.n as keyof typeof DEFAULT_CHART]?.[f as keyof (typeof DEFAULT_CHART)['S']] ?? '')}
                        value={chart[s.n]?.[f] ?? ''}
                        onChange={e => setChart(c => ({ ...c, [s.n]: { ...c[s.n], [f]: e.target.value } }))} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card stack">
        <h2>توضیحات (اختیاری)</h2>
        <div className="grid">
          {(['fa', 'ar', 'en'] as const).map(l => (
            <label key={l} className="f">توضیح {LANG_LABEL[l]}
              <textarea value={description[l]} dir={l === 'en' ? 'ltr' : 'rtl'} maxLength={600} onChange={e => setDescription({ ...description, [l]: e.target.value })} />
            </label>
          ))}
        </div>
      </section>

      <div className="row">
        <button type="button" className="btn" disabled={busy || !!uploading} onClick={save}>{busy ? 'در حال ذخیره…' : 'ذخیره'}</button>
        {initial && <button type="button" className="btn del" disabled={busy} onClick={remove}>حذف لباس</button>}
        <span className="msg err" role="alert">{msg}</span>
      </div>
    </div>
  );
}
