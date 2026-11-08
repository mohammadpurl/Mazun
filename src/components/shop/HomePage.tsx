'use client';
/* eslint-disable @next/next/no-img-element -- transparent garment cut-outs and sample photographs */
import gsap from 'gsap';
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from 'motion/react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fill } from '@/lib/concierge';
import { effectivePrice } from '@/lib/fit';
import { accessoriesByRole, lookTotal, presetPicks } from '@/lib/stylist';
import { ACCESSORY_KINDS } from '@/lib/types';
import { useBoutique } from '../boutique/Boutique';
import { BodyScan } from './concierge/BodyScan';
import { Chat } from './concierge/Chat';
import { ConciergeProvider, useConcierge } from './concierge/useConcierge';
import { FlipCard } from './FlipCard';
import { SplitReveal, useScrollScene } from './fx';
import { Icon, type IconName } from './Icon';
import { useShop } from './Shop';
import { EASE, SPRING, cardBg, num, reveal } from './tokens';

/** The home page is the product: a working conversation first, then each thing the stylist does, shown doing it. */
export function HomePage() {
  return (
    <ConciergeProvider>
      <main className="ai-page">
        <Hero />
        <Wear />
        <SizeScene />
        <TheSet />
        <Browse />
        <Close />
      </main>
      <Dock />
      <BodyScan />
    </ConciergeProvider>
  );
}

const rise = (i: number) => ({ initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { ...SPRING.soft, delay: 0.07 * i } });

function Hero() {
  const b = useBoutique();
  const { c } = useShop();
  const a = useConcierge();
  const reduce = useReducedMotion();
  const g = a.garment;
  const photo = g?.wornFront || g?.front;
  const set = ACCESSORY_KINDS.filter(k => a.picks[k]).length;
  const steps: { label: string; href: string; icon: IconName }[] = [
    { label: c.aiStepTalk, href: '#talk', icon: 'chat' },
    { label: c.aiStepWear, href: '#wear', icon: 'yourPhoto' },
    { label: c.aiStepSize, href: '#size', icon: 'ruler' },
    { label: c.aiStepSet, href: '#set', icon: 'handbag' },
  ];
  return (
    <section id="talk" className="ai-hero">
      <div className="ai-hero__head">
        <motion.p className="ai-eyebrow" {...rise(1)}>{c.aiEyebrow}</motion.p>
        <SplitReveal key={b.lang} as="h1" className="ai-h1" text={c.aiH1} />
        <motion.p className="ai-hero__sub" {...rise(3)}>{c.aiSub}</motion.p>
      </div>

      <div className="ai-stage" style={{ background: cardBg(g?.colors[0]?.hex) }}>
        <span className="ai-stage__floor" aria-hidden="true" />
        <AnimatePresence initial={false}>
          {photo && (
            <motion.img key={photo} src={photo} alt={g ? `${c.wearing} ${b.tx(g.name)}` : ''} className="ai-stage__model" draggable={false} fetchPriority="high"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 26, scale: 1.02 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: EASE }} />
          )}
        </AnimatePresence>
        <div className="ai-stage__tags">
          <AnimatePresence>
            {a.sized && a.sized.garmentId === g?.id && (
              <motion.span key="size" className="ai-tag" initial={{ opacity: 0, y: 10, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={SPRING.soft}>
                <Icon name="ruler" size={16} />{c.aiStepSize}<b dir="ltr">{a.sized.rec.size}</b>
              </motion.span>
            )}
            {a.reached >= 4 && set > 0 && (
              <motion.span key="set" className="ai-tag" initial={{ opacity: 0, y: 10, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={SPRING.soft}>
                <Icon name="handbag" size={16} />{c.aiStepSet}<b>+{num(set, b.lang)}</b>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <Chat />

      <nav className="ai-rail" aria-label={c.aiStepsLabel}>
        <ol>
          {steps.map((s, i) => (
            <li key={s.href} className={a.reached > i ? 'is-on' : undefined}>
              <a href={s.href} onClick={i === 0 ? e => { e.preventDefault(); a.takeOver(); } : undefined}>
                <Icon name={s.icon} size={18} /><span>{s.label}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </section>
  );
}

/** Sample pairs: the customer photo beside the abaya the stylist dressed her in (public/images/tryon). */
const SAMPLES = [{ id: 'noor', src: '/images/tryon/customer-noor.webp' }, { id: 'layal', src: '/images/tryon/customer-layal.webp' }];

function Wear() {
  const b = useBoutique();
  const { c } = useShop();
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const pos = useMotionValue(reduce ? 50 : 88);
  const clip = useTransform(pos, v => `inset(0 0 0 ${v}%)`);
  const left = useTransform(pos, v => `${v}%`);
  const [val, setVal] = useState(50);
  useMotionValueEvent(pos, 'change', v => setVal(Math.round(v)));
  const hinted = useRef(false);
  const hint = () => {
    if (hinted.current || reduce) return;
    hinted.current = true;
    animate(pos, 42, { duration: 1.6, ease: EASE, delay: 0.2 });
  };
  const sample = SAMPLES[i];
  const g = b.byId(sample.id);
  return (
    <section id="wear" className="ai-sec ai-wear">
      <div className="ai-wrap ai-split">
        <motion.div className="ai-copy" {...reveal}>
          <p className="ai-eyebrow">{c.aiWearK}</p>
          <SplitReveal className="ai-h2" text={c.aiWearT} />
          <p className="ai-body">{c.aiWearB}</p>
          <div className="ai-swatches" role="group" aria-label={c.aiWearPick}>
            {SAMPLES.map((s, n) => {
              const piece = b.byId(s.id);
              return (
                <button key={s.id} type="button" className="mz-reset ai-swatch" aria-pressed={n === i} aria-label={piece ? b.tx(piece.name) : s.id} title={piece ? b.tx(piece.name) : undefined} onClick={() => setI(n)}>
                  {piece?.front && <img src={piece.front} alt="" loading="lazy" decoding="async" />}
                </button>
              );
            })}
          </div>
          <div className="ai-ctas">
            <Link href={`/fitting-room?g=${sample.id}`} className="mz-btn is-main mz-pill">{c.aiWearPhoto}<Icon name="next" size={20} className="mz-arrow" /></Link>
            <Link href={`/fitting-room?g=${sample.id}&live=1`} className="mz-btn mz-pill is-line"><Icon name="camera" size={20} />{c.aiWearLive}</Link>
          </div>
        </motion.div>
        <motion.div className="ai-compare" dir="ltr" onViewportEnter={hint} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.35 }} transition={SPRING.soft}>
          <img src="/images/tryon/customer.webp" alt={c.aiWearAltBefore} loading="lazy" decoding="async" draggable={false} />
          <AnimatePresence initial={false}>
            <motion.div key={sample.src} className="ai-compare__after" style={{ clipPath: clip }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
              <img src={sample.src} alt={`${c.aiWearAltAfter} ${g ? b.tx(g.name) : ''}`} loading="lazy" decoding="async" draggable={false} />
            </motion.div>
          </AnimatePresence>
          <motion.span className="ai-compare__line" style={{ left }} aria-hidden="true"><span><Icon name="swap" size={20} /></span></motion.span>
          <span className="ai-compare__tag is-before" aria-hidden="true">{c.aiWearBefore}</span>
          <span className="ai-compare__tag is-after" aria-hidden="true">{c.aiWearAfter}</span>
          <span className="ai-compare__tag is-sample">{c.aiWearSample}</span>
          <input type="range" min={4} max={96} value={val} aria-label={c.aiWearDrag} onChange={e => pos.set(Number(e.target.value))} />
        </motion.div>
      </div>
    </section>
  );
}

/** The measured figure, from a house photo: where the scan reads her, in the photo's own pixels. */
const FIGURE = { src: '/images/worn/noor-front.webp', w: 379, h: 997 };
const READINGS = { height: 168, shoulder: 37, bust: 91, size: 'M' };

function SizeScene() {
  const b = useBoutique();
  const { c } = useShop();
  const a = useConcierge();
  const section = useRef<HTMLElement>(null);
  useScrollScene(section, root => {
    // Plays once on arrival, so a visitor who jumps here from the menu still sees the whole reading.
    const tl = gsap.timeline({ scrollTrigger: { trigger: root.querySelector('.ai-split'), start: 'top 70%', once: true }, defaults: { ease: 'power2.out' } });
    tl.fromTo(root.querySelectorAll('.ai-figure [pathLength]'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, stagger: 0.28, duration: 0.8 }, 0)
      .fromTo(root.querySelectorAll('.ai-figure circle'), { scale: 0, transformOrigin: 'center', transformBox: 'fill-box' }, { scale: 1, stagger: 0.1, duration: 0.35 }, 0.3);
    root.querySelectorAll<HTMLElement>('[data-count]').forEach((el, i) => {
      const end = Number(el.dataset.count), proxy = { v: 0 };
      tl.fromTo(proxy, { v: 0 }, { v: end, duration: 0.8, onUpdate: () => { el.textContent = num(Math.round(proxy.v), b.lang); } }, 0.25 + 0.25 * i);
    });
    tl.fromTo(root.querySelector('.ai-readout__size'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5 }, 1.3);
  }, [b.lang]);
  const rows = [
    { label: c.aiSizeHeight, v: READINGS.height },
    { label: c.aiSizeShoulder, v: READINGS.shoulder },
    { label: c.aiSizeBust, v: READINGS.bust },
  ];
  return (
    <section ref={section} id="size" className="ai-sec ai-size-sec">
      <div className="ai-wrap ai-split is-flip">
        <div className="ai-figure">
          <div className="ai-figure__in" style={{ aspectRatio: `${FIGURE.w} / ${FIGURE.h}` }}>
            <img src={FIGURE.src} alt="" loading="lazy" decoding="async" draggable={false} />
            <svg viewBox={`0 0 ${FIGURE.w} ${FIGURE.h}`} aria-hidden="true">
              <path d="M26 10V985M14 10H38M14 985H38" pathLength={1} strokeDasharray="1" />
              <path d="M112 196H268" pathLength={1} strokeDasharray="1" />
              <path d="M124 262H256" pathLength={1} strokeDasharray="1" />
              {[[112, 196], [268, 196], [124, 262], [256, 262]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={6} />)}
            </svg>
          </div>
        </div>
        <motion.div className="ai-copy" {...reveal}>
          <p className="ai-eyebrow is-light">{c.aiSizeK}</p>
          <SplitReveal className="ai-h2 is-light" text={c.aiSizeT} />
          <p className="ai-body is-light">{c.aiSizeB}</p>
          <dl className="ai-readout" aria-label={c.aiSizeSample}>
            {rows.map(r => (
              <div key={r.label}><dt>{r.label}</dt><dd><span data-count={r.v}>{num(r.v, b.lang)}</span> <small>{c.aiSizeCm}</small></dd></div>
            ))}
            <div className="ai-readout__size"><dt>{c.aiSizeFit}</dt><dd dir="ltr">{READINGS.size}</dd></div>
          </dl>
          <p className="ai-sample-note">{c.aiSizeSample}</p>
          <div className="ai-ctas">
            <button type="button" className="mz-reset mz-btn is-light mz-pill" onClick={() => a.setScanning(true)}><Icon name="camera" size={20} />{c.aiSizeScanCta}</button>
            <button type="button" className="mz-reset mz-btn is-ghost mz-pill" onClick={() => { a.findSize(); a.focusInput(); }}>{c.aiSizeAskCta}</button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function TheSet() {
  const b = useBoutique();
  const { c } = useShop();
  const a = useConcierge();
  const byRole = useMemo(() => accessoriesByRole(b.products), [b.products]);
  const [occ, setOcc] = useState(a.occasion);
  // The occasion she named in the conversation carries down to the board.
  useEffect(() => setOcc(a.occasion), [a.occasion]);
  const picks = useMemo(() => presetPicks(byRole, occ), [byRole, occ]);
  const g = a.garment;
  const total = g ? lookTotal(g, picks, id => b.byId(id)) : 0;
  const totalEl = useRef<HTMLElement>(null);
  const shown = useRef(total);
  // The total runs to its new value when the occasion changes.
  useEffect(() => {
    const el = totalEl.current;
    if (!el) return;
    const ctl = animate(shown.current, total, { duration: 0.6, ease: EASE, onUpdate: v => { shown.current = v; el.textContent = b.price(Math.round(v)); } });
    return () => ctl.stop();
  }, [total, b]);
  if (!g) return null;
  const items = ACCESSORY_KINDS.map(k => ({ k, p: picks[k] ? b.byId(picks[k]) : undefined })).filter(x => x.p);
  const photo = g.wornFront || g.front;
  return (
    <section id="set" className="ai-sec ai-set">
      <div className="ai-wrap">
        <motion.div className="ai-set__head" {...reveal}>
          <div className="ai-copy">
            <p className="ai-eyebrow">{c.aiSetK}</p>
            <SplitReveal className="ai-h2" text={c.aiSetT} />
            <p className="ai-body">{c.aiSetB}</p>
          </div>
          <div className="ai-occ" role="group" aria-label={c.aiSetOccasion}>
            {b.t.occ.map((l, i) => <button key={l} type="button" className="mz-reset" aria-pressed={occ === i} onClick={() => setOcc(i)}>{l}</button>)}
          </div>
        </motion.div>
        <div className="ai-board">
          <motion.div className="ai-board__model" style={{ background: cardBg(g.colors[0]?.hex) }} {...reveal}>
            {photo && <img src={photo} alt={`${c.wearing} ${b.tx(g.name)}`} loading="lazy" decoding="async" draggable={false} />}
          </motion.div>
          <ul className="ai-board__items">
            <AnimatePresence mode="popLayout" initial={false}>
              {items.map(({ k, p }, i) => (
                <motion.li key={p!.id} layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ ...SPRING.soft, delay: i * 0.05 }}>
                  <button type="button" className="mz-reset ai-item" onClick={() => b.openProduct(p!.id)}>
                    <span className="ai-item__pic">{p!.front && <img src={p!.front} alt="" loading="lazy" decoding="async" />}</span>
                    <span className="ai-item__role">{b.t.roles[k]}</span>
                    <span className="ai-item__name">{b.tx(p!.name)}</span>
                    <span className="ai-item__price">{b.price(effectivePrice(p!))}</span>
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
        <div className="ai-set__foot">
          <p className="ai-total is-big"><span>{c.aiTotal}</span><strong ref={totalEl}>{b.price(total)}</strong></p>
          <div className="ai-ctas">
            <button type="button" className="mz-reset mz-btn is-main mz-pill" onClick={() => a.addLook(picks)}><Icon name="bag" size={20} />{c.aiAddLook}</button>
            <Link href={`/stylist?g=${encodeURIComponent(g.id)}`} className="mz-btn mz-pill is-line">{c.aiSetAsk}</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Browse() {
  const b = useBoutique();
  const { c } = useShop();
  return (
    <section className="ai-sec ai-browse">
      <div className="ai-wrap">
        <motion.div className="ai-browse__head" {...reveal}>
          <SplitReveal className="ai-h2" text={c.aiColT} />
          <Link href="/collection" className="mz-link is-main">{c.aiColAll}<Icon name="next" size={18} /></Link>
        </motion.div>
        <div className="mz-grid">
          {b.garments.slice(0, 4).map((g, i) => (
            <motion.div key={g.id} initial={{ opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ ...SPRING.soft, delay: i * 0.07 }}>
              <FlipCard g={g} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Close() {
  const b = useBoutique();
  const { c } = useShop();
  const a = useConcierge();
  const [v, setV] = useState('');
  const facts: { icon: IconName; text: string }[] = [
    { icon: 'lock', text: c.aiFact1 },
    { icon: 'ruler', text: c.aiFact2 },
    { icon: 'send', text: fill(c.aiFact3, { city: b.tx(b.settings.originCity) }) },
  ];
  return (
    <section id="ask" className="ai-sec ai-close">
      <motion.div className="ai-close__in" {...reveal}>
        <SplitReveal className="ai-h2" text={c.aiCloseT} />
        <form className="ai-input is-large" onSubmit={e => { e.preventDefault(); const t = v.trim(); if (!t) return; setV(''); a.ask(t); a.focusInput(); }}>
          <input value={v} maxLength={400} autoComplete="off" aria-label={c.aiPlaceholder} placeholder={c.aiPlaceholder} onChange={e => setV(e.target.value)} />
          <button type="submit" className="mz-reset ai-send" aria-label={c.aiSend} disabled={!v.trim()}><Icon name="send" size={20} /></button>
        </form>
        <ul className="ai-facts">
          {facts.map(f => <li key={f.text}><Icon name={f.icon} size={18} />{f.text}</li>)}
        </ul>
      </motion.div>
    </section>
  );
}

/** Past the hero the stylist stays one tap away; the closing section has its own field, so the dock steps aside there. */
function Dock() {
  const { c } = useShop();
  const a = useConcierge();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    const seen = new Map<Element, boolean>();
    const io = new IntersectionObserver(es => {
      es.forEach(e => seen.set(e.target, e.isIntersecting));
      setHidden([...seen.values()].some(Boolean));
    }, { threshold: 0.12 });
    for (const id of ['talk', 'ask']) { const el = document.getElementById(id); if (el) io.observe(el); }
    return () => io.disconnect();
  }, []);
  return (
    <AnimatePresence>
      {!hidden && !a.scanning && (
        <motion.button type="button" className="mz-reset ai-dock" onClick={a.focusInput} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={SPRING.soft} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
          <Icon name="chat" size={20} />{c.aiDock}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
