'use client';
/* eslint-disable @next/next/no-img-element -- transparent garment cut-outs from the catalogue */
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';
import { effectivePrice } from '@/lib/fit';
import { useBoutique } from '../boutique/Boutique';
import { productHref } from './Chrome';
import { FlipCard } from './FlipCard';
import { SplitReveal, useScrollScene } from './fx';
import { Icon } from './Icon';
import { useShop } from './Shop';
import { SPRING, railOrder, reveal } from './tokens';

/** The whole collection: the grid of pieces, then the brass rail. */
export function CollectionPage() {
  return (
    <main>
      <Collection />
      <Rack />
    </main>
  );
}

function Collection() {
  const b = useBoutique();
  const { c } = useShop();
  return (
    <section id="collection" className="mz-collection">
      <div className="mz-wrap">
        <motion.div className="mz-head" {...reveal}>
          <div>
            <p className="mz-eyebrow">{c.colEyebrow}</p>
            <SplitReveal as="h1" className="mz-h2" text={c.colTitle} />
          </div>
          <p className="mz-hint"><Icon name="turn" size={18} /><span className="mz-hover-only">{c.hoverHint}</span><span className="mz-touch-only">{c.tapHint}</span></p>
        </motion.div>
        <div className="mz-grid">
          {b.garments.map((g, i) => (
            <motion.div key={g.id} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ ...SPRING.soft, delay: (i % 4) * 0.07 }}>
              <FlipCard g={g} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** How far (px) the 1st, 2nd and 3rd neighbours step aside from a turning garment. */
const NUDGE = [62, 26, 10];

/** The brass rail: each abaya hangs side-on (74°) and turns to show its back (180°) on hover or tap; on a wide
 *  screen the pieces also turn one after another as the rail scrolls past. Focus names the piece in the caption. */
function Rack() {
  const b = useBoutique();
  const { c } = useShop();
  const [hover, setHover] = useState<string | null>(null);
  const [turned, setTurned] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<string | null>(null);
  const [wave, setWave] = useState<string | null>(null);
  const section = useRef<HTMLElement>(null);
  const rail = railOrder(b.garments);
  const ids = rail.map(g => g.id).join(',');
  useScrollScene(section, root => {
    const list = ids.split(','), stage = root.querySelector('.mz-rack__stage');
    gsap.matchMedia().add('(min-width: 901px) and (hover: hover)', () => {
      const t = ScrollTrigger.create({
        trigger: stage, start: 'top 62%', end: 'bottom 38%',
        onUpdate: self => { const id = list[Math.min(list.length - 1, Math.floor(self.progress * list.length))]; setWave(id); setActive(id); },
        onLeave: () => setWave(null), onLeaveBack: () => setWave(null),
      });
      return () => t.kill();
    });
  }, [ids]);
  const shown = b.byId(active);
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
          <div className="mz-rack__stage" style={{ '--n': rail.length } as React.CSSProperties}>
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
                // Neighbours ease aside from the garment that turns, so its open front never covers them.
                const gap = focus < 0 || i === focus ? 0 : Math.sign(i - focus) * (NUDGE[Math.abs(i - focus) - 1] ?? 0) * nudge * (b.dir === 'rtl' ? -1 : 1);
                return (
                  <motion.button key={g.id} type="button" className={`mz-reset mz-hang${on ? ' is-on' : ''}`} aria-pressed={!!turned[g.id]} aria-label={`${c.turnLabel} ${name}`}
                    initial={false} animate={{ x: gap }} transition={{ type: 'spring', stiffness: 70, damping: 17 }}
                    onPointerEnter={e => { if (e.pointerType === 'mouse') { setHover(g.id); setActive(g.id); } }}
                    onPointerLeave={e => { if (e.pointerType === 'mouse') setHover(h => (h === g.id ? null : h)); }}
                    onFocus={() => setActive(g.id)}
                    onClick={() => { setActive(g.id); setTurned(t => ({ [g.id]: !t[g.id] })); }}>
                    <span className="mz-hang__light" aria-hidden="true" />
                    <motion.span className="mz-hang__shadow" aria-hidden="true" initial={false} animate={{ scaleX: on ? 1 : 0.42, opacity: on ? 0.9 : 0.6 }} transition={SPRING.rack} />
                    <span className="mz-sway" style={{ animationDelay: `${-i * 0.9}s` }}>
                      <motion.span className="mz-hang__turn" initial={false} animate={{ rotateY: on ? 180 : 74 }} transition={SPRING.rack}>
                        {(['f', 'b'] as const).map(side => (
                          <span key={side} className={`mz-face is-hung${side === 'b' ? ' mz-back' : ''}`}>
                            <svg aria-hidden="true" viewBox="0 0 280 110" fill="none" className="mz-hook">
                              <path d="M140 52 V34 C140 29 148 28 148 20 A8 8 0 0 0 132 20" stroke="var(--rail-lo)" strokeWidth="2.2" strokeLinecap="round" />
                            </svg>
                            <span className="mz-hang__pic">{(side === 'f' ? g.front : g.back || g.front) && <img src={side === 'f' ? g.front : g.back || g.front} alt="" draggable={false} loading="lazy" decoding="async" />}</span>
                          </span>
                        ))}
                      </motion.span>
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mz-rack__caption" aria-live="polite">
          <AnimatePresence mode="wait">
            {shown && (
              <motion.div key={shown.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={SPRING.soft}>
                <p className="mz-rack__name">{b.tx(shown.name)}</p>
                <p className="mz-rack__meta">
                  {shown.colors[0] && <><span className="mz-only-wide-inline">{b.tx(shown.colors[0].name)}</span><span aria-hidden="true" className="mz-only-wide-inline">·</span></>}
                  <span>{b.price(effectivePrice(shown))}</span><span aria-hidden="true">·</span>
                  <Link href={productHref(shown.id)} className="mz-link is-main">{c.viewPiece}<Icon name="next" size={18} /></Link>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
