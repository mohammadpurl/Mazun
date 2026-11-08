'use client';
/* A popover layer: rendered into the panel root (outside any card, table or dialog that clips or transforms), placed
   with fixed coordinates under its trigger — or above it when there is more room there — and kept in place while the
   page or a dialog scrolls. Its inline-start edge lines up with the trigger's (right edge in right-to-left). */
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** `onShown` runs once the layer is in the page (one render after `open`, when its place is known): the moment to move
 *  focus into it. */
export function Floating({ anchor, open, align = 'start', popRef, className = 'pop', role, label, labelledBy, id, minWidth = true, onShown, children }: {
  anchor: RefObject<HTMLElement | null>; open: boolean; align?: 'start' | 'end'; popRef: RefObject<HTMLDivElement | null>; className?: string;
  role?: string; label?: string; labelledBy?: string; id?: string; minWidth?: boolean; onShown?: () => void; children: ReactNode;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [pos, setPos] = useState<{ style: CSSProperties; up: boolean } | null>(null);
  const shownRef = useRef(onShown);
  shownRef.current = onShown;
  useEffect(() => setHost(document.querySelector<HTMLElement>('.adm')), []);
  const shown = open && !!pos && !!host;
  useIso(() => { if (shown) shownRef.current?.(); }, [shown]);
  useIso(() => {
    if (!open) { setPos(null); return; }
    let last = '', frame = 0;
    const place = () => {
      const el = anchor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const rtl = getComputedStyle(el).direction === 'rtl';
      const below = window.innerHeight - r.bottom, above = r.top;
      const up = below < 300 && above > below;
      const style: CSSProperties = { maxHeight: Math.max(180, (up ? above : below) - 16) };
      if (minWidth) style.minWidth = Math.min(r.width, window.innerWidth - 16);
      if (up) style.bottom = window.innerHeight - r.top + 6; else style.top = r.bottom + 6;
      const fromRight = (align === 'start') === rtl;
      if (fromRight) style.right = Math.max(8, window.innerWidth - r.right); else style.left = Math.max(8, r.left);
      // Only a real move re-renders the layer (and its list of options).
      const key = JSON.stringify(style) + up;
      if (key !== last) { last = key; setPos({ style, up }); }
    };
    // Scrolling the page or a dialog moves the trigger; scrolling the list inside the layer does not.
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && popRef.current?.contains(e.target)) return;
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; place(); });
    };
    place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onScroll); };
  }, [open, align]);
  if (!host) return null;
  return createPortal(
    <AnimatePresence>
      {open && pos && (
        <motion.div ref={popRef} id={id} role={role} aria-label={label} aria-labelledby={labelledBy} className={`${className} floating`} style={pos.style}
          initial={{ opacity: 0, y: pos.up ? 6 : -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: pos.up ? 6 : -6, scale: 0.98 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    host,
  );
}
