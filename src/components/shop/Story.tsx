'use client';
/* eslint-disable @next/next/no-img-element -- transparent cut-outs and the sample try-on photographs */
import gsap from 'gsap';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useBoutique } from '../boutique/Boutique';
import { useConcierge } from './concierge/useConcierge';
import { SplitReveal, useScrollScene } from './fx';
import { Icon } from './Icon';
import { useShop } from './Shop';
import { num } from './tokens';

/** Pieces with a sample try-on (public/images/tryon): the same customer photo, dressed in that piece by the AI. */
const SAMPLES = [{ id: 'noor', after: '/images/tryon/customer-noor.webp' }, { id: 'layal', after: '/images/tryon/customer-layal.webp' }];
const BEFORE = '/images/tryon/customer.webp';

/** "From the rail to you": one abaya in three steps — on its hanger, worn by a house model, then on the customer's own
 *  photo, wiped from before to after. With motion allowed the section pins and the scroll plays the steps, each turning
 *  away in depth as the next turns in; otherwise (and before the script runs) the three stand side by side and every
 *  step reads as current. GSAP moves the figures; React only marks which step is current. */
export function Story() {
  const b = useBoutique();
  const { c } = useShop();
  const a = useConcierge();
  const sample = SAMPLES.find(s => b.byId(s.id)?.wornFront);
  const g = sample ? b.byId(sample.id) : undefined;
  const section = useRef<HTMLElement>(null);
  // null: no scene (reduced motion, or before the script runs), so no step is dimmed.
  const [step, setStep] = useState<number | null>(null);
  const stepRef = useRef<number | null>(null);
  const mark = (i: number | null) => { if (stepRef.current !== i) { stepRef.current = i; setStep(i); } };

  useScrollScene(section, root => {
    root.classList.add('is-scene');
    mark(0);
    const layers = gsap.utils.toArray<HTMLElement>('.st-layer', root);
    const after = root.querySelector<HTMLElement>('.st-you__after'), inner = root.querySelector<HTMLElement>('.st-you__after-in');
    gsap.set(layers.slice(1), { autoAlpha: 0, rotateY: 28, xPercent: 12, z: -160 });
    // The wipe is two opposite slides (the window in from the right, the picture held in place inside it): transforms only.
    if (after && inner) { gsap.set(after, { xPercent: 100 }); gsap.set(inner, { xPercent: -100 }); }
    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut', duration: 1 },
      scrollTrigger: {
        trigger: root, pin: root.querySelector('.st-story__pin'), start: 'top top', end: '+=200%', scrub: 0.6,
        // Pinned before the scenes below are measured, so their starts include this pin's length.
        refreshPriority: 1, invalidateOnRefresh: true,
        // The step whose picture holds the frame: each hand-over is half done at its midpoint on the timeline.
        onUpdate: s => { const t = s.progress * tl.duration(); mark(t < 0.5 ? 0 : t < 1.8 ? 1 : 2); },
      },
    });
    for (let i = 0; i < layers.length - 1; i++) {
      tl.to(layers[i], { autoAlpha: 0, rotateY: -28, xPercent: -12, z: -160 }, i * 1.3)
        .to(layers[i + 1], { autoAlpha: 1, rotateY: 0, xPercent: 0, z: 0 }, i * 1.3);
    }
    if (after && inner) {
      const at = tl.duration() + 0.2;
      tl.to(after, { xPercent: 0, duration: 1.2, ease: 'power1.inOut' }, at).to(inner, { xPercent: 0, duration: 1.2, ease: 'power1.inOut' }, at);
    }
    tl.fromTo(root.querySelector('.st-story__bar span'), { scaleY: 0 }, { scaleY: 1, ease: 'none', duration: tl.duration() }, 0);
    return () => { root.classList.remove('is-scene'); mark(null); };
  }, [g?.id]);

  if (!g || !sample) return null;
  const name = b.tx(g.name);
  const steps = [
    { t: c.story1T, d: c.story1B },
    { t: c.story2T, d: c.story2B },
    { t: c.story3T, d: c.story3B, note: c.aiWearSample },
  ];

  return (
    <section ref={section} id="wear" className="st-story">
      <div className="st-story__pin">
        <div className="st-story__in">
          <div className="st-story__copy">
            <p className="ai-eyebrow">{c.storyK}</p>
            <SplitReveal className="ai-h2" text={c.storyT} />
            <div className="st-story__steps">
              <span className="st-story__bar" aria-hidden="true"><span /></span>
              <ol>
                {steps.map((s, i) => (
                  <li key={i} className={`st-step${step === null || step === i ? ' is-on' : ''}`} aria-current={step === i ? 'step' : undefined}>
                    <span className="st-step__n" aria-hidden="true">{num(i + 1, b.lang, 2)}</span>
                    <span className="st-step__t">{s.t}</span>
                    <span className="st-step__d">{s.d}{s.note && <small className="st-step__note">{s.note}</small>}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="ai-ctas">
              <Link href={`/fitting-room?g=${g.id}`} className="mz-btn is-main mz-pill">{c.aiWearPhoto}<Icon name="next" size={20} className="mz-arrow" /></Link>
              <Link href={`/fitting-room?g=${g.id}&live=1`} className="mz-btn mz-pill is-line"><Icon name="camera" size={20} />{c.aiWearLive}</Link>
            </div>
            <button type="button" className="mz-reset mz-link is-main st-story__size" onClick={() => { a.findSize(); a.openChat(); }}><Icon name="ruler" size={18} />{c.storySize}</button>
          </div>

          <div className="st-story__frame" dir="ltr">
            <figure className="st-layer is-rail">
              <span className="st-layer__ground" aria-hidden="true" />
              <img className="st-layer__hanger" src="/images/hanger.webp" alt="" draggable={false} loading="lazy" decoding="async" />
              <img className="st-layer__cloth" src={g.front} alt={`${name} — ${c.story1T}`} draggable={false} loading="lazy" decoding="async" />
              <figcaption>{num(1, b.lang, 2)} · {c.story1T}</figcaption>
            </figure>
            <figure className="st-layer is-worn">
              <span className="st-layer__ground" aria-hidden="true" />
              <img className="st-layer__model" src={g.wornFront} alt={`${c.wearing} ${name}`} draggable={false} loading="lazy" decoding="async" />
              <figcaption>{num(2, b.lang, 2)} · {c.story2T}</figcaption>
            </figure>
            <figure className="st-layer is-you">
              <img className="st-layer__photo" src={BEFORE} alt={c.aiWearAltBefore} draggable={false} loading="lazy" decoding="async" />
              <span className="st-you__after">
                <span className="st-you__after-in"><img className="st-layer__photo" src={sample.after} alt={`${c.aiWearAltAfter} ${name}`} draggable={false} loading="lazy" decoding="async" /></span>
                <span className="st-you__edge" aria-hidden="true" />
              </span>
              <figcaption>{num(3, b.lang, 2)} · {c.story3T}</figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}
