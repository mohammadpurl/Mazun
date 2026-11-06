'use client';
/* eslint-disable @next/next/no-img-element -- transparent garment cut-outs from the catalogue */
import { motion, useAnimate, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { effectivePrice } from '@/lib/fit';
import type { Garment } from '@/lib/types';
import { useBoutique } from '../boutique/Boutique';
import { productHref } from './Chrome';
import { Icon } from './Icon';
import { useShop } from './Shop';
import { SPRING, cardBg } from './tokens';

/** A product card that turns in 3D to show the back. With a mouse it turns on hover, tilts toward the pointer under a
 *  moving glare, and a click opens the product; on touch and with the keyboard a tap or Enter turns it. The floor
 *  shadow narrows while the card is edge-on, so the turn reads as solid. The hanger sends the piece to the fitting room. */
export function FlipCard({ g, compact }: { g: Garment; compact?: boolean }) {
  const b = useBoutique();
  const { c, picks, togglePick } = useShop();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [turned, setTurned] = useState(false);
  const [hover, setHover] = useState(false);
  const pointer = useRef('');
  const on = turned || hover;
  const name = b.tx(g.name);
  const picked = picks.includes(g.id);
  const price = effectivePrice(g);
  const colour = g.colors[0];
  // A model wearing the piece when there is one; otherwise the flat cut-out.
  const worn = !!g.wornFront;
  const front = g.wornFront || g.front, back = g.wornBack || g.back || g.front;
  const px = useMotionValue(0.5), py = useMotionValue(0.5);
  const rotX = useSpring(useTransform(py, [0, 1], [7, -7]), { stiffness: 150, damping: 18 });
  const rotY = useSpring(useTransform(px, [0, 1], [-7, 7]), { stiffness: 150, damping: 18 });
  const glare = useMotionTemplate`radial-gradient(circle at ${useTransform(px, v => v * 100)}% ${useTransform(py, v => v * 100)}%, rgba(255,255,255,.38), rgba(255,255,255,0) 55%)`;
  const [shadow, animate] = useAnimate();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!reduce) animate(shadow.current, { scaleX: [1, 0.45, 1], opacity: [1, 0.55, 1] }, { duration: 1.1, ease: 'easeInOut' });
  }, [on, reduce, animate, shadow]);

  return (
    <article className={`mz-card${compact ? ' is-compact' : ''}${worn ? ' is-worn' : ''}`}>
      {/* The style is the same on server and client; under reduced motion the tilt values simply never move. Hover
          sits on the whole media, so reaching for the hanger button keeps the back in view. */}
      <motion.div className="mz-card__media" style={{ rotateX: rotX, rotateY: rotY, transformPerspective: 900 }}
        onHoverStart={() => setHover(true)} onHoverEnd={() => setHover(false)} whileHover={{ y: -6 }} transition={SPRING.soft}
        onPointerMove={e => { if (reduce || e.pointerType !== 'mouse') return; const r = e.currentTarget.getBoundingClientRect(); px.set((e.clientX - r.left) / r.width); py.set((e.clientY - r.top) / r.height); }}
        onPointerLeave={() => { px.set(0.5); py.set(0.5); }}>
        <button type="button" className="mz-reset mz-card__btn" aria-pressed={turned} aria-label={`${c.turnLabel} ${name}`}
          style={{ background: cardBg(colour?.hex) }}
          onPointerDown={e => { pointer.current = e.pointerType; }}
          onClick={() => { if (pointer.current === 'mouse') router.push(productHref(g.id)); else setTurned(t => !t); pointer.current = ''; }}>
          <span ref={shadow} className="mz-card__shadow" aria-hidden="true" />
          <motion.span className="mz-inner" initial={false} animate={{ rotateY: on ? 180 : 0 }} transition={SPRING.flip}>
            <span className="mz-face">
              {front && <img src={front} alt={`${name} — ${c.front}`} loading="lazy" decoding="async" />}
              <span className="mz-face__label">{c.front}</span>
            </span>
            <span className="mz-face mz-back">
              {back && <img src={back} alt={`${name} — ${c.back}`} loading="lazy" decoding="async" />}
              <span className="mz-face__label">{c.back}</span>
            </span>
          </motion.span>
          <motion.span className="mz-card__glare" aria-hidden="true" style={{ background: glare }} />
        </button>
        {!compact && (
          <motion.button type="button" className="mz-reset mz-hanger-btn" aria-pressed={picked} aria-label={`${c.hangLabel} ${name}`} title={`${c.hangLabel} ${name}`}
            onClick={() => { togglePick(g.id); b.toast(`${picked ? c.pickRemoved : c.pickAdded} — ${name}`); }}
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.9 }} transition={SPRING.soft}>
            <Icon name="hanger" size={20} />
          </motion.button>
        )}
      </motion.div>
      <Link href={productHref(g.id)} className="mz-card__meta">
        <span className="mz-link mz-card__name">{name}</span>
        <span className="mz-card__row">
          {colour && !compact && <span className="mz-dot" aria-hidden="true" style={{ background: colour.hex }} />}
          {colour && !compact && <span className="mz-card__colour">{b.tx(colour.name)}</span>}
          <span className="mz-card__price">{price < g.price && <s>{b.price(g.price)}</s>} {b.price(price)}</span>
        </span>
      </Link>
    </article>
  );
}
