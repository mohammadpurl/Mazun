'use client';
import { AnimatePresence, motion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { lockScroll, trapTab } from '../focus';
import { useShop } from '../Shop';
import { SPRING } from '../tokens';
import { BodyScan } from './BodyScan';
import { Chat } from './Chat';
import { useBackCloses } from './useBackCloses';
import { usePieceHere } from './usePieceHere';
import { useConcierge } from './useConcierge';

/* The stylist floats over the whole shop: a button in the corner, and the conversation it opens. On a phone the
   conversation takes the screen; on anything wider it is a panel in the corner and the page stays usable behind it. */

const HINT_KEY = 'mazun_stylist_hint';
/** Matches the full-screen layout in landing.css; a phone on its side is short rather than narrow. */
const PHONE = '(max-width: 599px), (max-height: 500px)';

export function StylistDock() {
  const { c } = useShop();
  const a = useConcierge();
  const path = usePathname();
  const fab = useRef<HTMLButtonElement>(null);
  // The stylist page has a conversation of its own.
  const own = path === '/stylist';
  const hidden = a.open || a.scanning || own;
  // On a product page or in the fitting room the stylist picks up with the piece she is looking at.
  const piece = usePieceHere();

  const { closeChat, open, openChat, setScanning } = a;
  // A full-screen chat would hide the page she just went to; the corner panel can stay on most pages.
  const lastPath = useRef(path);
  useEffect(() => {
    if (lastPath.current === path) return;
    lastPath.current = path;
    setScanning(false);
    // The fitting room's own controls are what she went there for.
    if (own || path === '/fitting-room' || window.matchMedia(PHONE).matches) { closeChat(); return; }
    // The corner panel follows her to the piece she has moved to, so a size is never worked out for the one she left.
    const here = piece();
    if (open && here) openChat(here);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the page changes, and only then
  }, [path]);

  // Focus goes back to whatever opened the chat, if it is still on the page. Read before the panel takes the focus.
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => { if (open) opener.current = document.activeElement as HTMLElement | null; }, [open]);
  useEffect(() => {
    if (!open) return;
    const button = fab.current;
    return () => {
      const back = opener.current;
      (back && back.isConnected && back !== document.body ? back : button)?.focus({ preventScroll: true });
    };
  }, [open]);

  // Once a session, a line beside the button says what it is for.
  const [hint, setHint] = useState(false);
  useEffect(() => { if (hidden) setHint(false); }, [hidden]);
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(HINT_KEY) === '1'; } catch { /* storage blocked: the hint still shows */ }
    if (seen) return;
    let show = 0, hide = 0;
    const start = () => {
      show = window.setTimeout(() => {
        setHint(true);
        try { sessionStorage.setItem(HINT_KEY, '1'); } catch { /* storage blocked */ }
      }, 1800);
      hide = window.setTimeout(() => setHint(false), 10_000);
    };
    // On a phone it waits until she has scrolled past the hero, or it would sit on the hero's buttons.
    const onScroll = () => {
      if (window.scrollY < window.innerHeight * 0.6) return;
      window.removeEventListener('scroll', onScroll);
      start();
    };
    if (window.matchMedia(PHONE).matches) window.addEventListener('scroll', onScroll, { passive: true }); else start();
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(show); clearTimeout(hide); };
  }, []);

  return (
    <>
      <AnimatePresence>
        {hint && !hidden && (
          <motion.button key="hint" type="button" tabIndex={-1} aria-hidden="true" className="mz-reset ai-fab__hint" onClick={() => a.openChat(piece())}
            initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }} transition={SPRING.soft}>
            {c.aiFabHint}
          </motion.button>
        )}
      </AnimatePresence>
      <motion.button ref={fab} type="button" className="mz-reset ai-fab" aria-label={c.aiDock} aria-haspopup="dialog" aria-expanded={a.open} inert={hidden} onClick={() => a.openChat(piece())}
        initial={{ opacity: 0, y: 18, scale: 0.92 }} animate={hidden ? { opacity: 0, y: 14, scale: 0.92 } : { opacity: 1, y: 0, scale: 1 }} transition={SPRING.soft}
        whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
        <span className="ai-avatar" dir="ltr" aria-hidden="true">AI</span><span className="ai-fab__label">{c.aiDock}</span>
      </motion.button>
      <AnimatePresence>{a.open && <Panel key="panel" />}</AnimatePresence>
      <BodyScan />
    </>
  );
}

function Panel() {
  const { c } = useShop();
  const a = useConcierge();
  const box = useRef<HTMLDivElement>(null);
  const { closeChat, inputRef } = a;
  // Only ever rendered in the browser: the chat opens after the page has loaded.
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches);
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const on = () => setPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    const el = box.current;
    // A touch screen would throw up its keyboard over the first thing she should read.
    (window.matchMedia('(hover: none)').matches ? el : inputRef.current ?? el)?.focus({ preventScroll: true });
  }, [inputRef]);

  useEffect(() => {
    const el = box.current;
    const key = (e: KeyboardEvent) => {
      // Sheets, the camera and dialogs open over the chat and answer Escape themselves.
      if (e.defaultPrevented) return;
      if (document.querySelector('.sheet-wrap.in, .ai-scan, .mz-dialog, .mz-menu, .mz-search, .mz-live') && !el?.contains(document.activeElement)) return;
      if (e.key === 'Escape') closeChat();
      if (phone) trapTab(e, el);
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [phone, closeChat]);

  // On a phone the page behind stays still.
  useEffect(() => (phone ? lockScroll() : undefined), [phone]);

  // The conversation fits the part of the screen the keyboard leaves.
  useEffect(() => {
    const el = box.current, vv = window.visualViewport;
    if (!el || !vv) return;
    const fit = () => {
      el.style.setProperty('--ai-vh', `${vv.height}px`);
      el.style.setProperty('--ai-vt', `${vv.offsetTop}px`);
      el.style.setProperty('--ai-kb', `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`);
    };
    fit();
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    return () => { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); };
  }, []);

  // Full screen it behaves like a page, so a phone's Back closes it rather than leaving the shop.
  const leaving = useRef(false);
  useBackCloses(phone, closeChat, 'mzChat', leaving);

  return (
    <motion.div ref={box} className="ai-panel" role="dialog" aria-modal={phone} aria-label={c.aiName} tabIndex={-1}
      // A link can stay on the same address, which the page-change rule above would not see. Fitting-room links close it
      // at any width: its controls are what she is going there for.
      onClickCapture={e => {
        const at = e.target as Element;
        if ((phone && at.closest('a[href]:not([target]), [data-leaves]')) || at.closest('a[href^="/fitting-room"]')) { leaving.current = true; closeChat(); }
      }}
      initial={{ opacity: 0, y: 28, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.98, transition: { duration: 0.2 } }} transition={SPRING.soft}>
      <Chat />
    </motion.div>
  );
}
