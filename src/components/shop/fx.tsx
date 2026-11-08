'use client';
/* Shared motion pieces. Motion (framer-motion) owns component motion; GSAP owns scroll scenes. They never animate
   the same element and property. Both stand still under prefers-reduced-motion. */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion } from 'motion/react';
import { Fragment, useLayoutEffect, useRef, type RefObject } from 'react';
import { SPRING } from './tokens';

gsap.registerPlugin(ScrollTrigger);

/** Runs a GSAP setup for visitors who allow motion, and reverts it on unmount. */
export function useScrollScene(scope: RefObject<HTMLElement | null>, setup: (root: HTMLElement) => void, deps: unknown[] = []) {
  useLayoutEffect(() => {
    const root = scope.current;
    if (!root) return;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => { setup(root); });
    return () => mm.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

const TAGS = { h1: motion.h1, h2: motion.h2, p: motion.p } as const;

/** A heading whose words rise out of a mask one after another when it scrolls into view. The heading watches the
 *  viewport (its words start clipped, so they cannot), and passes the cue to the words. */
export function SplitReveal({ text, as = 'h2', className }: { text: string; as?: keyof typeof TAGS; className?: string }) {
  const Tag = TAGS[as];
  const words = text.split(' ');
  return (
    <Tag className={className} aria-label={text} initial="hidden" whileInView="shown" viewport={{ once: true, amount: 0.4 }}
      transition={{ staggerChildren: 0.06 }}>
      {words.map((w, i) => (
        <Fragment key={`${w}-${i}`}>
          <span className="mz-split" aria-hidden="true">
            <motion.span className="mz-split__in" variants={{ hidden: { y: '105%' }, shown: { y: '0%', transition: SPRING.soft } }}>{w}</motion.span>
          </span>
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </Tag>
  );
}

/** A gold divider with an eight-point star (two squares, as in Omani geometric work), drawn as it scrolls into view. */
export function Ornament({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useScrollScene(ref as unknown as RefObject<HTMLElement>, root => {
    gsap.fromTo(root.querySelectorAll('[pathLength]'), { strokeDashoffset: 1 }, {
      strokeDashoffset: 0, ease: 'none', stagger: 0.08,
      scrollTrigger: { trigger: root, start: 'top 92%', end: 'top 55%', scrub: 0.6 },
    });
  });
  return (
    <svg ref={ref} className={`mz-ornament${className ? ` ${className}` : ''}`} viewBox="0 0 400 24" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <path d="M0 12H176M224 12H400" pathLength={1} strokeDasharray="1" />
      <path d="M200 0L212 12L200 24L188 12Z" pathLength={1} strokeDasharray="1" />
      <path d="M191.5 3.5H208.5V20.5H191.5Z" pathLength={1} strokeDasharray="1" />
      <circle cx="200" cy="12" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
