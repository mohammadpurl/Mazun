'use client';
/* eslint-disable @next/next/no-img-element -- transparent garment cut-outs from the catalogue */
import gsap from 'gsap';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { effectivePrice } from '@/lib/fit';
import type { Garment } from '@/lib/types';
import { useBoutique } from '../boutique/Boutique';
import { productHref } from './Chrome';
import { FlipCard } from './FlipCard';
import { Ornament, SplitReveal, useScrollScene } from './fx';
import { Icon, type DuoIconName, type IconName } from './Icon';
import { useShop } from './Shop';
import { EASE, SPRING, isPale, num, railOrder, reveal } from './tokens';

export function HomePage() {
  return (
    <main>
      <Hero />
      <Collection />
      <Craft />
      <Rack />
      <TryTeaser />
    </main>
  );
}

const rise = (i: number) => ({ initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { ...SPRING.soft, delay: 0.08 * i } });

/** House model photos for the hero, cut out on transparent ground (public/images/models). */
const HERO_MODELS = [
  { src: '/images/models/olive.webp', alt: 'heroAltOlive' },
  { src: '/images/models/black.webp', alt: 'heroAltBlack' },
] as const;

/** Hero: an editorial cover. The headline sits beside a house model; the photos crossfade every 7 s, held on hover,
 *  on keyboard focus and by the pause button. */
function Hero() {
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
            <a href="#collection" className="mz-btn is-light mz-pill">{c.ctaShop}<Icon name="next" size={20} className="mz-arrow" /></a>
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

function Collection() {
  const b = useBoutique();
  const { c } = useShop();
  return (
    <section id="collection" className="mz-collection">
      <div className="mz-wrap">
        <motion.div className="mz-head" {...reveal}>
          <div>
            <p className="mz-eyebrow">{c.colEyebrow}</p>
            <SplitReveal className="mz-h2" text={c.colTitle} />
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

/** The brass rail: each abaya hangs side-on (74°) and turns to show its back (180°) on hover or tap; on a wide
 *  screen the pieces also turn one after another as the rail scrolls past. Focus names the piece in the caption. */
/** How far (px) the 1st, 2nd and 3rd neighbours step aside from a turning garment. */
const NUDGE = [62, 26, 10];

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

/** Close-ups on the dark brand ground: three crops of the photographs drift at different depths as the page scrolls. */
function Craft() {
  const b = useBoutique();
  const { c } = useShop();
  const section = useRef<HTMLElement>(null);
  useScrollScene(section, root => {
    const st = { trigger: root, start: 'top bottom', end: 'bottom top', scrub: true };
    gsap.fromTo(root.querySelector('.mz-craft__pic.is-a'), { y: 60 }, { y: -60, ease: 'none', scrollTrigger: st });
    gsap.fromTo(root.querySelector('.mz-craft__pic.is-b'), { y: 140 }, { y: -140, ease: 'none', scrollTrigger: st });
    gsap.fromTo(root.querySelector('.mz-craft__pic.is-c'), { y: 20 }, { y: -100, ease: 'none', scrollTrigger: st });
  });
  const alt = { a: b.lang === 'en' ? 'Gold embroidery' : b.lang === 'ar' ? 'تطريز ذهبي' : 'گلدوزی طلایی', b: b.lang === 'en' ? 'Lace hem' : b.lang === 'ar' ? 'حاشية دانتيل' : 'لبهٔ توری', c: b.lang === 'en' ? 'Pleats' : b.lang === 'ar' ? 'بليسيه' : 'پلیسه' };
  return (
    <section ref={section} className="mz-craft" aria-labelledby="mz-craft-h">
      <div className="mz-wrap mz-craft__in">
        <motion.div className="mz-craft__copy" {...reveal}>
          <p className="mz-eyebrow is-gold">{c.craftEyebrow}</p>
          <SplitReveal className="mz-h2 is-light" text={c.craftTitle} />
          <span id="mz-craft-h" className="mz-sr">{c.craftTitle}</span>
          <Ornament className="is-start" />
          <p className="mz-craft__body">{c.craftBody}</p>
          <a href="#collection" className="mz-link is-light">{c.craftLink}<Icon name="next" size={18} /></a>
        </motion.div>
        <div className="mz-craft__pics">
          <figure className="mz-craft__pic is-a"><img src="/images/details/embroidery.webp" alt={alt.a} loading="lazy" /></figure>
          <figure className="mz-craft__pic is-b"><img src="/images/details/lace.webp" alt={alt.b} loading="lazy" /></figure>
          <figure className="mz-craft__pic is-c"><img src="/images/details/pleats.webp" alt={alt.c} loading="lazy" /></figure>
        </div>
      </div>
    </section>
  );
}

function TryTeaser() {
  const b = useBoutique();
  const { c, picks, togglePick } = useShop();
  const icons: DuoIconName[] = ['yourPhoto', 'hanger', 'compare'];
  const model = b.garments.find(g => g.front && isPale(g.colors[0]?.hex)) ?? b.garments[0];
  const picked = picks.map(id => b.byId(id)).filter((g): g is Garment => !!g);
  return (
    <section id="tryon" className="mz-try">
      <div className="mz-try__in">
        <motion.div className="mz-try__copy" {...reveal}>
          <p className="mz-eyebrow is-icon"><Icon name="hanger" size={20} />{c.tryEyebrow}</p>
          <SplitReveal className="mz-h2 is-small" text={c.tryTitle} />
          <p className="mz-body">{c.tryBody}</p>
          <ol className="mz-steps">
            {c.trySteps.map((s, i) => (
              <motion.li key={s} initial={{ opacity: 0, x: b.dir === 'rtl' ? 16 : -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ ...SPRING.soft, delay: 0.1 * i }}>
                <span className="mz-chip"><Icon name={icons[i]} weight="duotone" /></span><span className="mz-steps__n">{num(i + 1, b.lang)}</span>{s}
              </motion.li>
            ))}
          </ol>
          <div><Link href="/fitting-room" className="mz-btn is-main">{c.openRoom}<Icon name="next" size={20} className="mz-arrow" /></Link></div>
          <div className="mz-picks">
            <p>{c.yourPicks} · {num(picked.length, b.lang)}</p>
            <div className="mz-picks__row">
              <AnimatePresence>
                {picked.map(g => (
                  <motion.button key={g.id} type="button" className="mz-reset mz-picks__item" aria-label={`${c.remove} ${b.tx(g.name)}`} title={`${c.remove} ${b.tx(g.name)}`} onClick={() => togglePick(g.id)}
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={SPRING.soft} layout>
                    {g.front && <img src={g.front} alt="" loading="lazy" decoding="async" />}
                  </motion.button>
                ))}
              </AnimatePresence>
              {picked.length === 0 && <span className="mz-picks__empty"><Icon name="hanger" size={18} />{c.tapHanger}</span>}
            </div>
          </div>
        </motion.div>
        <motion.div className="mz-try__visual" {...reveal}>
          <div className="mz-try__col">
            <div className="mz-try__photo"><Icon name="person" className="is-big" /><Icon name="yourPhoto" /></div>
            <span>{c.yourPhoto}</span>
          </div>
          <span className="mz-try__arrow" aria-hidden="true"><Icon name="next" /></span>
          <div className="mz-try__col">
            <motion.div className="mz-try__result" role="img" aria-label={model ? `${c.wearing} ${b.tx(model.name)}` : c.preview}
              whileHover={{ y: -6, rotateY: b.dir === 'rtl' ? 6 : -6 }} transition={SPRING.soft}>
              <span className="mz-try__head" /><span className="mz-try__neck" />
              {model?.front && <img src={model.front} alt="" loading="lazy" decoding="async" />}
            </motion.div>
            <span className="is-ink">{c.preview}</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
