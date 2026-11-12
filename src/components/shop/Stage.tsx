'use client';
/* eslint-disable @next/next/no-img-element -- transparent cut-outs of the house models wearing each piece */
import gsap from 'gsap';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { effectivePrice } from '@/lib/fit';
import { useBoutique } from '../boutique/Boutique';
import { productHref } from './Chrome';
import { SplitReveal, useScrollScene } from './fx';
import { Icon, type IconName } from './Icon';
import { useShop } from './Shop';
import { EASE, SPRING, num } from './tokens';

const rise = (i: number) => ({ initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { ...SPRING.soft, delay: 0.08 * i } });

/** How far each neighbour stands from the centre, in its own widths, and how deep and how turned. */
const STEP = 0.62, DEPTH = 240, TURN = 34;
/** The turn on the centre piece: front, then back, then front again, then the next piece steps forward. */
const SHOW_BACK = 2200, SHOW_FRONT = 4600, NEXT = 6200;
/** A drag this long (px) moves the stage instead of clicking. */
const SWIPE = 40;

/** The cover: "see it on you" beside a stage where the abayas stand in a curve, in depth. The centre one turns (front
 *  and back crossfade) and the next steps forward on its own until the visitor takes a hand (drag, the arrows, a click
 *  on a neighbour, the arrow keys) or presses pause; hover and keyboard focus hold it too. The buttons put the centre
 *  piece on her. */
export function StageHero() {
  const b = useBoutique();
  const { c } = useShop();
  const reduce = useReducedMotion();
  const pieces = b.garments.filter(g => g.wornFront);
  const n = pieces.length;
  const first = Math.max(0, pieces.findIndex(g => g.id === b.settings.home.featuredId));
  const [at, setAt] = useState(first);
  const [back, setBack] = useState(false);
  const [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false);
  // Paused by the button, and for good once she moves the stage herself, so a button never changes under her finger.
  const [paused, setPaused] = useState(false);
  const [manual, setManual] = useState(false);
  const cur = Math.min(at, Math.max(0, n - 1));
  const held = hovered || focused || paused;
  const byHand = () => { setManual(true); setPaused(true); };
  const go = (d: number, hand = true) => { if (hand) byHand(); setBack(false); setAt(i => (Math.min(i, n - 1) + d + n) % n); };

  // The turn and the step, unless held or the visitor prefers stillness.
  useEffect(() => {
    if (reduce || held || n < 2) return;
    const hasBack = !!pieces[cur]?.wornBack;
    const t = [
      ...(hasBack ? [setTimeout(() => setBack(true), SHOW_BACK), setTimeout(() => setBack(false), SHOW_FRONT)] : []),
      setTimeout(() => go(1, false), hasBack ? NEXT : SHOW_BACK),
    ];
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, held, reduce, n]);

  // After a step from the keyboard the focus follows the piece that came to the centre.
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const keyed = useRef(false);
  useEffect(() => { if (keyed.current) { keyed.current = false; refs.current[cur]?.focus({ preventScroll: true }); } }, [cur]);

  // A gentle tilt of the whole stage toward the pointer.
  const rx = useSpring(useMotionValue(0), { stiffness: 60, damping: 16 }), ry = useSpring(useMotionValue(0), { stiffness: 60, damping: 16 });
  const drag = useRef<{ x: number; id: number } | null>(null), dragged = useRef(false);

  const section = useRef<HTMLElement>(null);
  useScrollScene(section, root => {
    const st = { trigger: root, start: 'top top', end: 'bottom top', scrub: true };
    gsap.to(root.querySelector('.st-stage'), { y: 70, scale: 0.94, ease: 'none', scrollTrigger: st });
    // Only beside the stage: on a phone the copy sits under it, and fading it would fade the buttons she is reaching for.
    gsap.matchMedia().add('(min-width: 1000px)', () => {
      gsap.to(root.querySelector('.st-hero__copy'), { y: -90, opacity: 0, ease: 'none', scrollTrigger: { ...st, start: 'top+=80 top' } });
    });
  });

  if (!n) return null;
  const g = pieces[cur];
  const offset = (i: number) => { let d = ((i - cur) % n + n) % n; if (d > n / 2) d -= n; return d; };
  const trust: { icon: IconName; text: string }[] = [
    { icon: 'lock', text: c.aiFact1 },
    { icon: 'send', text: c.heroShips.replace('{city}', b.tx(b.settings.originCity)) },
  ];

  return (
    <section ref={section} id="top" className="st-hero"
      onFocus={e => { if (e.target.matches(':focus-visible')) setFocused(true); }}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}>
      <div className="st-hero__glow" aria-hidden="true" />
      <div className="st-hero__in">
        <div className="st-hero__copy">
          <motion.p className="ai-eyebrow st-hero__eyebrow" {...rise(1)}><Icon name="hanger" size={18} />{c.stageK}</motion.p>
          <SplitReveal key={b.lang} as="h1" className="st-hero__lead" text={c.stageT} />
          <motion.p className="ai-body st-hero__body" {...rise(4)}>{c.stageB}</motion.p>
          <motion.div className="ai-ctas st-hero__ctas" {...rise(5)}>
            <Link href={`/fitting-room?g=${g.id}`} className="mz-btn is-main mz-pill">{c.stageTry}<Icon name="next" size={20} className="mz-arrow" /></Link>
            <Link href={`/fitting-room?g=${g.id}&live=1`} className="mz-btn mz-pill is-line"><Icon name="camera" size={20} />{c.aiWearLive}</Link>
          </motion.div>
          <motion.ul className="st-hero__trust" {...rise(6)}>
            {trust.map(t => <li key={t.icon}><Icon name={t.icon} size={18} />{t.text}</li>)}
          </motion.ul>
          <motion.div className="st-hero__more" {...rise(7)}><Link href="/collection" className="mz-link is-main st-hero__shop">{c.stageShop}<Icon name="next" size={18} /></Link></motion.div>
        </div>

        <div className="st-stage" role="group" aria-roledescription={c.stageRole} aria-label={c.stageLabel}
          onKeyDown={e => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault(); keyed.current = e.target instanceof HTMLElement && e.target.classList.contains('st-piece');
            go(e.key === 'ArrowLeft' ? -1 : 1);
          }}>
          {/* The drag surface is a plain layer: in the 3D world the pieces stand behind its own plane, where they would not
              be hit, so the world lets the pointer through to them and this layer only reads drags and the tilt. A drag is
              finished on the window, so letting go outside the stage still counts and leaves nothing behind. */}
          <div className="st-drag"
            // Hover holds the turn only over the stage itself; the copy beside it does not stop it.
            onPointerEnter={e => { if (e.pointerType === 'mouse') setHovered(true); }}
            onPointerLeave={e => { if (e.pointerType === 'mouse') { setHovered(false); rx.set(0); ry.set(0); } }}
            onPointerMove={e => {
              if (reduce || e.pointerType !== 'mouse' || drag.current) return;
              const r = e.currentTarget.getBoundingClientRect();
              ry.set(((e.clientX - r.left) / r.width - 0.5) * 10); rx.set(-((e.clientY - r.top) / r.height - 0.5) * 6);
            }}
            onPointerDown={e => {
              if (e.button !== 0) return;
              dragged.current = false; drag.current = { x: e.clientX, id: e.pointerId };
              const end = (ev: PointerEvent) => {
                if (ev.pointerId !== drag.current?.id) return;
                window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end);
                const dx = ev.clientX - drag.current.x; drag.current = null;
                if (ev.type === 'pointerup' && Math.abs(dx) > SWIPE) { dragged.current = true; go(dx < 0 ? 1 : -1); }
              };
              window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
            }}
            // A drag ends in a click on whatever piece it started on; that click must not also turn or move it.
            onClickCapture={e => { if (dragged.current) { dragged.current = false; e.preventDefault(); e.stopPropagation(); } }}>
          <motion.div className="st-world" dir="ltr" style={{ rotateX: rx, rotateY: ry }}>
            <span className="st-floor" aria-hidden="true" />
            {pieces.map((p, i) => {
              const d = offset(i), far = Math.abs(d), on = d === 0, shown = far <= 2;
              const name = b.tx(p.name);
              return (
                <motion.button key={p.id} ref={el => { refs.current[i] = el; }} type="button" className={`mz-reset st-piece${on ? ' is-on' : ''}`}
                  aria-label={on && p.wornBack ? `${c.turnLabel} ${name}` : name} aria-current={on || undefined}
                  inert={!shown || undefined} tabIndex={on ? 0 : -1}
                  // The centre piece is there from the first paint; the others come forward out of the depth.
                  initial={on ? false : { opacity: 0, z: -900, x: `${d * STEP * 100}%` }}
                  animate={{ x: `${d * STEP * 100}%`, z: -far * DEPTH, rotateY: -d * TURN, scale: 1 - far * 0.06, opacity: shown ? 1 - far * 0.22 : 0 }}
                  transition={{ ...SPRING.soft, opacity: { duration: 0.6, ease: EASE } }}
                  style={{ zIndex: 10 - far }}
                  onClick={() => { if (!on) { go(d); return; } if (p.wornBack) { byHand(); setBack(v => !v); } }}>
                  <span className="st-piece__shadow" aria-hidden="true" />
                  {shown && (
                    <motion.img src={p.wornFront} alt="" draggable={false} className="st-piece__img" decoding="async" fetchPriority={on ? 'high' : 'low'}
                      initial={false} animate={{ opacity: on && back ? 0 : 1, scale: on && back ? 0.985 : 1 }} transition={{ duration: reduce ? 0 : 0.9, ease: EASE }} />
                  )}
                  {far <= 1 && p.wornBack && (
                    <motion.img src={p.wornBack} alt="" draggable={false} className="st-piece__img" decoding="async" loading="lazy"
                      initial={false} animate={{ opacity: on && back ? 1 : 0, scale: on && back ? 1 : 1.015 }} transition={{ duration: reduce ? 0 : 0.9, ease: EASE }} />
                  )}
                </motion.button>
              );
            })}
          </motion.div>
          </div>

          <div className="st-caption">
            <p className="st-caption__name" aria-live={manual ? 'polite' : 'off'} aria-atomic="true">
              <Link href={productHref(g.id)} className="mz-link">{b.tx(g.name)}</Link>
              <span className="st-caption__price">{b.price(effectivePrice(g))}</span>
              <span className="mz-sr">{` · ${c.heroSlide} ${num(cur + 1, b.lang)} ${c.heroOf} ${num(n, b.lang)}`}</span>
            </p>
            {g.wornBack && <p className="st-caption__side" aria-hidden="true"><span className={back ? '' : 'is-on'}>{c.front}</span><span className={back ? 'is-on' : ''}>{c.back}</span></p>}
            {/* Left and right here are the stage's own (it is laid out left to right in every language). */}
            <div className="st-caption__nav" dir="ltr">
              <span className="st-caption__count" aria-hidden="true">{num(cur + 1, b.lang, 2)} / {num(n, b.lang, 2)}</span>
              <button type="button" className="mz-reset mz-icon-btn mz-round" aria-label={c.heroPrev} onClick={() => go(-1)}><Icon name="back" size={20} /></button>
              <button type="button" className="mz-reset mz-icon-btn mz-round" aria-label={c.heroNext} onClick={() => go(1)}><Icon name="next" size={20} /></button>
              <button type="button" className="mz-reset mz-icon-btn mz-round st-caption__pause" aria-label={paused ? c.heroPlay : c.heroPause}
                onClick={() => setPaused(v => !v)}><Icon name={paused ? 'play' : 'pause'} size={18} /></button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
