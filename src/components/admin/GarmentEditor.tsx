'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DEFAULT_CHART, DEFAULT_SIZES, ONE_SIZE } from '@/lib/defaults';
import { KIND_LABEL, SHAPE_LABEL } from '@/lib/labels';
import { CHART_FIELDS, PRODUCT_KINDS, SHAPES, type Category, type ChartField, type Colour, type Garment, type ProductKind, type Shape, type Size } from '@/lib/types';
import { api } from './api';
import { emptyL10n, ImageField, L10nFields } from './fields';

const FIELD_LABEL: Record<ChartField, string> = { bust: 'دور سینه', waist: 'دور کمر', hips: 'دور باسن', length: 'قد لباس', sleeve: 'آستین' };

export function GarmentEditor({ initial, categories, defaultKind }: { initial: Garment | null; categories: Category[]; defaultKind: ProductKind }) {
  const router = useRouter();
  const [kind, setKind] = useState<ProductKind>(initial?.kind ?? defaultKind);
  const isGarment = kind === 'garment';
  const [name, setName] = useState(initial?.name ?? emptyL10n());
  const [type, setType] = useState(initial?.type ?? emptyL10n());
  const [description, setDescription] = useState(initial?.description ?? emptyL10n());
  const [fabric, setFabric] = useState(initial?.fabric ?? emptyL10n());
  const [note, setNote] = useState(initial?.note ?? emptyL10n());
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? '');
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [salePrice, setSalePrice] = useState(initial?.salePrice != null ? String(initial.salePrice) : '');
  const [leadDays, setLeadDays] = useState(String(initial?.leadDays ?? 0));
  const [visible, setVisible] = useState(initial?.visible ?? true);
  const [isNew, setIsNew] = useState(initial?.isNew ?? false);
  const [shape, setShape] = useState<Shape>(initial?.shape ?? 'abaya');
  const [colors, setColors] = useState<Colour[]>(initial?.colors ?? [{ name: emptyL10n(), hex: '#6F7258' }]);
  const [sizes, setSizes] = useState<Size[]>(initial?.sizes ?? (defaultKind === 'garment' ? DEFAULT_SIZES : [ONE_SIZE]).map(n => ({ n, ok: true })));
  const [chart, setChart] = useState<Record<string, Record<string, string>>>(() => {
    const c: Record<string, Record<string, string>> = {};
    for (const [n, row] of Object.entries(initial?.chart ?? {})) c[n] = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v)]));
    return c;
  });
  const [images, setImages] = useState({ front: initial?.front ?? '', back: initial?.back ?? '', detail: initial?.detail ?? '' });
  const [uploading, setUploading] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const listHref = `/admin/garments${isGarment ? '' : '?kind=accessory'}`;

  function setSize(i: number, patch: Partial<Size>) { setSizes(list => list.map((s, j) => (j === i ? { ...s, ...patch } : s))); }
  function setColour(i: number, patch: Partial<Colour>) { setColors(list => list.map((c, j) => (j === i ? { ...c, ...patch } : c))); }

  async function save() {
    setBusy(true); setMsg(''); setErrors({});
    const body = {
      kind, name, type, description, fabric, note, categoryId: isGarment ? categoryId || null : null, price,
      salePrice: salePrice.trim() === '' ? null : salePrice, leadDays, visible, isNew, shape, colors, sizes,
      chart: isGarment ? chart : null, front: images.front, back: images.back, detail: images.detail,
    };
    try {
      if (initial) await api(`/api/admin/garments/${initial.id}`, 'PUT', body);
      else await api('/api/admin/garments', 'POST', body);
      router.push(listHref);
      router.refresh();
    } catch (e) {
      const er = (e as Error & { errors?: Record<string, string> }).errors;
      if (er) setErrors(er);
      setMsg((e as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!initial || !confirm(`«${initial.name.fa || initial.name.en}» حذف شود؟ سفارش‌های قبلی آن باقی می‌مانند.`)) return;
    setBusy(true);
    try { await api(`/api/admin/garments/${initial.id}`, 'DELETE'); router.push(listHref); router.refresh(); }
    catch (e) { setMsg((e as Error).message); setBusy(false); }
  }

  const err = (k: string) => errors[k] && <span className="err">{errors[k]}</span>;
  const onBusy = (b: boolean) => setUploading(n => n + (b ? 1 : -1));

  return (
    <div className="stack">
      <div className="top">
        <h1>{initial ? 'ویرایش محصول' : 'محصول جدید'}</h1>
        <Link className="btn alt" href={listHref}>بازگشت به فهرست</Link>
      </div>

      <section className="card stack">
        <h2>نوع و قیمت</h2>
        <div className="grid">
          <label className="f">نوع محصول
            <select value={kind} onChange={e => setKind(e.target.value as ProductKind)}>
              {PRODUCT_KINDS.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </label>
          {isGarment && (
            <label className="f">مجموعه
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                <option value="">بدون مجموعه</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name.fa || c.name.en}</option>)}
              </select>
            </label>
          )}
          <label className="f">قیمت<input type="number" min={0} step="0.001" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} />{err('price')}</label>
          <label className="f">قیمت با تخفیف (خالی = بدون تخفیف)<input type="number" min={0} step="0.001" inputMode="decimal" value={salePrice} onChange={e => setSalePrice(e.target.value)} />{err('salePrice')}</label>
          <label className="f">روزهای آماده‌سازی اضافه<input type="number" min={0} max={365} value={leadDays} onChange={e => setLeadDays(e.target.value)} /></label>
          {isGarment && (
            <label className="f">فرم طرح (تا وقتی عکس نیست)
              <select value={shape} onChange={e => setShape(e.target.value as Shape)}>{SHAPES.map(s => <option key={s} value={s}>{SHAPE_LABEL[s]}</option>)}</select>
            </label>
          )}
        </div>
        <div className="row">
          <label className="check"><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} /> در سایت نمایش داده شود</label>
          {isGarment && <label className="check"><input type="checkbox" checked={isNew} onChange={e => setIsNew(e.target.checked)} /> برچسب «جدید»</label>}
        </div>
        {!isGarment && <p className="muted small" style={{ margin: 0 }}>اکسسوری‌ها روی رگال نمی‌آیند؛ استایلیست هوشمند آن‌ها را کنار لباس‌ها پیشنهاد می‌دهد. ترتیب فهرست مهم است: اولین مورد هر نوع برای روز و دومی برای شب انتخاب می‌شود (وقتی هوش مصنوعی وصل نیست).</p>}
      </section>

      <section className="card stack">
        <h2>متن‌ها</h2>
        <L10nFields label="نام" value={name} onChange={setName} max={120} error={errors.name} />
        <L10nFields label={isGarment ? 'نوع لباس (زیر نام، مثل «عبای ساتن زیتونی»)' : 'زیرعنوان'} value={type} onChange={setType} max={120} />
        <L10nFields label="توضیحات" value={description} onChange={setDescription} multiline max={800} />
        <L10nFields label="پارچه و نگهداری" value={fabric} onChange={setFabric} multiline max={300} />
        {!isGarment && <L10nFields label="یادداشت استایلیست (چرا با لباس جور است)" value={note} onChange={setNote} multiline max={300} />}
      </section>

      <section className="card stack">
        <h2>تصاویر</h2>
        <p className="muted small" style={{ margin: 0 }}>{isGarment ? 'برای رگال، عکس بدون پس‌زمینه (PNG یا WebP شفاف) با نسبت ۲ به ۳ بهترین است. تا وقتی عکس روی لباس نیست، سایت طرح رنگی لباس را نشان می‌دهد.' : 'عکس مربعی یا نزدیک به مربع.'}</p>
        <div className="imgs" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
          <ImageField label="روی لباس" value={images.front} onChange={front => setImages(i => ({ ...i, front }))} onBusy={onBusy} />
          <ImageField label="پشت لباس" hint="خالی = عکس رو" value={images.back} onChange={back => setImages(i => ({ ...i, back }))} onBusy={onBusy} />
          {isGarment && <ImageField label="جزئیات پارچه" value={images.detail} onChange={detail => setImages(i => ({ ...i, detail }))} onBusy={onBusy} />}
        </div>
      </section>

      <section className="card stack">
        <h2>رنگ‌ها</h2>
        {colors.map((c, i) => (
          <div key={i} className="row" style={{ alignItems: 'flex-end' }}>
            <label className="f">رنگ<input type="color" value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : '#6F7258'} onChange={e => setColour(i, { hex: e.target.value.toUpperCase() })} style={{ width: 56, height: 40, padding: 2 }} /></label>
            {(['fa', 'ar', 'en'] as const).map(l => (
              <label key={l} className="f" style={{ flex: '1 1 120px' }}>نام رنگ ({{ fa: 'فارسی', ar: 'عربی', en: 'انگلیسی' }[l]})
                <input value={c.name[l]} dir={l === 'en' ? 'ltr' : 'rtl'} maxLength={40} onChange={e => setColour(i, { name: { ...c.name, [l]: e.target.value } })} />
              </label>
            ))}
            <button type="button" className="icon-btn" aria-label="حذف رنگ" disabled={colors.length < 2} onClick={() => setColors(list => list.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <div className="row"><button type="button" className="btn alt sm" disabled={colors.length >= 8} onClick={() => setColors(list => [...list, { name: emptyL10n(), hex: '#D6C7B1' }])}>+ رنگ</button>{err('colors')}</div>
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

      {isGarment && (
        <section className="card stack">
          <h2>جدول سایز (سانتی‌متر)</h2>
          <p className="muted small" style={{ margin: 0 }}>خانه‌های خالی از جدول پیش‌فرض پر می‌شوند (کم‌رنگ نشان داده شده). این جدول در «سایز من چیست؟» سایت دیده می‌شود.</p>
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
                          placeholder={String((DEFAULT_CHART[s.n] as Record<string, number> | undefined)?.[f] ?? '')}
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
      )}

      <div className="row">
        <button type="button" className="btn" disabled={busy || uploading > 0} onClick={save}>{busy ? 'در حال ذخیره…' : 'ذخیره'}</button>
        {initial && <button type="button" className="btn del" disabled={busy} onClick={remove}>حذف محصول</button>}
        <span className="msg err" role="alert">{msg}</span>
      </div>
    </div>
  );
}
