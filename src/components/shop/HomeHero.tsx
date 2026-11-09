'use client';
/* eslint-disable @next/next/no-img-element -- transparent cut-outs of the house models */
import gsap from 'gsap';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useBoutique } from '../boutique/Boutique';
import { SplitReveal, useScrollScene } from './fx';
import { Icon, type IconName } from './Icon';
import { useShop } from './Shop';
import { EASE, SPRING, num } from './tokens';

const rise = (i: number) => ({ initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { ...SPRING.soft, delay: 0.08 * i } });

/** House model photos for the hero, cut out on transparent ground (public/images/models). */
const HERO_MODELS = [
  { src: '/images/models/olive.webp', alt: 'heroAltOlive' },
  { src: '/images/models/black.webp', alt: 'heroAltBlack' },
] as const;

/** Hero: an editorial cover. The headline sits beside a house model; the photos crossfade every 7 s, held on hover,
 *  on keyboard focus and by the pause button. */
export function HomeHero() {
  const b = useBoutique();
  const { c } = useShop();
  const reduce = useReducedMotion();
  // The piece chosen in admin (Settings → featured) opens the hero when a model wears it; the house photos follow.
  const featured = b.byId(b.settings.home.featuredId);
  const looks = [
    ...(featured?.kind === 'garment' && featured.wornFront ? [{ src: featured.wornFront, alt: `${c.wearing} ${b.tx(featured.name)}` }] : []),
    ...HERO_MODELS.map(m => ({ src: m.src, alt: c[m.alt] })),
  ];
  const [li, setLi] = useState(0);
  // Advances every 7 s; a manual step restarts the wait. A mouse over the hero or keyboard focus inside it holds it
  // (each on its own, so leaving one does not release the other), and the pause button stops it until pressed again.
  const [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false), [paused, setPaused] = useState(false);
  const held = hovered || focused || paused;
  useEffect(() => {
    if (reduce || held || looks.length < 2) return;
    const t = setTimeout(() => setLi(i => (i + 1) % looks.length), 7000);
    return () => clearTimeout(t);
  }, [reduce, held, looks.length, li]);
  // A manual step is announced; autoplay alone is not.
  const [manual, setManual] = useState(false);
  // useReducedMotion() is null on the server, so it reaches aria-live only after mount; the first render matches the server.
  const [calm, setCalm] = useState(false);
  useEffect(() => setCalm(!!reduce), [reduce]);
  const step = (d: number) => { setManual(true); setLi(i => (i + d + looks.length) % looks.length); };
  const section = useRef<HTMLElement>(null);
  const gx = useSpring(useMotionValue(0), { stiffness: 40, damping: 18 }), gy = useSpring(useMotionValue(0), { stiffness: 40, damping: 18 });
  // Scroll depth: the wordmark drifts down slowest, the model sinks behind the fold, the copy leaves first.
  useScrollScene(section, root => {
    const st = { trigger: root, start: 'top top', end: 'bottom top', scrub: true };
    gsap.to(root.querySelector('.mz-par-word'), { yPercent: 30, ease: 'none', scrollTrigger: st });
    // Only where the model stands beside the copy; on narrower screens it sits above the headline and would slide over it.
    gsap.matchMedia().add('(min-width: 1100px)', () => {
      gsap.to(root.querySelector('.mz-hero__media'), { y: 80, ease: 'none', scrollTrigger: st });
      gsap.to(root.querySelector('.mz-hero__copy'), { y: -100, opacity: 0, ease: 'none', scrollTrigger: { ...st, start: 'top+=120 top' } });
    });
  });
  // Only claims the shop can keep: the origin city from settings, front-and-back photos, and try-on when the AI is set up.
  const trust: { icon: IconName; text: string }[] = [
    { icon: 'send', text: c.heroShips.replace('{city}', b.tx(b.settings.originCity)) },
    ...(b.garments.length && b.garments.every(g => g.back) ? [{ icon: 'turn' as const, text: c.heroBothSides }] : []),
    ...(b.ai.image || b.ai.free ? [{ icon: 'yourPhoto' as const, text: c.heroTryOn }] : []),
  ];
  const sign = b.dir === 'rtl' ? -1 : 1;

  return (
    <section ref={section} id="top" className="mz-hero"
      onPointerEnter={e => { if (e.pointerType === 'mouse') setHovered(true); }} onPointerLeave={e => { if (e.pointerType === 'mouse') { setHovered(false); gx.set(0); gy.set(0); } }}
      onFocus={e => { if (e.target.matches(':focus-visible')) setFocused(true); }} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}
      onPointerMove={e => { if (reduce || e.pointerType !== 'mouse') return; const r = e.currentTarget.getBoundingClientRect(); gx.set((e.clientX - r.left - r.width / 2) * 0.12); gy.set((e.clientY - r.top - r.height / 2) * 0.08); }}>
      <motion.div className="mz-hero__glow" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ x: gx, y: gy }} transition={{ duration: 1.4, delay: 0.4, ease: EASE }} />
      <div className="mz-par-word"><motion.p className="mz-hero__word" aria-hidden="true" key={b.lang}
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? { duration: 0 } : { duration: 2, ease: EASE, delay: 0.1 }}>{b.dir === 'rtl' ? c.brand1 : 'MAZUN'}</motion.p></div>

      <div className="mz-hero__in">
        <div className="mz-hero__copy">
          <motion.p className="mz-eyebrow is-gold mz-hero__eyebrow" {...rise(1)}><span aria-hidden="true" />{c.eyebrowHero}</motion.p>
          <SplitReveal key={b.lang} as="h1" className="mz-hero__lead" text={c.lead} />
          <motion.p className="mz-hero__sub" {...rise(4)}>{c.sub}</motion.p>
          <motion.div className="mz-hero__ctas" {...rise(5)}>
            <Link href="/collection" className="mz-btn is-light mz-pill">{c.ctaShop}<Icon name="next" size={20} className="mz-arrow" /></Link>
            <a href="#rack" className="mz-btn mz-pill is-ghost">{c.ctaRack}</a>
          </motion.div>
          <motion.div className="mz-hero__nav" {...rise(6)}>
            <p className="mz-hero__count" aria-live={held || calm || manual ? 'polite' : 'off'} aria-atomic="true">
              <span aria-hidden="true">{num(li + 1, b.lang, 2)}</span><span className="mz-hero__dash" aria-hidden="true" /><span aria-hidden="true">{num(looks.length, b.lang, 2)}</span>
              <span className="mz-sr">{`${c.heroSlide} ${num(li + 1, b.lang)} ${c.heroOf} ${num(looks.length, b.lang)}`}</span>
            </p>
            <button type="button" className="mz-reset mz-icon-btn mz-round" aria-label={c.heroPrev} onClick={() => step(-1)}><Icon name="back" size={20} /></button>
            <button type="button" className="mz-reset mz-icon-btn mz-round" aria-label={c.heroNext} onClick={() => step(1)}><Icon name="next" size={20} /></button>
            <button type="button" className="mz-reset mz-icon-btn mz-round mz-hero__pause" aria-label={paused ? c.heroPlay : c.heroPause} onClick={() => setPaused(p => !p)}><Icon name={paused ? 'play' : 'pause'} size={18} /></button>
          </motion.div>
        </div>

        <div className="mz-hero__media">
          <motion.div className="mz-hero__frame" initial={{ opacity: 0, clipPath: 'inset(12% 0 0 0 round 999px 999px 0 0)' }} animate={{ opacity: 1, clipPath: 'inset(0% 0 0 0 round 999px 999px 0 0)' }}
            transition={reduce ? { duration: 0 } : { duration: 1.6, ease: EASE, delay: 0.2 }} aria-hidden="true" />
          {looks.map((m, i) => (
            <motion.img key={m.src} src={m.src} alt={m.alt} aria-hidden={i !== li || undefined} className="mz-hero__model" draggable={false}
              fetchPriority={i === 0 ? 'high' : 'low'} decoding={i === 0 ? 'auto' : 'async'} initial={false}
              animate={{ opacity: i === li ? 1 : 0, scale: i === li ? 1 : 1.03, x: i === li ? 0 : (i < li ? -18 : 18) * sign }}
              transition={reduce ? { duration: 0 } : { opacity: { duration: 1.2, ease: EASE }, default: { duration: 1.6, ease: EASE } }} />
          ))}
        </div>
      </div>

      <motion.ul className="mz-hero__trust" {...rise(7)}>
        {trust.map(t => <li key={t.icon}><Icon name={t.icon} size={22} /><span>{t.text}</span></li>)}
      </motion.ul>
    </section>
  );
}
