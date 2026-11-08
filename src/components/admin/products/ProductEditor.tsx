'use client';
/* Add or edit a product. Sections down the page (basics, photos, price, colours, sizes, size chart, texts) with a
   side panel that jumps between them, shows which are complete and previews the card the shop will show. A save bar
   stays at the bottom; leaving with unsaved changes asks first. */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { DEFAULT_CHART, DEFAULT_SIZES, ONE_SIZE } from '@/lib/defaults';
import { KIND_LABEL, SHAPE_LABEL } from '@/lib/labels';
import { CHART_FIELDS, PRODUCT_KINDS, SHAPES, type Category, type ChartField, type Colour, type Garment, type L10n, type ProductKind, type Shape, type Size } from '@/lib/types';
import { useUi } from '../ui/Dialog';
import { Dropdown } from '../ui/Dropdown';
import { Field, L10nField, PageHeader, Segmented, Switch } from '../ui/controls';
import { faDigits, faNum, faPct, intInput, numInput } from '../ui/format';
import { AIcon, type AIconName } from '../ui/Icon';
import { Reveal } from '../ui/motion';
import { useLeaveGuard } from '../ui/useLeaveGuard';
import { api } from '../api';
import { Gallery, Slot } from './Media';
import { KIND_ICON } from './ProductsPage';

const FIELD_LABEL: Record<ChartField, string> = { bust: 'دور سینه', waist: 'دور کمر', hips: 'دور باسن', length: 'قد لباس', sleeve: 'آستین' };
const empty = (): L10n => ({ en: '', ar: '', fa: '' });
const filled = (t: L10n) => !!(t.fa || t.en || t.ar);
const rk = () => Math.random().toString(36).slice(2, 9);

export function ProductEditor({ initial, categories, defaultKind, currency }: { initial: Garment | null; categories: Category[]; defaultKind: ProductKind; currency: string }) {
  const router = useRouter();
  const { toast, confirm } = useUi();
  const [start, setStart] = useState(() => ({
    kind: initial?.kind ?? defaultKind,
    name: initial?.name ?? empty(), type: initial?.type ?? empty(), description: initial?.description ?? empty(), fabric: initial?.fabric ?? empty(), note: initial?.note ?? empty(),
    categoryId: initial?.categoryId ?? categories[0]?.id ?? '',
    price: initial ? String(initial.price) : '', salePrice: initial?.salePrice != null ? String(initial.salePrice) : '', leadDays: String(initial?.leadDays ?? 0),
    visible: initial?.visible ?? true, isNew: initial?.isNew ?? !initial, shape: initial?.shape ?? 'abaya' as Shape,
    // Each colour and size row carries its own key (_k), so removing one animates and keeps state on the right row.
    colors: (initial?.colors ?? [{ name: empty(), hex: '#6F7258' }]).map(c => ({ ...c, _k: rk() })),
    sizes: (initial?.sizes ?? (defaultKind === 'garment' ? DEFAULT_SIZES : [ONE_SIZE]).map(n => ({ n, ok: true }))).map(z => ({ ...z, _k: rk() })),
    chart: Object.fromEntries(Object.entries(initial?.chart ?? {}).map(([n, row]) => [n, Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v)]))])) as Record<string, Record<string, string>>,
    front: initial?.front ?? '', back: initial?.back ?? '', detail: initial?.detail ?? '', wornFront: initial?.wornFront ?? '', wornBack: initial?.wornBack ?? '',
    images: initial?.images ?? [],
  }));
  const [v, setV] = useState(start);
  const [uploading, setUploading] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV(x => ({ ...x, [k]: val }));
  const dirty = JSON.stringify(v) !== JSON.stringify(start);
  const isGarment = v.kind === 'garment';
  const onBusy = (d: number) => setUploading(n => Math.max(0, n + d));
  const priceN = Number(v.price), saleN = v.salePrice.trim() === '' ? null : Number(v.salePrice);
  const discount = saleN !== null && priceN > 0 && saleN < priceN ? Math.round((1 - saleN / priceN) * 100) : null;
  const preview = v.wornFront || v.front || v.images[0];

  useLeaveGuard(dirty && !busy);

  async function save() {
    setBusy(true); setErrors({});
    const body = {
      kind: v.kind, name: v.name, type: v.type, description: v.description, fabric: v.fabric, note: v.note,
      categoryId: isGarment ? v.categoryId || null : null, price: v.price, salePrice: v.salePrice.trim() === '' ? null : v.salePrice,
      leadDays: v.leadDays, visible: v.visible, isNew: v.isNew, shape: v.shape, colors: v.colors, sizes: v.sizes.filter(s => s.n.trim()),
      chart: isGarment ? v.chart : null, front: v.front, back: v.back, detail: v.detail, wornFront: v.wornFront, wornBack: v.wornBack, images: v.images,
    };
    try {
      const saved = initial ? await api<Garment>(`/api/admin/garments/${initial.id}`, 'PUT', body) : await api<Garment>('/api/admin/garments', 'POST', body);
      toast('ok', initial ? 'تغییرات ذخیره شد' : 'محصول اضافه شد', saved.name.fa || saved.name.en);
      if (!initial) { router.replace(`/admin/garments/${saved.id}`); router.refresh(); return; }
      setStart(v);
      router.refresh();
    } catch (e) {
      const er = (e as Error & { errors?: Record<string, string> }).errors;
      if (er) {
        setErrors(er);
        const SECTION: Record<string, string> = { name: 'basics', price: 'price', salePrice: 'price', colors: 'colors', sizes: 'sizes' };
        document.getElementById(`sec-${SECTION[Object.keys(er)[0]] ?? 'basics'}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      toast('err', 'ذخیره نشد', (e as Error).message);
    } finally { setBusy(false); }
  }
  async function remove() {
    if (!initial || !(await confirm({ title: `حذف «${initial.name.fa || initial.name.en}»`, body: 'محصول از فروشگاه و پنل حذف می‌شود؛ سفارش‌های قبلی آن با نام و قیمت خودشان باقی می‌مانند. این کار برگشت‌پذیر نیست.', confirm: 'حذف محصول', danger: true }))) return;
    setBusy(true);
    try { await api(`/api/admin/garments/${initial.id}`, 'DELETE'); toast('ok', 'محصول حذف شد'); router.push('/admin/garments'); router.refresh(); }
    catch (e) { toast('err', 'حذف نشد', (e as Error).message); setBusy(false); }
  }
  const setSize = (i: number, p: Partial<Size>) => set('sizes', v.sizes.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const setColour = (i: number, p: Partial<Colour>) => set('colors', v.colors.map((c, j) => (j === i ? { ...c, ...p } : c)));

  const sections: { id: string; label: string; icon: AIconName; ok: boolean; bad?: boolean; show?: boolean }[] = [
    { id: 'basics', label: 'اطلاعات پایه', icon: 'info', ok: filled(v.name), bad: !!errors.name },
    { id: 'media', label: 'تصاویر', icon: 'images', ok: !!(v.front || v.wornFront || v.images.length) },
    { id: 'price', label: 'قیمت و نمایش', icon: 'tag', ok: priceN > 0, bad: !!(errors.price || errors.salePrice) },
    { id: 'colors', label: 'رنگ‌ها', icon: 'sparkle', ok: v.colors.length > 0, bad: !!errors.colors },
    { id: 'sizes', label: 'سایزها', icon: 'checklist', ok: v.sizes.some(s => s.n), bad: !!errors.sizes },
    { id: 'chart', label: 'جدول سایز', icon: 'columns', ok: Object.keys(v.chart).length > 0, show: isGarment },
    { id: 'texts', label: 'توضیحات', icon: 'note', ok: filled(v.description) },
  ];
  const Sec = ({ id, title, sub, icon, children }: { id: string; title: string; sub?: string; icon: AIconName; children: React.ReactNode }) => (
    <Reveal className="card stack" id={`sec-${id}`} style={{ scrollMarginTop: 104 }}>
      <div className="card-head" style={{ margin: 0 }}>
        <span className="tile sm soft"><AIcon name={icon} duo /></span>
        <div className="titles"><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
      </div>
      {children}
    </Reveal>
  );

  return (
    <>
      <PageHeader icon="products" title={initial ? initial.name.fa || initial.name.en : 'محصول جدید'} crumbs={[{ label: 'محصولات', href: '/admin/garments' }, { label: initial ? 'ویرایش' : 'محصول جدید' }]}
        sub={initial ? `${KIND_LABEL[initial.kind]} · ${initial.visible ? 'در فروشگاه' : 'پنهان'}` : 'نام، تصاویر، قیمت، رنگ و سایز را وارد کنید.'}>
        {initial && <a className="btn outline" href={`/abaya/${initial.id}`} target="_blank" rel="noreferrer"><AIcon name="external" />دیدن در فروشگاه</a>}
      </PageHeader>

      <div className="editor">
        <div className="stack">
          {Sec({ id: 'basics', title: 'اطلاعات پایه', icon: 'info', sub: 'نوع، نام و جای محصول در فروشگاه', children: <>
            <div className="field">
              <span className="lbl">نوع محصول</span>
              <div className="kind-seg"><Segmented label="نوع محصول" value={v.kind} onChange={k => setV(x => ({ ...x, kind: k, sizes: k === 'garment' && x.sizes.length === 1 && x.sizes[0].n === ONE_SIZE ? DEFAULT_SIZES.map(n => ({ n, ok: true, _k: rk() })) : k !== 'garment' && x.kind === 'garment' ? [{ n: ONE_SIZE, ok: true, _k: rk() }] : x.sizes }))}
                options={PRODUCT_KINDS.map(k => ({ value: k, label: KIND_LABEL[k], icon: KIND_ICON[k] }))} /></div>
              {!isGarment && <span className="help">اکسسوری‌ها روی رگال نمی‌آیند؛ استایلیست هوشمند آن‌ها را کنار لباس‌ها پیشنهاد می‌دهد.</span>}
            </div>
            <L10nField label="نام محصول" value={v.name} onChange={x => set('name', x)} max={120} error={errors.name} />
            <L10nField label={isGarment ? 'زیرعنوان (مثل «عبای ساتن زیتونی»)' : 'زیرعنوان'} value={v.type} onChange={x => set('type', x)} max={120} />
            {isGarment && (
              <div className="form-grid">
                <Field label="مجموعه">{(id, d) => <Dropdown id={id} describedBy={d} value={v.categoryId} onChange={x => set('categoryId', x)} options={[{ value: '', label: 'بدون مجموعه' }, ...categories.map(c => ({ value: c.id, label: c.name.fa || c.name.en }))]} />}</Field>
                <Field label="فرم طرح" help="تا وقتی عکس نیست، سایت این طرح را رنگی نشان می‌دهد">{(id, d) => <Dropdown id={id} describedBy={d} value={v.shape} onChange={x => set('shape', x)} options={SHAPES.map(s => ({ value: s, label: SHAPE_LABEL[s] }))} />}</Field>
              </div>
            )}
          </> })}

          {Sec({ id: 'media', title: 'تصاویر', icon: 'images', sub: isGarment ? 'عکس بدون پس‌زمینه برای رگال (PNG یا WebP شفاف، نسبت ۲ به ۳) و عکس تن مدل برای کارت‌ها' : 'عکس مربعی یا نزدیک به مربع', children: <>
            <div className="slots">
              <Slot label={isGarment ? 'جلوی لباس (رگال)' : 'عکس اصلی'} hint="رها کنید یا بزنید" value={v.front} onChange={x => set('front', x)} onBusy={onBusy} />
              <Slot label={isGarment ? 'پشت لباس (رگال)' : 'عکس دوم'} hint="خالی = همان عکس رو" value={v.back} onChange={x => set('back', x)} onBusy={onBusy} />
              {isGarment && <Slot label="تن مدل — جلو" hint="برای کارت‌ها و صفحهٔ محصول" value={v.wornFront} onChange={x => set('wornFront', x)} onBusy={onBusy} cover />}
              {isGarment && <Slot label="تن مدل — پشت" hint="خالی = عکس پشت رگال" value={v.wornBack} onChange={x => set('wornBack', x)} onBusy={onBusy} cover />}
              {isGarment && <Slot label="جزئیات پارچه" hint="نمای نزدیک دوخت" value={v.detail} onChange={x => set('detail', x)} onBusy={onBusy} cover />}
            </div>
            <div className="stack-sm">
              <h3>گالری</h3>
              <p className="xs muted">عکس‌های بیشتر از همین محصول (دوخت، جزئیات، استایل‌های دیگر). در صفحهٔ محصول فروشگاه، بعد از عکس‌های بالا و به همین ترتیب نشان داده می‌شوند.</p>
            </div>
            <Gallery images={v.images} onChange={x => set('images', x)} onBusy={onBusy} />
          </> })}

          {Sec({ id: 'price', title: 'قیمت و نمایش', icon: 'tag', sub: currency, children: <>
            <div className="form-grid">
              <Field label={`قیمت (${currency})`} error={errors.price}>{(id, d, bad) => <input id={id} className="input num" inputMode="decimal" aria-describedby={d} aria-invalid={bad || undefined} value={faDigits(v.price)} onChange={e => set('price', numInput(e.target.value))} />}</Field>
              <Field label={`قیمت حراج (${currency})`} help={discount !== null ? `${faPct(discount)} تخفیف` : 'خالی = بدون تخفیف'} error={errors.salePrice}>{(id, d, bad) => <input id={id} className="input num" inputMode="decimal" aria-describedby={d} aria-invalid={bad || undefined} value={faDigits(v.salePrice)} onChange={e => set('salePrice', numInput(e.target.value))} />}</Field>
              <Field label="روزهای آماده‌سازی اضافه" help="روی روزهای آماده‌سازی کل فروشگاه اضافه می‌شود">{(id, d) => <input id={id} className="input num" inputMode="numeric" aria-describedby={d} value={faDigits(v.leadDays)} onChange={e => set('leadDays', intInput(e.target.value).slice(0, 3))} />}</Field>
            </div>
            <div className="row" style={{ gap: 24 }}>
              <Switch label="در فروشگاه نمایش داده شود" hint={v.visible ? 'مشتری‌ها می‌بینند و سفارش می‌دهند' : 'فقط در پنل دیده می‌شود'} checked={v.visible} onChange={x => set('visible', x)} />
              {isGarment && <Switch label="برچسب «جدید»" hint="روی رگال و کارت‌ها" checked={v.isNew} onChange={x => set('isNew', x)} />}
            </div>
          </> })}

          {Sec({ id: 'colors', title: 'رنگ‌ها', icon: 'sparkle', sub: 'تا ۸ رنگ؛ اولین رنگ رنگ اصلی محصول است', children: <>
            <div className="colors">
              <AnimatePresence initial={false}>
                {v.colors.map((c, i) => (
                  <motion.div key={c._k} layout className="color-row" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
                    <label className="color-pick" style={{ background: c.hex }} title="انتخاب رنگ">
                      <span className="sr-only">رنگ {faNum(i + 1)}</span>
                      <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : '#6F7258'} onChange={e => setColour(i, { hex: e.target.value.toUpperCase() })} />
                    </label>
                    <L10nField label={`نام رنگ ${faNum(i + 1)}`} value={c.name} onChange={name => setColour(i, { name })} max={40} />
                    <button type="button" className="icon-btn" aria-label={`حذف رنگ ${faNum(i + 1)}`} disabled={v.colors.length < 2} onClick={() => set('colors', v.colors.filter((_, j) => j !== i))}><AIcon name="trash" /></button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {errors.colors && <span className="err"><AIcon name="warning" />{errors.colors}</span>}
            <button type="button" className="btn outline sm" style={{ alignSelf: 'flex-start' }} disabled={v.colors.length >= 8} onClick={() => set('colors', [...v.colors, { name: empty(), hex: '#D6C7B1', _k: rk() }])}><AIcon name="plus" />افزودن رنگ</button>
          </> })}

          {Sec({ id: 'sizes', title: 'سایزها و موجودی', icon: 'checklist', sub: 'روی برچسب «موجود» بزنید تا سایز تمام‌شده علامت بخورد', children: <>
            <div className="size-chips">
              <AnimatePresence initial={false}>
                {v.sizes.map((s, i) => (
                  <motion.span key={s._k} layout className={`size-chip${s.ok ? '' : ' off'}`} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                    <input aria-label={`نام سایز ${faNum(i + 1)}`} value={s.n} maxLength={12} onChange={e => setSize(i, { n: e.target.value.toUpperCase() })} />
                    <button type="button" className="tg" aria-pressed={s.ok} onClick={() => setSize(i, { ok: !s.ok })}>{s.ok ? 'موجود' : 'تمام شده'}</button>
                    <button type="button" className="icon-btn sm" aria-label={`حذف سایز ${s.n}`} onClick={() => set('sizes', v.sizes.filter((_, j) => j !== i))}><AIcon name="close" /></button>
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
            {errors.sizes && <span className="err"><AIcon name="warning" />{errors.sizes}</span>}
            <div className="row">
              <button type="button" className="btn outline sm" disabled={v.sizes.length >= 12} onClick={() => set('sizes', [...v.sizes, { n: '', ok: true, _k: rk() }])}><AIcon name="plus" />افزودن سایز</button>
              {isGarment && <button type="button" className="btn ghost sm" onClick={() => set('sizes', ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(n => v.sizes.find(s => s.n === n) ?? { n, ok: true, _k: rk() }))}>سایزهای استاندارد XS تا XXL</button>}
            </div>
          </> })}

          {isGarment && Sec({ id: 'chart', title: 'جدول سایز (سانتی‌متر)', icon: 'columns', sub: 'خانه‌های خالی از جدول پیش‌فرض پر می‌شوند (کم‌رنگ). در «سایز من چیست؟» سایت دیده می‌شود.', children: (
            <table className="chart-grid">
              <thead><tr><th>سایز</th>{CHART_FIELDS.map(f => <th key={f}>{FIELD_LABEL[f]}</th>)}</tr></thead>
              <tbody>
                {v.sizes.filter(s => s.n).map(s => (
                  <tr key={s.n}>
                    <td className="ltr">{s.n}</td>
                    {CHART_FIELDS.map(f => (
                      <td key={f}>
                        <input className="input num" inputMode="decimal" aria-label={`${FIELD_LABEL[f]} سایز ${s.n}`} placeholder={faDigits(String((DEFAULT_CHART[s.n] as Record<string, number> | undefined)?.[f] ?? ''))}
                          value={faDigits(v.chart[s.n]?.[f] ?? '')} onChange={e => set('chart', { ...v.chart, [s.n]: { ...v.chart[s.n], [f]: numInput(e.target.value) } })} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) })}

          {Sec({ id: 'texts', title: 'توضیحات', icon: 'note', sub: 'در صفحهٔ محصول و کشوی جزئیات فروشگاه', children: <>
            <L10nField label="توضیحات" value={v.description} onChange={x => set('description', x)} multiline max={800} />
            <L10nField label="پارچه و نگهداری" value={v.fabric} onChange={x => set('fabric', x)} multiline max={300} />
            {!isGarment && <L10nField label="یادداشت استایلیست (چرا با لباس جور است)" value={v.note} onChange={x => set('note', x)} multiline max={300} />}
          </> })}

          <div className="savebar">
            <span className={`state${dirty ? '' : ' clean'}`}><i aria-hidden="true" />{uploading ? `در حال بارگذاری ${faNum(uploading)} تصویر…` : dirty ? 'تغییرات ذخیره نشده' : 'همه چیز ذخیره شده'}</span>
            {dirty && <button type="button" className="btn ghost" onClick={() => setV(start)} disabled={busy}>بازگرداندن</button>}
            <button type="button" className="btn" onClick={save} disabled={busy || uploading > 0 || (!dirty && !!initial)}>
              {busy ? <><AIcon name="spinner" className="spin" />در حال ذخیره…</> : <><AIcon name="check" />{initial ? 'ذخیرهٔ تغییرات' : 'افزودن محصول'}</>}
            </button>
          </div>
        </div>

        <aside className="aside">
          <div className="card nav-card">
            <h3 style={{ marginBlockEnd: 8 }}>بخش‌ها</h3>
            <nav className="section-nav" aria-label="بخش‌های فرم">
              {sections.filter(s => s.show !== false).map(s => (
                <a key={s.id} href={`#sec-${s.id}`}><AIcon name={s.icon} /><span>{s.label}</span><i className={s.bad ? 'bad' : s.ok ? 'ok' : ''} aria-label={s.bad ? 'خطا' : s.ok ? 'کامل' : 'ناقص'} /></a>
              ))}
            </nav>
          </div>
          <div className="card stack-sm">
            <h3>پیش‌نمایش کارت</h3>
            <motion.div className="preview-card" layout>
              <div className="ph" style={{ background: v.colors[0]?.hex ?? 'var(--muted)' }}>
                <AnimatePresence mode="wait">
                  {preview ? <motion.img key={preview} src={preview} alt="" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
                    : <motion.span key="none" style={{ color: '#fff', fontSize: 48 }} initial={{ opacity: 0 }} animate={{ opacity: 0.8 }}><AIcon name={KIND_ICON[v.kind]} duo /></motion.span>}
                </AnimatePresence>
                {v.isNew && isGarment && <span className="chip gold badge-new" style={{ background: 'var(--card)' }}>جدید</span>}
              </div>
              <div className="txt">
                <b>{v.name.fa || v.name.en || 'نام محصول'}</b>
                <span className="xs muted">{v.type.fa || v.type.en || KIND_LABEL[v.kind]}</span>
                <span className="row" style={{ gap: 8 }}>
                  <b className="num">{faNum(saleN ?? (priceN || 0))} {currency}</b>
                  {discount !== null && <s className="xs muted num">{faNum(priceN)}</s>}
                </span>
              </div>
            </motion.div>
            {!v.visible && <span className="chip neutral" style={{ alignSelf: 'flex-start' }}><AIcon name="eyeOff" />پنهان از فروشگاه</span>}
          </div>
          {initial && (
            <div className="card stack-sm">
              <h3>حذف محصول</h3>
              <p className="xs muted">به‌جای حذف می‌توانید محصول را پنهان کنید.</p>
              <button type="button" className="btn danger sm" style={{ alignSelf: 'flex-start' }} onClick={remove} disabled={busy}><AIcon name="trash" />حذف محصول</button>
            </div>
          )}
          <Link className="btn ghost" href="/admin/garments"><AIcon name="back" />بازگشت به محصولات</Link>
        </aside>
      </div>
    </>
  );
}
