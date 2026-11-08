'use client';
/* One table component for every list in the panel. Both views come from one column config: a real table when the
   container is at least as wide as the visible columns' minimum widths, otherwise one card per row (label/value pairs,
   title and status on top, actions in a footer). Below 768px it is always cards, and cards are what renders on the
   server and before the first measurement, so a phone never sees a table flash. Nothing scrolls sideways.
   Sorting (headers in the table, a dropdown above the cards), page-sized pagination, optional row selection with a
   bulk-action bar, and column visibility in table view. Search and filters belong to the page (`toolbar`). */
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMedia } from './useMedia';
import { Checkbox } from './controls';
import { Dropdown, Menu } from './Dropdown';
import { faNum } from './format';
import { AIcon } from './Icon';

export interface Column<T> {
  key: string;
  header: string;
  /** Narrowest the column can be in table view, px. The sum decides table versus cards. */
  minWidth: number;
  render: (row: T) => ReactNode;
  /** Sort key; columns without one are not sortable. */
  sort?: (row: T) => string | number;
  /** Role in card view: the card title, the chip on the end side, a hidden column, or (default) a label/value row. */
  card?: 'title' | 'status' | 'hide' | 'field';
  align?: 'end' | 'center';
  /** Can be hidden from the columns menu (table view). */
  optional?: boolean;
  /** Fixed width for narrow columns (number, status). */
  width?: number;
}

type Sort = { key: string; dir: 'asc' | 'desc' } | null;
const COLLATOR = new Intl.Collator('fa', { numeric: true, sensitivity: 'base' });
const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function DataTable<T>({ rows, columns, rowKey, toolbar, empty, pageSize = 10, initialSort = null, selectable, selected, onSelect, bulk, actions, actionsWidth = 64, label, resetKey }: {
  rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; toolbar?: ReactNode; empty: ReactNode; pageSize?: number; initialSort?: Sort;
  selectable?: boolean; selected?: Set<string>; onSelect?: (s: Set<string>) => void; bulk?: ReactNode; actions?: (row: T) => ReactNode; label: string;
  /** Width of the actions column in table view (an icon button needs the default). */
  actionsWidth?: number;
  /** Changes when the filters change, to go back to page one. */
  resetKey?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [sort, setSort] = useState<Sort>(initialSort);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(pageSize);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  // Columns the reader hid stay hidden; if the rest still do not fit, optional columns drop out (last first) before the
  // list falls back to cards.
  const extra = (selectable ? 56 : 0) + (actions ? actionsWidth : 0) + 48;
  const needOf = (cols: Column<T>[]) => cols.reduce((a, c) => a + (c.width ?? c.minWidth), 0) + extra;
  let shownCols = columns.filter(c => !hidden.has(c.key));
  for (const c of [...shownCols].reverse()) {
    if (needOf(shownCols) <= width) break;
    if (c.optional) shownCols = shownCols.filter(x => x !== c);
  }
  // Phones always get cards; elsewhere the table is used whenever its columns fit the space it has.
  const phone = useMedia('(max-width: 767px)');
  const asTable = !phone && width > 0 && width >= needOf(shownCols);

  useIso(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { setPage(1); }, [resetKey, size]);
  // A selection made under other filters would act on rows no longer on screen: start again when the filters change.
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } if (selected?.size) onSelect?.(new Set()); }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const cols = useRef(columns);
  cols.current = columns;

  // Sorted again only when the rows or the sort change (the column list is a new array on every render).
  const sorted = useMemo(() => {
    const col = sort && cols.current.find(c => c.key === sort.key);
    if (!col?.sort) return rows;
    const get = col.sort, dir = sort!.dir === 'asc' ? 1 : -1;
    const keyed = rows.map(r => [get(r), r] as const);
    keyed.sort(([x], [y]) => (typeof x === 'number' && typeof y === 'number' ? x - y : COLLATOR.compare(String(x), String(y))) * dir);
    return keyed.map(([, r]) => r);
  }, [rows, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / size));
  const cur = Math.min(page, pages);
  const slice = sorted.slice((cur - 1) * size, cur * size);

  const sel = selected ?? new Set<string>();
  const pageKeys = slice.map(rowKey);
  const allOn = pageKeys.length > 0 && pageKeys.every(k => sel.has(k));
  const someOn = pageKeys.some(k => sel.has(k));
  const toggle = (k: string, on: boolean) => { const n = new Set(sel); if (on) n.add(k); else n.delete(k); onSelect?.(n); };
  const toggleAll = (on: boolean) => { const n = new Set(sel); pageKeys.forEach(k => (on ? n.add(k) : n.delete(k))); onSelect?.(n); };

  const sortable = columns.filter(c => c.sort);
  const sortOptions = sortable.flatMap(c => [
    { value: `${c.key}:desc`, label: `${c.header} — نزولی` },
    { value: `${c.key}:asc`, label: `${c.header} — صعودی` },
  ]);
  const clickSort = (key: string) => setSort(s => (s?.key === key ? (s.dir === 'desc' ? { key, dir: 'asc' } : null) : { key, dir: 'desc' }));
  const titleCol = columns.find(c => c.card === 'title') ?? columns[0];
  const statusCol = columns.find(c => c.card === 'status');
  const fieldCols = columns.filter(c => c !== titleCol && c !== statusCol && c.card !== 'hide');
  const optional = columns.filter(c => c.optional);
  const from = sorted.length ? (cur - 1) * size + 1 : 0, to = Math.min(cur * size, sorted.length);

  return (
    <div className="card flush" ref={wrap}>
      {(toolbar || (!asTable && sortable.length > 0) || (asTable && optional.length > 0)) && (
        <div className="toolbar">
          {toolbar}
          <div className="end">
            {!asTable && sortable.length > 0 && (
              <Dropdown variant="pill" label="مرتب‌سازی" icon="sort" placeholder="مرتب‌سازی" value={sort ? `${sort.key}:${sort.dir}` : ''} options={sortOptions}
                onChange={v => { const [key, dir] = v.split(':'); setSort({ key, dir: dir as 'asc' | 'desc' }); }} />
            )}
            {asTable && optional.length > 0 && (
              <Menu label="ستون‌ها" buttonClass="btn outline sm" items={optional.map(c => ({
                label: c.header, icon: hidden.has(c.key) ? 'eyeOff' : 'eye',
                onSelect: () => setHidden(h => { const n = new Set(h); if (n.has(c.key)) n.delete(c.key); else n.add(c.key); return n; }),
              }))}>
                <AIcon name="columns" /><span>ستون‌ها</span>
              </Menu>
            )}
          </div>
        </div>
      )}

      {selectable && !asTable && sorted.length > 0 && (
        <div style={{ padding: '0 16px' }}>
          <Checkbox checked={allOn} indeterminate={!allOn && someOn} onChange={toggleAll} label={`انتخاب همهٔ این صفحه (${faNum(pageKeys.length)})`} />
        </div>
      )}

      {!sorted.length ? empty : (
        <AnimatePresence mode="wait" initial={false}>
          {asTable ? (
            <motion.table key="t" className="dt" aria-label={label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <colgroup>
                {selectable && <col style={{ width: 56 }} />}
                {shownCols.map(c => <col key={c.key} style={c.width ? { width: c.width } : undefined} />)}
                {actions && <col style={{ width: actionsWidth }} />}
              </colgroup>
              <thead>
                <tr>
                  {selectable && <th className="cell-check"><Checkbox checked={allOn} indeterminate={!allOn && someOn} onChange={toggleAll} label="انتخاب همهٔ این صفحه" hideLabel /></th>}
                  {shownCols.map(c => (
                    <th key={c.key} scope="col" style={{ textAlign: c.align === 'end' ? 'end' : c.align === 'center' ? 'center' : 'start' }}
                      aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                      {c.sort ? (
                        <button type="button" onClick={() => clickSort(c.key)}>
                          {c.header}<AIcon name={sort?.key === c.key ? (sort.dir === 'asc' ? 'up' : 'down') : 'sort'} />
                        </button>
                      ) : c.header}
                    </th>
                  ))}
                  {actions && <th className="cell-go"><span className="sr-only">کارها</span></th>}
                </tr>
              </thead>
              <tbody>
                {slice.map((r, i) => {
                  const k = rowKey(r);
                  return (
                    <motion.tr key={`${cur}-${k}`} className={sel.has(k) ? 'sel' : undefined}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.025 }}>
                      {selectable && <td className="cell-check"><Checkbox checked={sel.has(k)} onChange={v => toggle(k, v)} label="انتخاب ردیف" hideLabel /></td>}
                      {shownCols.map(c => <td key={c.key} style={{ textAlign: c.align === 'end' ? 'end' : c.align === 'center' ? 'center' : 'start' }}>{c.render(r)}</td>)}
                      {actions && <td className="cell-go">{actions(r)}</td>}
                    </motion.tr>
                  );
                })}
              </tbody>
            </motion.table>
          ) : (
            <motion.ul key="c" className="cards" aria-label={label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              {slice.map((r, i) => {
                const k = rowKey(r);
                return (
                  <motion.li key={`${cur}-${k}`} className={`rcard${sel.has(k) ? ' sel' : ''}`}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: Math.min(i, 10) * 0.04 }}>
                    <div className="rcard-head">
                      {selectable && <Checkbox checked={sel.has(k)} onChange={v => toggle(k, v)} label="انتخاب" hideLabel />}
                      <div className="grow">{titleCol.render(r)}</div>
                      {statusCol && <div>{statusCol.render(r)}</div>}
                    </div>
                    {fieldCols.length > 0 && (
                      <dl>
                        {fieldCols.map(c => <div key={c.key} style={{ display: 'contents' }}><dt>{c.header}</dt><dd>{c.render(r)}</dd></div>)}
                      </dl>
                    )}
                    {actions && <div className="rcard-foot">{actions(r)}</div>}
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      )}

      {sorted.length > 0 && (
        <div className="table-foot">
          <span className="xs muted num">نمایش {faNum(from)} تا {faNum(to)} از {faNum(sorted.length)}</span>
          <Pagination page={cur} pages={pages} onPage={setPage} />
          <div style={{ width: 150 }}>
            <Dropdown variant="pill" label="تعداد در هر صفحه" value={String(size)} onChange={v => setSize(Number(v))}
              options={[...new Set([pageSize, 10, 20, 50])].sort((a, b) => a - b).map(n => ({ value: String(n), label: `${faNum(n)} در صفحه` }))} />
          </div>
        </div>
      )}
      {selectable && sel.size > 0 && bulk && (
        <motion.div className="bulkbar" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <span className="strong">{faNum(sel.size)} مورد انتخاب شده</span>
          <span className="grow" />
          {bulk}
          <button type="button" className="btn outline sm" onClick={() => onSelect?.(new Set())}>لغو انتخاب</button>
        </motion.div>
      )}
    </div>
  );
}

/** Page buttons with gaps: 1 … 4 5 6 … 20. */
export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return <span />;
  const list: (number | '…')[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) list.push(p);
    else if (list.at(-1) !== '…') list.push('…');
  }
  return (
    <nav className="pg" aria-label="صفحه‌ها">
      <button type="button" aria-label="صفحهٔ قبل" disabled={page === 1} onClick={() => onPage(page - 1)}><AIcon name="right" /></button>
      {list.map((p, i) => p === '…' ? <span key={'g' + i} className="gap">…</span> : (
        <button key={p} type="button" aria-current={p === page ? 'page' : undefined} aria-label={`صفحهٔ ${faNum(p)}`} onClick={() => onPage(p)}>{faNum(p)}</button>
      ))}
      <button type="button" aria-label="صفحهٔ بعد" disabled={page === pages} onClick={() => onPage(page + 1)}><AIcon name="left" /></button>
    </nav>
  );
}
