'use client';
/* eslint-disable @next/next/no-img-element -- transparent garment cut-outs and sample photographs */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { AnimatePresence, animate, motion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fill } from '@/lib/concierge';
import { effectivePrice } from '@/lib/fit';
import { accessoriesByRole, lookTotal, setFor } from '@/lib/stylist';
import { ACCESSORY_KINDS } from '@/lib/types';
import { useBoutique } from '../boutique/Boutique';
import { useConcierge } from './concierge/useConcierge';
import { FlipCard } from './FlipCard';
import { SplitReveal, useScrollScene } from './fx';
import { Icon, type IconName } from './Icon';
import { Rack } from './Rack';
import { StageHero } from './Stage';
import { Story } from './Story';
import { useShop } from './Shop';
import { EASE, SPRING, cardBg, num, reveal } from './tokens';

/** The home page, try-on first: the stage (turn an abaya, put it on you), the story from the rail to you, the rack,
 *  the size, the set, then the collection. The stylist itself floats over the whole shop. */
export function HomePage() {
  const b = useBoutique();
  // A language change reflows the headings above the pinned story; every scroll scene below must be measured again.
  useEffect(() => { const f = requestAnimationFrame(() => ScrollTrigger.refresh()); return () => cancelAnimationFrame(f); }, [b.lang]);
  return (
    <main className="ai-page">
      <StageHero />
      <Story />
      <Rack />
      <SizeScene />
      <TheSet />
      <Browse />
      <Close />
    </main>
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
            <button type="button" className="mz-reset mz-btn is-ghost mz-pill" onClick={() => { a.findSize(); a.openChat(); }}>{c.aiSizeAskCta}</button>
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
  // On a phone the occasions scroll sideways: keep the chosen one in view, inside the row only (the page stays put).
  const occRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = occRow.current, on = row?.querySelector<HTMLElement>('[aria-pressed=true]');
    if (!row || !on || row.scrollWidth <= row.clientWidth) return;
    const rr = row.getBoundingClientRect(), br = on.getBoundingClientRect();
    row.scrollBy({ left: br.left + br.width / 2 - (rr.left + rr.width / 2), behavior: 'smooth' });
  }, [occ]);
  const g = a.garment;
  const picks = useMemo(() => (g ? setFor(byRole, g, occ) : {}), [byRole, g, occ]);
  const total = g ? lookTotal(g, picks, id => b.byId(id)) : 0;
  const totalEl = useRef<HTMLElement>(null);
  const shown = useRef(total);
  const section = useRef<HTMLElement>(null);
  // Wide screens: the pieces start tucked behind the model and fan out to their places as the board scrolls in.
  useScrollScene(section, root => {
    gsap.matchMedia().add('(min-width: 1000px)', () => {
      const slots = gsap.utils.toArray<HTMLElement>('.ai-fan__slot', root);
      const turn = [-3, 2, -2, 3], lift = [-6, 8, 8, -6];
      slots.forEach((s, i) => {
        const toCentre = (i < 2 ? 1 : -1) * (b.dir === 'rtl' ? -1 : 1);
        gsap.fromTo(s, { xPercent: toCentre * 70, rotate: 0, scale: 0.78, autoAlpha: 0 }, {
          xPercent: 0, rotate: turn[i], y: lift[i], scale: 1, autoAlpha: 1, ease: 'power2.out',
          scrollTrigger: { trigger: root.querySelector('.ai-fan'), start: 'top 85%', end: 'top 35%', scrub: 0.6 },
        });
      });
    });
  }, [b.dir, g?.id]);
  // The total runs to its new value when the occasion changes.
  useEffect(() => {
    const el = totalEl.current;
    if (!el) return;
    const ctl = animate(shown.current, total, { duration: 0.6, ease: EASE, onUpdate: v => { shown.current = v; el.textContent = b.price(Math.round(v)); } });
    return () => ctl.stop();
  }, [total, b]);
  if (!g) return null;
  const items = ACCESSORY_KINDS.map(k => ({ k, p: picks[k] ? b.byId(picks[k]) : undefined }));
  const photo = g.wornFront || g.front;
  const slot = ({ k, p }: (typeof items)[number], i: number) => (
    <div key={k} className={`ai-fan__slot is-${i}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        {p && (
          <motion.div key={p.id} initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ ...SPRING.soft, delay: i * 0.05 }}>
            <button type="button" className="mz-reset ai-item" onClick={() => b.openProduct(p.id)}>
              <span className="ai-item__pic">{p.front && <img src={p.front} alt="" loading="lazy" decoding="async" />}</span>
              <span className="ai-item__role">{b.t.roles[k]}</span>
              <span className="ai-item__name">{b.tx(p.name)}</span>
              <span className="ai-item__price">{b.price(effectivePrice(p))}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
  return (
    <section ref={section} id="set" className="ai-sec ai-set">
      <div className="ai-wrap">
        <motion.div className="ai-set__head" {...reveal}>
          <div className="ai-copy">
            <p className="ai-eyebrow">{c.aiSetK}</p>
            <SplitReveal className="ai-h2" text={c.aiSetT} />
            <p className="ai-body">{c.aiSetB}</p>
          </div>
          <div ref={occRow} className="ai-occ" role="group" aria-label={c.aiSetOccasion}>
            {b.t.occ.map((l, i) => <button key={l} type="button" className="mz-reset" aria-pressed={occ === i} onClick={() => setOcc(i)}>{l}</button>)}
          </div>
        </motion.div>
        {/* The look: the abaya in the middle, its pieces fanned out on either side. On wide screens they open out from
            behind the model as the board scrolls in (GSAP moves the slots; Motion swaps what is in them). */}
        <div className="ai-fan">
          <div className="ai-fan__side">{items.slice(0, 2).map((x, i) => slot(x, i))}</div>
          <div className="ai-fan__model" style={{ background: cardBg(g.colors[0]?.hex) }}>
            {photo && <img src={photo} alt={`${c.wearing} ${b.tx(g.name)}`} loading="lazy" decoding="async" draggable={false} />}
          </div>
          <div className="ai-fan__side">{items.slice(2).map((x, i) => slot(x, i + 2))}</div>
        </div>
        <div className="ai-set__foot">
          <p className="ai-total is-big"><span>{c.aiTotal}</span><strong ref={totalEl}>{b.price(total)}</strong></p>
          <div className="ai-ctas">
            <button type="button" className="mz-reset mz-btn is-main mz-pill" onClick={() => a.addLook(picks)}><Icon name="bag" size={20} />{c.aiAddLook}</button>
            <button type="button" className="mz-reset mz-btn mz-pill is-line" onClick={() => { a.offerSet(occ); a.openChat(); }}>{c.aiSetAsk}</button>
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
        <form className="ai-input is-large" onSubmit={e => { e.preventDefault(); const t = v.trim(); if (!t) return; setV(''); a.ask(t); a.openChat(); }}>
          <input value={v} dir={v ? 'auto' : undefined} maxLength={400} autoComplete="off" aria-label={c.aiPlaceholder} placeholder={c.aiPlaceholder} onChange={e => setV(e.target.value)} />
          <button type="submit" className="mz-reset ai-send" aria-label={c.aiSend} disabled={!v.trim()}><Icon name="send" size={20} /></button>
        </form>
        <ul className="ai-facts">
          {facts.map(f => <li key={f.text}><Icon name={f.icon} size={18} />{f.text}</li>)}
        </ul>
      </motion.div>
    </section>
  );
}
