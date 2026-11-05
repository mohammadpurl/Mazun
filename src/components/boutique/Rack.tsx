'use client';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { effectivePrice } from '@/lib/fit';
import { Art } from './Art';
import { useBoutique } from './Boutique';

export type RackFilter = 'all' | 'new' | string;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** How far the rail must move for the closest piece to sit on its snap line. Measured on screen, so RTL just works. */
function nearestSlotOffset(el: HTMLElement) {
  const box = el.getBoundingClientRect(), css = getComputedStyle(el);
  const centred = window.innerWidth < 720, rtl = css.direction === 'rtl';
  const offset = (slot: Element) => {
    const r = slot.getBoundingClientRect();
    if (centred) return r.left + r.width / 2 - (box.left + box.width / 2);
    return rtl ? r.right - (box.right - parseFloat(css.paddingRight)) : r.left - (box.left + parseFloat(css.paddingLeft));
  };
  return [...el.querySelectorAll('.slot')].map(offset).reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a), Infinity);
}

const Hanger = () => (
  <svg className="hanger" width="160" height="60" viewBox="0 0 160 60" aria-hidden="true">
    <path d="M80 42 L80 35 C80 30 87 30.5 87 23.5 C87 17.5 84 14 79.5 14 C75 14 72.5 17.5 72.5 21.5" fill="none" stroke="#8A7458" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M80 40 Q74 40 66 44 L14 55 Q8 57 13 59 L147 59 Q152 57 146 55 L94 44 Q86 40 80 40 Z" fill="#B08D63" stroke="#7A5F42" strokeWidth="1" strokeLinejoin="round" />
    <path d="M18 56 L68 46 Q80 42 92 46 L142 56" fill="none" stroke="#D8BE98" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

/** The rack: garments on a rail, snap-scrolling; a mouse can also drag it. Hover or focus turns a piece to its
 *  back; on touch the first tap turns it and the second opens it. Neighbours lean away from the active piece.
 *  GSAP owns `.arrive` (the slide onto the rail) and `.swing` (the tug from scrolling); Motion owns `.slot` (filter
 *  changes). Only the garment hangs and moves: name and price stay still so they can be read. */
export function Rack({ filter, setFilter }: { filter: RackFilter; setFilter: (f: RackFilter) => void }) {
  const b = useBoutique();
  const { t, tx } = b;
  const scroller = useRef<HTMLDivElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [tapId, setTapId] = useState<string | null>(null);
  const [touch, setTouch] = useState(false);
  const [w, setW] = useState(1280);
  const [prog, setProg] = useState({ p: 0, r: 1 });
  const section = useRef<HTMLElement>(null);
  const drag = useRef({ id: -1, x: 0, left: 0, moved: false });
  const entrance = useRef<gsap.core.Timeline | undefined>(undefined);
  const swingTl = useRef<gsap.core.Timeline | undefined>(undefined);
  const swingReady = useRef(true);
  const lastLeft = useRef(0);
  const noSwingUntil = useRef(0);
  const scrollFrame = useRef(0);
  const prevFilter = useRef(filter);

  const list = b.garments.filter(g => filter === 'all' || (filter === 'new' ? g.isNew : g.categoryId === filter));
  const mob = w < 720, compact = w < 1200;
  const pieceW = mob ? Math.round(Math.min(w * 0.62, 300)) : compact ? 212 : 232;
  const gap = mob ? 28 : compact ? 40 : 56;

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const p = max > 0 ? Math.min(1, Math.abs(el.scrollLeft) / max) : 0, r = Math.min(1, el.clientWidth / Math.max(1, el.scrollWidth));
    setProg(o => (Math.abs(o.p - p) < .002 && o.r === r ? o : { p, r }));
  }, []);

  useEffect(() => {
    const m = window.matchMedia('(hover: none)');
    const on = () => { setTouch(m.matches); setW(window.innerWidth); measure(); };
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [measure]);
  useEffect(() => {
    noSwingUntil.current = performance.now() + 700;
    scroller.current?.scrollTo({ left: 0 });
    setTapId(null); setHoverId(null); setFocusId(null);
    measure();
    if (prevFilter.current !== filter) entrance.current?.progress(1);
    prevFilter.current = filter;
  }, [filter, measure]);

  useEffect(() => { measure(); }, [measure, pieceW, gap, list.length, b.dir]);

  const hasItems = list.length > 0;
  useLayoutEffect(() => {
    const root = section.current, el = scroller.current;
    if (!root || !el || reducedMotion()) return;
    gsap.registerPlugin(ScrollTrigger);
    const dirSign = document.documentElement.dir === 'rtl' ? -1 : 1;
    swingReady.current = false;
    lastLeft.current = el.scrollLeft;
    const ctx = gsap.context(() => {
      entrance.current = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 85%', once: true }, onComplete: () => { swingReady.current = true; } })
        .from('.rail', { scaleX: 0, duration: 1.1, ease: 'power3.inOut' })
        .from('.post', { scaleY: 0, duration: .6, ease: 'power2.out' }, '<.2')
        .from('.arrive', { x: -120 * dirSign, opacity: 0, rotation: -7 * dirSign, duration: 1.3, ease: 'elastic.out(1,.55)', stagger: .07, clearProps: 'transform,opacity' }, '<.35');
    }, root);
    return () => {
      swingTl.current?.kill();
      gsap.set(el.querySelectorAll('.swing'), { clearProps: 'transform' });
      entrance.current = undefined;
      swingReady.current = true;
      ctx.revert();
    };
  }, [hasItems]);
  useEffect(() => () => cancelAnimationFrame(scrollFrame.current), []);

  // Scrolling tugs the hooks along the rail, and the garments swing back into place.
  const onScroll = () => {
    cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() => {
      measure();
      const el = scroller.current;
      if (!el) return;
      const delta = el.scrollLeft - lastLeft.current;
      lastLeft.current = el.scrollLeft;
      if (!swingReady.current || Math.abs(delta) < 2 || performance.now() < noSwingUntil.current || reducedMotion()) return;
      const pieces = el.querySelectorAll('.swing');
      swingTl.current?.kill();
      swingTl.current = gsap.timeline()
        .to(pieces, { rotation: gsap.utils.clamp(-5, 5, delta * -.12), duration: .3, ease: 'power2.out' })
        .to(pieces, { rotation: 0, duration: 1.4, ease: 'elastic.out(1,.4)' });
    });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag.current = { id: e.pointerId, x: e.clientX, left: e.currentTarget.scrollLeft, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current, el = e.currentTarget;
    if (d.id !== e.pointerId) return;
    if (!(e.buttons & 1)) { endDrag(e); return; }
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 6) { d.moved = true; el.setPointerCapture(e.pointerId); el.classList.add('dragging'); setHoverId(null); }
    if (d.moved) el.scrollLeft = d.left - dx;
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current, el = e.currentTarget;
    if (d.id !== e.pointerId) return;
    d.id = -1;
    if (!d.moved) return;
    setTimeout(() => { d.moved = false; }, 0); // after the click this release may fire
    el.classList.replace('dragging', 'settling');
    el.scrollTo({ left: el.scrollLeft + nearestSlotOffset(el), behavior: reducedMotion() ? 'auto' : 'smooth' });
    const done = () => { el.classList.remove('settling'); el.removeEventListener('scrollend', done); };
    el.addEventListener('scrollend', done);
    setTimeout(done, 500);
  };

  const activeId = hoverId ?? focusId ?? (touch || mob ? tapId : null);
  const hi = list.findIndex(g => g.id === activeId);
  const sign = b.dir === 'rtl' ? -1 : 1;
  const step = (pieceW + gap) * 2 * sign;

  const filters: [RackFilter, string][] = [['all', t.fAll], ...b.categories.map(c => [c.id, tx(c.name)] as [string, string])];
  if (b.garments.some(g => g.isNew)) filters.push(['new', t.fNew]);

  return (
    <section ref={section} id="rack" className="rack" aria-label={t.nRack}>
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
          {!compact && prog.r < 1 && (
            <div className="rack-arrows">
              <button type="button" aria-label={t.prev} disabled={prog.p < .005} onClick={() => scroller.current?.scrollBy({ left: -step, behavior: reducedMotion() ? 'auto' : 'smooth' })}><i className="ph-duotone ph-arrow-left flip-rtl" style={{ fontSize: 18 }} /></button>
              <button type="button" aria-label={t.next} disabled={prog.p > .995} onClick={() => scroller.current?.scrollBy({ left: step, behavior: reducedMotion() ? 'auto' : 'smooth' })}><i className="ph-duotone ph-arrow-right flip-rtl" style={{ fontSize: 18 }} /></button>
            </div>
          )}
        </div>
      </div>

      {list.length === 0 ? <p className="rack-empty">{t.emptyRack}</p> : (
        <div className="rack-body">
          <div className="post s" /><div className="post e" /><div className="rail" />
          <MotionConfig reducedMotion="user">
          <motion.div layoutScroll ref={scroller} className="rack-scroll" style={{ '--gap': `${gap}px`, '--w': `${pieceW}px` } as React.CSSProperties}
            onScroll={onScroll} onDragStart={e => e.preventDefault()} onLostPointerCapture={endDrag}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
            onClickCapture={e => { if (e.detail > 0 && drag.current.moved) { e.preventDefault(); e.stopPropagation(); } }}>
            <AnimatePresence mode="popLayout" initial={false} onExitComplete={measure}>
            {list.map((g, i) => {
              const on = g.id === activeId;
              const d = hi < 0 ? 0 : i - hi, ad = Math.abs(d), mag = ad === 1 ? 22 : ad === 2 ? 9 : 0, sg = d > 0 ? 1 : -1;
              const shift = mag ? `translateX(${sg * mag * sign}px) rotate(${sg * sign * (ad === 1 ? 1.4 : 0.5)}deg)` : 'none';
              const price = effectivePrice(g);
              return (
                <motion.div key={g.id} layout="position" layoutDependency={filter} className="slot" style={{ width: pieceW }}
                  initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }}
                  transition={{ duration: .5, ease: [.3, .7, .2, 1] }}>
                <div className="arrive">
                <div className={`piece${on ? ' on' : ''}`} style={{ '--w': `${pieceW}px`, '--i': i } as React.CSSProperties}
                  onFocus={e => { if (e.target.matches(':focus-visible')) setFocusId(g.id); }}
                  onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocusId(f => (f === g.id ? null : f)); }}
                  onPointerEnter={e => { if (e.pointerType !== 'touch' && !drag.current.moved) setHoverId(g.id); }}
                  onPointerLeave={e => { if (e.pointerType !== 'touch') setHoverId(h => (h === g.id ? null : h)); }}>
                  <div className="hang" style={{ transform: shift }}>
                  <div className="swing">
                  <Hanger />
                  <button type="button" className="body" aria-label={`${tx(g.name)}, ${tx(g.type)}`}
                    onClick={e => { if (e.detail > 0 && (touch || mob) && activeId !== g.id) setTapId(g.id); else b.openProduct(g.id); }}>
                    <span className="turn">
                      <span className="face f"><Art g={g} /></span>
                      <span className="face b"><Art g={g} view="back" /><span className="tag">{t.back}</span></span>
                    </span>
                    {g.isNew && <span className="new">{t.newTag}</span>}
                  </button>
                  </div>
                  </div>
                  <div className="meta">
                    <span className="n">{tx(g.name)}</span>
                    <span className="t type">{tx(g.type)}</span>
                    <span className="t">{price < g.price && <><s>{b.price(g.price)}</s> </>}{b.price(price)}</span>
                    <button type="button" className="tlink explore" tabIndex={on || touch ? 0 : -1} onClick={() => b.openProduct(g.id)}>
                      {t.explore}<i className="ph-duotone ph-arrow-right flip-rtl" />
                    </button>
                  </div>
                </div>
                </div>
                </motion.div>
              );
            })}
            </AnimatePresence>
          </motion.div>
          </MotionConfig>
          <div className="progress" aria-hidden="true">
            <div><span style={{ insetInlineStart: `${Math.round(prog.p * (1 - prog.r) * 100)}%`, width: `${Math.round(prog.r * 100)}%` }} /></div>
          </div>
        </div>
      )}
    </section>
  );
}
