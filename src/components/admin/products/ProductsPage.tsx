'use client';
/* Products: garments for the rack and accessories for the stylist. A table or a picture grid, filters for kind,
   collection and state, a show/hide switch on every row, and a "display order" mode to drag pieces into the order the
   shop shows them. */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, Reorder } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import { effectivePrice } from '@/lib/fit';
import { KIND_LABEL } from '@/lib/labels';
import { PRODUCT_KINDS, type Category, type Garment, type ProductKind } from '@/lib/types';
import { DataTable, Pagination, type Column } from '../ui/DataTable';
import { useUi } from '../ui/Dialog';
import { Dropdown } from '../ui/Dropdown';
import { FilterBar } from '../ui/FilterBar';
import { Empty, PageHeader, SearchInput, Segmented, Switch } from '../ui/controls';
import { faNum, faPct, searchable } from '../ui/format';
import { AIcon, type AIconName } from '../ui/Icon';
import { item, Stagger } from '../ui/motion';
import { useMedia } from '../ui/useMedia';
import { api } from '../api';

type Kind = 'all' | ProductKind;
type State = 'all' | 'visible' | 'hidden' | 'sale' | 'new' | 'out';
export const KIND_ICON: Record<ProductKind, AIconName> = { garment: 'dress', scarf: 'tag', bag: 'handbag', jewel: 'jewel', shoes: 'shoes' };
const bodyOf = (g: Garment) => { const { id: _i, createdAt: _c, sort: _s, ...rest } = g; return rest; };

export function ProductsPage({ initial, categories, sold, currency, initialKind, initialState, initialCat = 'all' }: {
  initial: Garment[]; categories: Category[]; sold: Record<string, number>; currency: string; initialKind: Kind; initialState: State; initialCat?: string;
}) {
  const router = useRouter();
  const { toast } = useUi();
  const wide = useMedia('(min-width: 1100px)');
  const [items, setItems] = useState(initial);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<Kind>(initialKind);
  const [cat, setCat] = useState(initialCat);
  const [state, setState] = useState<State>(initialState);
  const [view, setView] = useState<'table' | 'grid' | 'order'>('table');
  const [orderGroup, setOrderGroup] = useState<'garment' | 'accessory'>('garment');
  const [gridPage, setGridPage] = useState(1);
  const money = (n: number) => `${faNum(n)} ${currency}`;
  const catName = (g: Garment) => (g.kind !== 'garment' ? KIND_LABEL[g.kind] : g.categoryId ? categories.find(c => c.id === g.categoryId)?.name.fa ?? '—' : 'بدون مجموعه');
  const img = (g: Garment) => g.wornFront || g.front || g.images[0] || '';

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    PRODUCT_KINDS.forEach(k => { c[k] = items.filter(g => g.kind === k).length; });
    return c;
  }, [items]);
  const rows = useMemo(() => {
    const s = searchable(q);
    return items.filter(g => (kind === 'all' || g.kind === kind) && (cat === 'all' || g.categoryId === cat)
      && (state === 'all' || (state === 'visible' ? g.visible : state === 'hidden' ? !g.visible : state === 'sale' ? g.salePrice !== null : state === 'new' ? g.isNew : g.sizes.some(x => !x.ok)))
      && (!s || [g.name.fa, g.name.en, g.name.ar, g.type.fa, g.type.en].some(t => searchable(t).includes(s))));
  }, [items, q, kind, cat, state]);
  const filtered = q || kind !== 'all' || cat !== 'all' || state !== 'all';
  const clear = () => { setQ(''); setKind('all'); setCat('all'); setState('all'); };

  async function toggle(g: Garment) {
    setItems(list => list.map(x => (x.id === g.id ? { ...x, visible: !g.visible } : x)));
    try {
      const saved = await api<Garment>(`/api/admin/garments/${g.id}`, 'PUT', { ...bodyOf(g), visible: !g.visible });
      setItems(list => list.map(x => (x.id === g.id ? saved : x)));
      toast('ok', saved.visible ? 'در فروشگاه نمایش داده می‌شود' : 'از فروشگاه پنهان شد', saved.name.fa || saved.name.en);
      router.refresh();
    } catch (e) {
      setItems(list => list.map(x => (x.id === g.id ? g : x)));
      toast('err', 'تغییر ذخیره نشد', (e as Error).message);
    }
  }

  const group = items.filter(g => (orderGroup === 'garment') === (g.kind === 'garment'));
  const setGroup = (next: Garment[]) => setItems(list => [...next, ...list.filter(g => (orderGroup === 'garment') !== (g.kind === 'garment'))]);
  const [orderError, setOrderError] = useState('');
  /** Saves the shown order; on failure puts the previous one back. */
  async function commitOrder(next: Garment[], prev: Garment[]) {
    setOrderError('');
    try { await api('/api/admin/garments/reorder', 'PUT', next.map(g => g.id)); toast('ok', 'ترتیب ذخیره شد'); router.refresh(); }
    catch (e) { setGroup(prev); setOrderError((e as Error).message); }
  }
  const dragStart = useRef<Garment[]>([]);
  const move = (id: string, to: number) => {
    const from = group.findIndex(g => g.id === id);
    if (from < 0 || to < 0 || to >= group.length) return;
    const next = group.slice();
    next.splice(to, 0, next.splice(from, 1)[0]);
    setGroup(next);
    void commitOrder(next, group);
  };

  const price = (g: Garment) => (
    <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.4 }}>
      <b className="num">{money(effectivePrice(g))}</b>
      {g.salePrice !== null && <span className="xs muted"><s className="num">{money(g.price)}</s> <span style={{ color: 'var(--danger-ink)' }}>−{faPct(Math.round((1 - g.salePrice / g.price) * 100))}</span></span>}
    </span>
  );
  const sizes = (g: Garment) => <span className="mini-sizes">{g.sizes.map(s => <span key={s.n} className={s.ok ? '' : 'off'} title={s.ok ? 'موجود' : 'تمام شده'}>{s.n === 'ONE' ? 'تک' : s.n}</span>)}</span>;
  const cols: Column<Garment>[] = [
    { key: 'name', header: 'محصول', minWidth: 250, card: 'title', sort: g => g.name.fa || g.name.en, render: g => (
      <span className="who">
        <span className="thumb" style={{ background: g.colors[0]?.hex ?? 'var(--muted)' }}>{img(g) ? <img src={img(g)} alt="" loading="lazy" /> : <AIcon name={KIND_ICON[g.kind]} duo />}</span>
        <span className="meta">
          <Link href={`/admin/garments/${g.id}`}>{g.name.fa || g.name.en}</Link>
          <span>{g.type.fa || g.type.en || KIND_LABEL[g.kind]}{g.images.length ? ` · ${faNum(g.images.length + [g.front, g.back, g.wornFront, g.wornBack, g.detail].filter(Boolean).length)} تصویر` : ''}</span>
        </span>
      </span>
    ) },
    { key: 'cat', header: 'مجموعه', minWidth: 120, width: 150, sort: g => catName(g), render: g => <span className="tag">{catName(g)}</span> },
    { key: 'price', header: 'قیمت', minWidth: 130, width: 150, sort: g => effectivePrice(g), render: price },
    { key: 'sizes', header: 'سایزها', minWidth: 150, width: 190, render: sizes },
    { key: 'sold', header: 'فروش', minWidth: 80, width: 80, optional: true, sort: g => sold[g.id] ?? 0, render: g => <span className="num">{faNum(sold[g.id] ?? 0)}</span> },
    { key: 'state', header: 'وضعیت', minWidth: 130, width: 150, card: 'status', render: g => (
      <span className="row" style={{ gap: 4 }}>
        {g.isNew && <span className="chip gold">جدید</span>}
        {!g.visible ? <span className="chip neutral"><AIcon name="eyeOff" />پنهان</span> : g.sizes.every(s => !s.ok) ? <span className="chip danger">ناموجود</span> : g.sizes.some(s => !s.ok) ? <span className="chip warn">سایز تمام‌شده</span> : null}
      </span>
    ) },
    { key: 'show', header: 'در فروشگاه', minWidth: 100, width: 100, card: 'field', render: g => <Switch label={g.visible ? 'نمایش' : 'پنهان'} checked={g.visible} onChange={() => toggle(g)} hideLabel /> },
  ];

  const stats = [
    { k: 'همهٔ محصولات', v: items.length, s: `${faNum(counts.garment ?? 0)} لباس · ${faNum(items.length - (counts.garment ?? 0))} اکسسوری`, icon: 'products' as const, tone: 1, on: clear },
    { k: 'در فروشگاه', v: items.filter(g => g.visible).length, s: `${faNum(items.filter(g => !g.visible).length)} پنهان`, icon: 'store' as const, tone: 2, on: () => { clear(); setState('visible'); } },
    { k: 'حراج', v: items.filter(g => g.salePrice !== null).length, s: 'با قیمت تخفیف‌خورده', icon: 'percent' as const, tone: 3, on: () => { clear(); setState('sale'); } },
    { k: 'سایز تمام‌شده', v: items.filter(g => g.sizes.some(s => !s.ok)).length, s: 'محصول با سایز ناموجود', icon: 'warning' as const, tone: 4, on: () => { clear(); setState('out'); } },
  ];
  const kindOptions = [{ value: 'all' as const, label: 'همه', count: counts.all }, ...PRODUCT_KINDS.map(k => ({ value: k, label: KIND_LABEL[k], count: counts[k] ?? 0 }))];
  const PER = 12;
  const gridRows = rows.slice((gridPage - 1) * PER, gridPage * PER);

  const flex = { flex: '0 1 200px', minWidth: 160 };
  const toolbar = <>
    {wide && <Segmented label="نوع محصول" value={kind} onChange={v => { setKind(v); setGridPage(1); }} options={kindOptions} />}
    <FilterBar active={(kind !== 'all' ? 1 : 0) + (cat !== 'all' ? 1 : 0) + (state !== 'all' ? 1 : 0)} results={rows.length} onClear={clear}
      search={<SearchInput value={q} onChange={v => { setQ(v); setGridPage(1); }} placeholder="نام یا نوع محصول…" />}
      filters={<>
    {!wide && <div style={flex}><Dropdown variant="pill" label="نوع" prefix="نوع" value={kind} onChange={v => { setKind(v as Kind); setGridPage(1); }} options={kindOptions.map(o => ({ value: o.value, label: o.label, hint: faNum(o.count) }))} /></div>}
    <div style={flex}>
      <Dropdown variant="pill" label="مجموعه" prefix="مجموعه" value={cat} onChange={v => { setCat(v); setGridPage(1); }} options={[{ value: 'all', label: 'همه' }, ...categories.map(c => ({ value: c.id, label: c.name.fa || c.name.en }))]} />
    </div>
    <div style={flex}>
      <Dropdown variant="pill" label="وضعیت" prefix="وضعیت" value={state} onChange={v => { setState(v as State); setGridPage(1); }} options={[
        { value: 'all', label: 'همه' }, { value: 'visible', label: 'در فروشگاه' }, { value: 'hidden', label: 'پنهان' }, { value: 'sale', label: 'حراج' }, { value: 'new', label: 'جدید' }, { value: 'out', label: 'سایز تمام‌شده' },
      ]} />
    </div>
      </>} />
  </>;
  const empty = filtered
    ? <Empty icon="search" title="محصولی با این فیلترها پیدا نشد" body={q ? `برای «${q}» نتیجه‌ای نیست.` : undefined} action={<button type="button" className="btn outline sm" onClick={clear}>پاک کردن فیلترها</button>} />
    : <Empty icon="products" title="هنوز محصولی اضافه نشده" action={<Link className="btn sm" href="/admin/garments/new"><AIcon name="plus" />افزودن محصول</Link>} />;

  return (
    <>
      <PageHeader icon="products" title="محصولات" crumbs={[{ label: 'کاتالوگ' }, { label: 'محصولات' }]} sub="لباس‌های رگال و اکسسوری‌هایی که استایلیست کنارشان پیشنهاد می‌دهد.">
        <Segmented label="نمایش" value={view} onChange={setView} options={[{ value: 'table', label: 'جدول', icon: 'rows' }, { value: 'grid', label: 'تصویری', icon: 'grid' }, { value: 'order', label: 'ترتیب', icon: 'sort' }]} />
        <Link className="btn" href="/admin/garments/new"><AIcon name="plus" />افزودن محصول</Link>
      </PageHeader>

      <Stagger className="grid-4">
        {stats.map(s => (
          <motion.button key={s.k} type="button" variants={item} className={`stat s${s.tone}`} onClick={s.on}>
            <span className="blob" aria-hidden="true" />
            <span className="orb"><AIcon name={s.icon} duo /></span>
            <span className="k">{s.k}</span><span className="v num">{faNum(s.v)}</span><span className="s">{s.s}</span>
          </motion.button>
        ))}
      </Stagger>

      <AnimatePresence mode="wait">
        {view === 'table' && (
          <motion.div key="table" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <DataTable label="فهرست محصولات" rows={rows} columns={cols} rowKey={g => g.id} resetKey={q + kind + cat + state} toolbar={toolbar} empty={empty}
              actions={g => <Link className="btn secondary sm" href={`/admin/garments/${g.id}`} aria-label={`ویرایش ${g.name.fa || g.name.en}`}><AIcon name="edit" /><span className="only-cards">ویرایش</span></Link>} />
          </motion.div>
        )}
        {view === 'grid' && (
          <motion.div key="grid" className="card flush" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <div className="toolbar">{toolbar}</div>
            {rows.length ? (
              <>
                <Stagger key={gridPage + q + kind + cat + state} className="product-grid">
                  {gridRows.map(g => (
                    <motion.article key={g.id} variants={item} className="pcard">
                      <div className="ph" style={{ background: g.colors[0]?.hex }}>
                        {img(g) ? <img src={img(g)} alt="" loading="lazy" /> : <span style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#fff', fontSize: 40 }}><AIcon name={KIND_ICON[g.kind]} duo /></span>}
                        <span className="chips">{g.isNew && <span className="chip gold">جدید</span>}{!g.visible && <span className="chip neutral">پنهان</span>}{g.salePrice !== null && <span className="chip danger">حراج</span>}</span>
                      </div>
                      <div className="body">
                        <Link href={`/admin/garments/${g.id}`}>{g.name.fa || g.name.en}</Link>
                        <span className="xs muted">{catName(g)}</span>
                        <span className="price"><b>{money(effectivePrice(g))}</b>{g.salePrice !== null && <s>{money(g.price)}</s>}</span>
                        {sizes(g)}
                      </div>
                    </motion.article>
                  ))}
                </Stagger>
                <div className="table-foot"><span className="xs muted">{faNum(rows.length)} محصول</span><Pagination page={gridPage} pages={Math.ceil(rows.length / PER)} onPage={setGridPage} /><span /></div>
              </>
            ) : empty}
          </motion.div>
        )}
        {view === 'order' && (
          <motion.div key="order" className="card flush" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <div className="toolbar">
              <div className="grow"><h2>ترتیب نمایش در فروشگاه</h2><p className="xs muted">{orderGroup === 'garment' ? 'ترتیب لباس‌ها روی رگال. بکشید و رها کنید یا با دکمه‌ها جابه‌جا کنید؛ همان لحظه ذخیره می‌شود.' : 'اولین اکسسوری هر نوع برای روز و دومی برای شب پیشنهاد می‌شود (وقتی هوش مصنوعی وصل نیست).'}</p></div>
              <Segmented label="گروه" value={orderGroup} onChange={setOrderGroup} options={[{ value: 'garment', label: 'لباس‌ها' }, { value: 'accessory', label: 'اکسسوری‌ها' }]} />
            </div>
            {orderError && <div className="alert danger" style={{ margin: '0 20px' }}><AIcon name="warning" /><div className="grow"><b>ترتیب ذخیره نشد</b><p>{orderError}</p></div></div>}
            <Reorder.Group axis="y" values={group} onReorder={setGroup} className="reorder-list">
              {group.map((g, i) => (
                <Reorder.Item key={g.id} value={g} transition={{ type: 'spring', stiffness: 420, damping: 34 }} whileDrag={{ scale: 1.02, boxShadow: 'var(--shadow-pop)', zIndex: 2 }}
                  onDragStart={() => { dragStart.current = group; }} onDragEnd={() => { void commitOrder(items.filter(x => (orderGroup === 'garment') === (x.kind === 'garment')), dragStart.current); }}>
                  <span className="grip" aria-hidden="true" title="بکشید"><AIcon name="grip" /></span>
                  <span className="num xs muted" style={{ width: 24 }}>{faNum(i + 1)}</span>
                  <span className="thumb" style={{ background: g.colors[0]?.hex }}>{img(g) && <img src={img(g)} alt="" draggable={false} />}</span>
                  <span className="grow"><b>{g.name.fa || g.name.en}</b><br /><span className="xs muted">{catName(g)}{!g.visible ? ' · پنهان' : ''}</span></span>
                  <button type="button" className="icon-btn sm" aria-label={`بالاتر: ${g.name.fa || g.name.en}`} disabled={i === 0} onClick={() => move(g.id, i - 1)}><AIcon name="up" /></button>
                  <button type="button" className="icon-btn sm" aria-label={`پایین‌تر: ${g.name.fa || g.name.en}`} disabled={i === group.length - 1} onClick={() => move(g.id, i + 1)}><AIcon name="down" /></button>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
