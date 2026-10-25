'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { effectivePrice } from '@/lib/fit';
import { Art } from './Art';
import { useBoutique } from './Boutique';

export type RackFilter = 'all' | 'new' | string;

const Hanger = () => (
  <svg className="hanger" width="160" height="60" viewBox="0 0 160 60" aria-hidden="true">
    <path d="M80 42 L80 35 C80 30 87 30.5 87 23.5 C87 17.5 84 14 79.5 14 C75 14 72.5 17.5 72.5 21.5" fill="none" stroke="#3E332A" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M80 41 L15 56.5 Q9 58.5 13 59 L147 59 Q151 58.5 145 56.5 Z" fill="none" stroke="#3E332A" strokeWidth="2.6" strokeLinejoin="round" />
  </svg>
);

/** The rack: garments on a rail, snap-scrolling. Hover shows the back (crossfade); on touch the first tap
 *  turns a piece and the second opens it. Neighbours lean away from the active piece. */
export function Rack({ filter, setFilter }: { filter: RackFilter; setFilter: (f: RackFilter) => void }) {
  const b = useBoutique();
  const { t, tx } = b;
  const scroller = useRef<HTMLDivElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [tapId, setTapId] = useState<string | null>(null);
  const [touch, setTouch] = useState(false);
  const [w, setW] = useState(1280);
  const [prog, setProg] = useState({ p: 0, r: 1 });

  const list = b.garments.filter(g => filter === 'all' || (filter === 'new' ? g.isNew : g.categoryId === filter));
  const mob = w < 720, compact = w < 1200;
  const pieceW = mob ? Math.round(Math.min(w * 0.62, 300)) : compact ? 212 : 232;
  const gap = mob ? 28 : compact ? 40 : 56;

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setProg({ p: max > 0 ? Math.min(1, Math.abs(el.scrollLeft) / max) : 0, r: Math.min(1, el.clientWidth / Math.max(1, el.scrollWidth)) });
  }, []);

  useEffect(() => {
    const m = window.matchMedia('(hover: none)');
    const on = () => { setTouch(m.matches); setW(window.innerWidth); measure(); };
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [measure]);
  useEffect(() => { scroller.current?.scrollTo({ left: 0 }); setTapId(null); measure(); }, [filter, measure]);

  const activeId = hoverId ?? (touch || mob ? tapId : null);
  const hi = list.findIndex(g => g.id === activeId);
  const sign = b.dir === 'rtl' ? -1 : 1;
  const step = (pieceW + gap) * 2 * sign;

  const filters: [RackFilter, string][] = [['all', t.fAll], ...b.categories.map(c => [c.id, tx(c.name)] as [string, string])];
  if (b.garments.some(g => g.isNew)) filters.push(['new', t.fNew]);

  return (
    <section id="rack" className="rack" aria-label={t.nRack}>
      <div className="rack-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 620 }}>
          <span className="kicker">{t.rackK} · {t.newArrivals}</span>
          <h2 className="h2">{t.rackT}</h2>
          <p style={{ margin: 0, fontSize: 15, fontStyle: 'italic', color: 'rgba(41,35,31,.74)' }}>{touch || mob ? t.rackHintM : t.rackHintD}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 18 }}>
          <div className="rack-filters" role="group" aria-label={t.colK}>
            {filters.map(([k, label]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>)}
          </div>
          {!compact && list.length > 3 && (
            <div className="rack-arrows">
              <button type="button" aria-label={t.prev} onClick={() => scroller.current?.scrollBy({ left: -step, behavior: 'smooth' })}><i className="ph-duotone ph-arrow-left flip-rtl" style={{ fontSize: 18 }} /></button>
              <button type="button" aria-label={t.next} onClick={() => scroller.current?.scrollBy({ left: step, behavior: 'smooth' })}><i className="ph-duotone ph-arrow-right flip-rtl" style={{ fontSize: 18 }} /></button>
            </div>
          )}
        </div>
      </div>

      {list.length === 0 ? <p className="rack-empty">{t.emptyRack}</p> : (
        <div className="rack-body">
          <div className="post s" /><div className="post e" /><div className="rail" />
          <div ref={scroller} className="rack-scroll" style={{ '--gap': `${gap}px` } as React.CSSProperties}
            onScroll={() => requestAnimationFrame(measure)}>
            {list.map((g, i) => {
              const on = g.id === activeId;
              const d = hi < 0 ? 0 : i - hi, ad = Math.abs(d), mag = ad === 1 ? 22 : ad === 2 ? 9 : 0, sg = d > 0 ? 1 : -1;
              const shift = mag ? `translateX(${sg * mag * sign}px) rotate(${sg * sign * (ad === 1 ? 1.4 : 0.5)}deg)` : 'none';
              const price = effectivePrice(g);
              return (
                <div key={g.id} className={`piece${on ? ' on' : ''}`} style={{ '--w': `${pieceW}px`, '--i': i, transform: shift } as React.CSSProperties}
                  onPointerEnter={e => { if (e.pointerType !== 'touch') setHoverId(g.id); }}
                  onPointerLeave={e => { if (e.pointerType !== 'touch') setHoverId(h => (h === g.id ? null : h)); }}>
                  <Hanger />
                  <button type="button" className="body" aria-label={`${tx(g.name)}, ${tx(g.type)}`}
                    onClick={() => { if ((touch || mob) && tapId !== g.id) setTapId(g.id); else b.openProduct(g.id); }}>
                    <span className="turn">
                      <span className="face f"><Art g={g} /></span>
                      <span className="face b"><Art g={g} view="back" /><span className="tag">{t.back}</span></span>
                    </span>
                    {g.isNew && <span className="new">{t.newTag}</span>}
                  </button>
                  <div className="meta">
                    <span className="n">{tx(g.name)}</span>
                    <span className="t">{tx(g.type)} · {price < g.price && <><s>{b.price(g.price)}</s> </>}{b.price(price)}</span>
                    <button type="button" className="tlink explore" tabIndex={on || touch ? 0 : -1} onClick={() => b.openProduct(g.id)}>
                      {t.explore}<i className="ph-duotone ph-arrow-right flip-rtl" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="progress" aria-hidden="true">
            <div><span style={{ insetInlineStart: `${Math.round(prog.p * (1 - prog.r) * 100)}%`, width: `${Math.round(prog.r * 100)}%` }} /></div>
          </div>
        </div>
      )}
    </section>
  );
}
