'use client';
/* Search plus filters above a list. On wide screens everything sits in the toolbar; on phones only the search box and a
   "Filters (n)" button show, and the filters open in a bottom sheet, so the first result is not pushed below a wall of
   controls. */
import { useState, type ReactNode } from 'react';
import { Dialog } from './Dialog';
import { faNum } from './format';
import { AIcon } from './Icon';
import { useMedia } from './useMedia';

export function FilterBar({ search, filters, active, onClear, results }: {
  search: ReactNode; filters: ReactNode; active: number; onClear: () => void; results: number;
}) {
  const phone = useMedia('(max-width: 767px)');
  const [open, setOpen] = useState(false);
  if (!phone) return <>{search}{filters}{active > 0 && <button type="button" className="btn ghost sm" onClick={onClear}><AIcon name="close" />پاک کردن فیلترها</button>}</>;
  return (
    <>
      <div className="row" style={{ flex: '1 1 100%', flexWrap: 'nowrap', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>{search}</div>
        <button type="button" className={`btn ${active ? 'secondary' : 'outline'}`} onClick={() => setOpen(true)} aria-haspopup="dialog">
          <AIcon name="filter" duo />فیلترها{active > 0 && <span className="n num" style={{ background: 'var(--primary)', color: 'var(--primary-fg)', borderRadius: 999, minWidth: 20, height: 20, display: 'grid', placeItems: 'center', fontSize: 12 }}>{faNum(active)}</span>}
        </button>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="فیلترها" icon="filter"
        footer={<>
          {active > 0 && <button type="button" className="btn outline" onClick={onClear}>پاک کردن</button>}
          <button type="button" className="btn" onClick={() => setOpen(false)} data-autofocus>نمایش {faNum(results)} نتیجه</button>
        </>}>
        <div className="filter-sheet">{filters}</div>
      </Dialog>
    </>
  );
}
