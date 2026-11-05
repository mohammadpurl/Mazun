'use client';
/* eslint-disable @next/next/no-img-element -- the hanger is a fixed cut-out inside a 3D transform */
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
  const box = el.getBoundingClientRect();
  const offset = (slot: Element) => {
    const r = slot.getBoundingClientRect();
    return r.left + r.width / 2 - (box.left + box.width / 2);
  };
  return [...el.querySelectorAll('.slot')].map(offset).reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a), Infinity);
}

/** The rack, the first thing on the home page: garments hang side-on and close together on one rail. Hover or
 *  focus swings a piece round to show its back and parts its neighbours; on touch the first tap does that and the
 *  second opens it. GSAP owns `.arrive` (the slide onto the rail) and `.swing` (the tug from scrolling); Motion owns
 *  `.slot` (filter changes); CSS owns `.hang` (idle sway, parting) and `.turn` (the 3D turn). */
export function Rack({ filter, setFilter }: { filter: RackFilter; setFilter: (f: RackFilter) => void }) {
  const b = useBoutique();
  const { t, tx } = b;
  const scroller = useRef<HTMLDivElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [tapId, setTapId] = useState<string | null>(null);
  const [touch, setTouch] = useState(false);
  const [view, setView] = useState({ w: 1280, h: 800 });
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
  const skipFocus = useRef(false);

  const list = b.garments.filter(g => filter === 'all' || (filter === 'new' ? g.isNew : g.categoryId === filter));
  const mob = view.w < 720;
  // A piece is drawn at full width and turned side-on, so its slot on the rail is far narrower than the piece.
  const pieceW = Math.round(Math.max(170, Math.min(250, (view.h - (mob ? 430 : 400)) / 2.2)));
  const slotW = Math.round(Math.max(52, Math.min(pieceW * .44, (view.w - 80) / Math.max(1, list.length))));
  const part = Math.round((pieceW - slotW) / 2 + 12);

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const p = max > 0 ? Math.min(1, Math.abs(el.scrollLeft) / max) : 0, r = Math.min(1, el.clientWidth / Math.max(1, el.scrollWidth));
    setProg(o => (Math.abs(o.p - p) < .002 && o.r === r ? o : { p, r }));
  }, []);

  useEffect(() => {
    const m = window.matchMedia('(hover: none)');
    // The height only changes with the width, so the phone's collapsing address bar does not resize the rack.
    const on = () => { setTouch(m.matches); setView(v => (v.w === window.innerWidth && v.h !== 800 ? v : { w: window.innerWidth, h: window.innerHeight })); measure(); };
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

  useEffect(() => { measure(); }, [measure, pieceW, slotW, list.length, b.dir]);

  useEffect(() => {
    const out = (e: PointerEvent) => { if (!(e.target as Element).closest?.('.rack-scroll,.rack-caption')) setTapId(null); };
    document.addEventListener('pointerdown', out);
    return () => document.removeEventListener('pointerdown', out);
  }, []);

  const open = (id: string) => { skipFocus.current = true; b.openProduct(id, { list: list.map(g => g.id) }); };

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
        .from('.arrive', { x: -120 * dirSign, opacity: 0, rotation: -7 * dirSign, duration: 1.3, ease: 'elastic.out(1,.55)', stagger: .05, clearProps: 'transform,opacity' }, '<.35');
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
    if (!d.moved && Math.abs(dx) > 6 && el.scrollWidth > el.clientWidth) { d.moved = true; el.setPointerCapture(e.pointerId); el.classList.add('dragging'); setHoverId(null); }
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
  const active = hi >= 0 ? list[hi] : null;
  const sign = b.dir === 'rtl' ? -1 : 1;

  const filters: [RackFilter, string][] = [['all', t.fAll], ...b.categories.map(c => [c.id, tx(c.name)] as [string, string])];
  if (b.garments.some(g => g.isNew)) filters.push(['new', t.fNew]);
  const price = active ? effectivePrice(active) : 0;

  return (
    <section ref={section} id="rack" className="rack" aria-label={t.nRack}>
      <div className="rack-head">
        <h1 className="rack-title">{t.rackT}</h1>
      </div>

      {list.length === 0 ? <p className="rack-empty">{t.emptyRack}</p> : (
        <div className="rack-body">
          <div className="post s" /><div className="post e" /><div className="rail" />
          <MotionConfig reducedMotion="user">
            <motion.div layoutScroll ref={scroller} className="rack-scroll"
              style={{ '--slot': `${slotW}px`, '--w': `${pieceW}px` } as React.CSSProperties}
              onScroll={onScroll} onDragStart={e => e.preventDefault()} onLostPointerCapture={endDrag}
              onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
              onClickCapture={e => { if (e.detail > 0 && drag.current.moved) { e.preventDefault(); e.stopPropagation(); } }}>
              <AnimatePresence mode="popLayout" initial={false} onExitComplete={measure}>
                {list.map((g, i) => {
                  const on = g.id === activeId;
                  const shift = hi < 0 || on ? 'none' : `translateX(${(i > hi ? part : -part) * sign}px)`;
                  return (
                    <motion.div key={g.id} layout="position" layoutDependency={filter} className={`slot${on ? ' on' : ''}`}
                      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }}
                      transition={{ duration: .5, ease: [.3, .7, .2, 1] }}>
                      <div className="arrive">
                        <div className={`piece${on ? ' on' : ''}`} style={{ '--i': i } as React.CSSProperties}
                          onFocus={e => { if (skipFocus.current) skipFocus.current = false; else if (e.target.matches(':focus-visible')) setFocusId(g.id); }}
                          onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocusId(f => (f === g.id ? null : f)); }}
                          onPointerEnter={e => { if (e.pointerType !== 'touch' && !drag.current.moved) setHoverId(g.id); }}
                          onPointerLeave={e => { if (e.pointerType !== 'touch') setHoverId(h => (h === g.id ? null : h)); }}>
                          <div className="hang" style={{ transform: shift }}>
                            <div className="swing">
                              <button type="button" className="body" aria-label={`${tx(g.name)}, ${tx(g.type)}`}
                                onClick={e => { if (e.detail > 0 && (touch || mob) && activeId !== g.id) { setTapId(g.id); e.currentTarget.closest('.slot')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' }); } else open(g.id); }}>
                                <span className="turn">
                                  <img className="hanger" src="/images/hanger.webp" alt="" draggable={false} />
                                  <span className="face f"><Art g={g} /></span>
                                  <span className="face b"><Art g={g} view="back" /></span>
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          </MotionConfig>
          {prog.r < 1 && (
            <div className="progress" aria-hidden="true">
              <div><span style={{ insetInlineStart: `${Math.round(prog.p * (1 - prog.r) * 100)}%`, width: `${Math.round(prog.r * 100)}%` }} /></div>
            </div>
          )}
        </div>
      )}

      <div className="rack-caption" aria-live={touch || mob ? 'polite' : undefined}>
        {active ? (
          <>
            <span className="n">{tx(active.name)}</span>
            <span className="t">{tx(active.type)} · {price < active.price && <><s>{b.price(active.price)}</s> </>}{b.price(price)}</span>
            {(touch || mob) && <button type="button" className="tlink u" onClick={() => open(active.id)}>{t.explore}</button>}
          </>
        ) : <span className="hint">{touch || mob ? t.rackHintM : t.rackHintD}</span>}
      </div>

      <div className="rack-filters" role="group" aria-label={t.colK}>
        {filters.map(([k, label]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>)}
      </div>
    </section>
  );
}
