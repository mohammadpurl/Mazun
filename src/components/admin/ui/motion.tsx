'use client';
/* Motion for the panel. Framer Motion (motion/react) handles component-level motion: entrances, hover and tap,
   staggered lists, layout changes. GSAP handles timelines and SVG drawing (charts, the map). The two never animate
   the same element and property. Everything respects prefers-reduced-motion: MotionConfig for Motion, and
   gsap.matchMedia in useGsap. */
import gsap from 'gsap';
import { animate, motion, MotionConfig, useInView, useReducedMotion, type HTMLMotionProps } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState, type DependencyList, type ReactNode, type RefObject } from 'react';

export const EASE = [0.22, 1, 0.36, 1] as const;
export const SPRING = { type: 'spring', stiffness: 260, damping: 26 } as const;

export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user" transition={{ duration: 0.35, ease: EASE }}>{children}</MotionConfig>;
}

/** Rises into place the first time it scrolls into view. */
export function Reveal({ children, delay = 0, y = 14, ...rest }: HTMLMotionProps<'div'> & { delay?: number; y?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, ease: EASE, delay }} {...rest}>
      {children}
    </motion.div>
  );
}

/** A container whose direct `StaggerItem`s enter one after another when it comes into view. */
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
export const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};
export function Stagger({ children, as = 'div', ...rest }: HTMLMotionProps<'div'> & { as?: 'div' | 'ul' }) {
  const Comp = as === 'ul' ? motion.ul : motion.div;
  return <Comp variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }} {...(rest as object)}>{children}</Comp>;
}

/** Counts up to `value` when it first comes into view, and tweens between values afterwards. */
export function CountUp({ value, format, duration = 1.1 }: { value: number; format: (n: number) => string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();
  const from = useRef(0);
  // null until the count starts: the server and the first client render both show the final value, so nothing is
  // mismatched on hydration and nothing reads 0 for readers who prefer less motion.
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    if (!seen) return;
    // No count-up for readers who prefer less motion, or while the tab is in the background (frames are paused there).
    if (reduce || document.hidden) { setShown(null); from.current = value; return; }
    setShown(format(from.current));
    const c = animate(from.current, value, { duration, ease: EASE, onUpdate: v => setShown(format(v)), onComplete: () => setShown(null) });
    from.current = value;
    return () => c.stop();
    // format is a fresh function each render; the value is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen, value, reduce, duration]);
  return <span ref={ref} className="num">{shown ?? format(value)}</span>;
}

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Runs GSAP code scoped to `scope` (selectors resolve inside it), reverted on change and unmount. The callback gets
 *  `reduce`: true when the reader prefers reduced motion or the tab is hidden, so it can jump to the end state. */
export function useGsap(scope: RefObject<Element | null>, fn: (ctx: { reduce: boolean; gsap: typeof gsap }) => void, deps: DependencyList = []) {
  useIso(() => {
    if (!scope.current) return;
    const mm = gsap.matchMedia(scope.current);
    mm.add({ reduce: '(prefers-reduced-motion: reduce)', ok: '(prefers-reduced-motion: no-preference)' }, c => {
      // A background tab gets no animation frames; jump to the end state rather than leave a chart half drawn.
      fn({ reduce: !!c.conditions?.reduce || document.hidden, gsap });
    });
    return () => mm.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** True once the element has been on screen (for starting a GSAP timeline when a chart scrolls in). */
export function useSeen<T extends Element>(amount = 0.25) {
  const ref = useRef<T>(null);
  const seen = useInView(ref, { once: true, amount });
  return [ref, seen] as const;
}
