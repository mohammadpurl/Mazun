'use client';
/* eslint-disable @next/next/no-img-element -- transparent garment renders and cut-outs from the catalogue */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { effectivePrice } from '@/lib/fit';
import type { Garment } from '@/lib/types';
import { useBoutique } from '../boutique/Boutique';
import { productHref } from './Chrome';
import { useOpenChat } from './concierge/useConcierge';
import { SplitReveal, useScrollScene } from './fx';
import { Icon } from './Icon';
import { RACK_RENDERS } from './rackRenders';
import { useShop } from './Shop';
import { SPRING, railOrder, reveal } from './tokens';

/** How far (px) the 1st, 2nd and 3rd neighbours step aside from a turning garment. */
const NUDGE = [84, 34, 12];

/** How a piece hangs. With a photoreal render (rackRenders.ts) it hangs at the render's own three-quarter turn and
 *  swings round to its back; a piece whose catalogue photo has been replaced since its render was made, or that
 *  has none, hangs its flat cut-out side-on (74°) as before. */
function hangOf(g: Garment) {
  const r = RACK_RENDERS[g.id];
  if (r && g.front === `/images/garments/${g.id}-front.webp`) {
    return { real: true, rest: 0, on: -180, front: `/images/rack/${g.id}-34.webp`, back: `/images/rack/${g.id}-back.webp`, neckF: r.turn.neck, neckB: r.back.neck };
  }
  return { real: false, rest: 74, on: 180, front: g.front, back: g.back || g.front, neckF: 0.5, neckB: 0.5 };
}

/** The brass rail: the pieces hang close together, each turned three-quarters as photographed, and the one under
 *  the pointer (or tapped) swings round to show its back while its neighbours step aside; on a wide screen the
 *  pieces also turn one after another as the rail scrolls past. Focus names the piece in the caption. */
export function Rack() {
  const b = useBoutique();
  const { c } = useShop();
  const openChat = useOpenChat();
  const [hover, setHover] = useState<string | null>(null);
  const [turned, setTurned] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<string | null>(null);
  const [wave, setWave] = useState<string | null>(null);
  const section = useRef<HTMLElement>(null);
  const rail = railOrder(b.garments);
  const ids = rail.map(g => g.id).join(',');
  useScrollScene(section, root => {
    const list = ids.split(','), stage = root.querySelector('.mz-rack__stage');
    // the pieces drop onto the rail one after another the first time it comes into view
    gsap.from(root.querySelectorAll('.mz-hang__drop'), {
      y: -46, opacity: 0, rotate: -2.5, transformOrigin: '50% 0%', duration: 1.25, ease: 'power3.out', stagger: 0.075,
      scrollTrigger: { trigger: stage, start: 'top 82%', once: true },
    });
    gsap.matchMedia().add('(min-width: 901px) and (hover: hover)', () => {
      const t = ScrollTrigger.create({
        trigger: stage, start: 'top 62%', end: 'bottom 38%',
        onUpdate: self => { const id = list[Math.min(list.length - 1, Math.floor(self.progress * list.length))]; setWave(id); setActive(id); },
        onLeave: () => setWave(null), onLeaveBack: () => setWave(null),
      });
      return () => t.kill();
    });
  }, [ids]);
  // Named from the start: on a touch screen nothing would fill the caption until the first tap. The piece under the
  // pointer keeps the caption while the page scrolls past it, so the name never belongs to another garment.
  const shown = b.byId(hover ?? active ?? rail[0]?.id);
  // A garment turned by tap or keyboard holds the stage; the scroll wave only leads when nothing is turned.
  const turnedId = rail.find(g => turned[g.id])?.id ?? null;
  const lead = hover ?? turnedId ?? wave;
  const focus = rail.findIndex(g => g.id === lead);
  // Phones hang the garments closer together, so neighbours step further aside.
  const [nudge, setNudge] = useState(1);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const on = () => setNudge(mq.matches ? 1.5 : 1);
    on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const n = rail.length, rtl = b.dir === 'rtl';

  return (
    <section ref={section} id="rack" className="mz-rack">
      <span className="mz-rack__lamp" aria-hidden="true" />
      <div className="mz-wrap mz-rack__in">
        <motion.div className="mz-head is-centred" {...reveal}>
          <p className="mz-eyebrow">{c.rackEyebrow}</p>
          <SplitReveal className="mz-h2" text={c.rackTitle} />
          <p className="mz-hint"><Icon name="turn" size={18} className="mz-hover-only" /><Icon name="swipe" size={18} className="mz-touch-only" />
            <span className="mz-hover-only">{c.rackHoverHint}</span><span className="mz-touch-only">{c.rackTapHint}</span></p>
        </motion.div>
        <div className="mz-rack__scroll">
          <div className="mz-rack__stage" style={{ '--n': n } as React.CSSProperties}>
            <span className="mz-rack__post is-start" aria-hidden="true" />
            <span className="mz-rack__post is-end" aria-hidden="true" />
            <span className="mz-rack__rail" aria-hidden="true" />
            <span className="mz-rack__finial is-start" aria-hidden="true" />
            <span className="mz-rack__finial is-end" aria-hidden="true" />
            <span className="mz-rack__floor" aria-hidden="true" />
            <div className="mz-rack__row">
              {rail.map((g, i) => {
                const on = lead === g.id || !!turned[g.id];
                const name = b.tx(g.name);
                const hang = hangOf(g);
                // Neighbours ease aside from the garment that turns, so its open front never covers them.
                const gap = focus < 0 || i === focus ? 0 : Math.sign(i - focus) * (NUDGE[Math.abs(i - focus) - 1] ?? 0) * nudge * (rtl ? -1 : 1);
                // Rendered pieces overlap like a full rail: each lies over the one on its left, so every front shows.
                const layer = hang.real ? (rtl ? n - i : i + 1) : undefined;
                return (
                  <motion.button key={g.id} type="button" className={`mz-reset mz-hang${on ? ' is-on' : ''}${hang.real ? ' is-real' : ''}`} aria-pressed={!!turned[g.id]} aria-label={`${c.turnLabel} ${name}`}
                    style={{ zIndex: on ? n + 5 : layer }}
                    initial={false} animate={{ x: gap }} transition={{ type: 'spring', stiffness: 70, damping: 17 }}
                    onPointerEnter={e => { if (e.pointerType === 'mouse') { setHover(g.id); setActive(g.id); } }}
                    onPointerLeave={e => { if (e.pointerType === 'mouse') setHover(h => (h === g.id ? null : h)); }}
                    onFocus={() => setActive(g.id)}
                    onClick={() => { setActive(g.id); setTurned(t => ({ [g.id]: !t[g.id] })); }}>
                    <span className="mz-hang__light" aria-hidden="true" />
                    <motion.span className="mz-hang__shadow" aria-hidden="true" initial={false}
                      animate={{ scaleX: on ? 1 : hang.real ? 0.8 : 0.42, opacity: on ? 0.9 : 0.6 }} transition={SPRING.rack} />
                    <span className="mz-hang__drop">
                      <span className="mz-sway" style={{ animationDelay: `${-i * 0.9}s` }}>
                        <motion.span className="mz-hang__turn" initial={false} animate={{ rotateY: on ? hang.on : hang.rest, scale: on && hang.real ? 1.03 : 1 }} transition={SPRING.rack}>
                          {(['f', 'b'] as const).map(side => {
                            const src = side === 'f' ? hang.front : hang.back;
                            return (
                              <span key={side} className={`mz-face is-hung${side === 'b' ? ' mz-back' : ''}`}>
                                <svg aria-hidden="true" viewBox="0 0 280 110" fill="none" className="mz-hook">
                                  <path d="M140 52 V34 C140 29 148 28 148 20 A8 8 0 0 0 132 20" stroke="var(--rail-lo)" strokeWidth="2.2" strokeLinecap="round" />
                                </svg>
                                <span className="mz-hang__pic">
                                  {src && <img src={src} alt="" draggable={false} loading="lazy" decoding="async" style={{ '--neck': side === 'f' ? hang.neckF : hang.neckB } as React.CSSProperties} />}
                                </span>
                              </span>
                            );
                          })}
                        </motion.span>
                      </span>
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
        {/* The scroll wave passes every name in turn; only her own choice is announced. */}
        <div className="mz-rack__caption" aria-live={wave && !hover && !turnedId ? 'off' : 'polite'}>
          <AnimatePresence mode="wait">
            {shown && (
              <motion.div key={shown.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={SPRING.soft}>
                <p className="mz-rack__name">{b.tx(shown.name)}</p>
                <p className="mz-rack__meta">
                  {shown.colors[0] && <><span className="mz-only-wide-inline">{b.tx(shown.colors[0].name)}</span><span aria-hidden="true" className="mz-only-wide-inline">·</span></>}
                  <span>{b.price(effectivePrice(shown))}</span><span aria-hidden="true">·</span>
                  <Link href={productHref(shown.id)} className="mz-link is-main">{c.viewPiece}<Icon name="next" size={18} /></Link>
                  <span aria-hidden="true" className="mz-only-wide-inline">·</span>
                  <button type="button" className="mz-reset mz-link" onClick={() => openChat(shown.id)}>{c.aiDock}</button>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
