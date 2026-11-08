'use client';
/* Dialogs, confirmations and toasts. A dialog traps focus, closes on Escape or the backdrop, and gives focus back to
   what opened it; below 768px it rises as a bottom sheet with a sticky footer. Toasts: success and info leave after
   five seconds, errors stay until closed. `useUi()` gives every page `toast()` and a promise-based `confirm()`. */
import { AnimatePresence, motion } from 'motion/react';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AIcon, type AIconName } from './Icon';
import { useMedia } from './useMedia';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),textarea:not([disabled]),select,[tabindex]:not([tabindex="-1"])';

export function Dialog({ open, onClose, title, icon, children, footer, wide, busy }: {
  open: boolean; onClose: () => void; title: string; icon?: AIconName; children: ReactNode; footer?: ReactNode; wide?: boolean; busy?: boolean;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLElement | null>(null);
  const sheet = useMedia('(max-width: 767px)');
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.querySelector<HTMLElement>('.adm')), []);
  useEffect(() => {
    if (!open) return;
    back.current = document.activeElement as HTMLElement;
    const t = setTimeout(() => {
      const first = box.current?.querySelector<HTMLElement>('[data-autofocus]') ?? box.current?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }, 30);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => { clearTimeout(t); html.style.overflow = prev; back.current?.focus?.(); };
  }, [open]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); if (!busy) onClose(); return; }
    if (e.key !== 'Tab' || !box.current) return;
    const els = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.offsetParent !== null);
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  if (!host) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="overlay" onKeyDown={onKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
          onPointerDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
          <motion.div ref={box} role="dialog" aria-modal="true" aria-labelledby={id} className={`dlg${wide ? ' wide' : ''}`}
            initial={sheet ? { y: '100%' } : { opacity: 0, y: 16, scale: 0.97 }} animate={sheet ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={sheet ? { y: '100%' } : { opacity: 0, y: 10, scale: 0.98 }} transition={sheet ? { type: 'spring', stiffness: 320, damping: 34 } : { duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
            <div className="dlg-head">
              {icon && <span className="tile sm soft"><AIcon name={icon} duo /></span>}
              <h2 id={id}>{title}</h2>
              <button type="button" className="icon-btn" aria-label="بستن" onClick={onClose} disabled={busy}><AIcon name="close" /></button>
            </div>
            <div className="dlg-body">{children}</div>
            {footer && <div className="dlg-foot">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    host,
  );
}

type ToastKind = 'ok' | 'err' | 'info';
interface ToastItem { id: number; kind: ToastKind; title: string; desc?: string }
interface ConfirmReq { title: string; body: ReactNode; confirm: string; danger?: boolean; resolve: (ok: boolean) => void }
interface Ui { toast: (kind: ToastKind, title: string, desc?: string) => void; confirm: (o: Omit<ConfirmReq, 'resolve'>) => Promise<boolean> }

const UiContext = createContext<Ui>({ toast: () => undefined, confirm: async () => false });
export const useUi = () => useContext(UiContext);

const TOAST_ICON: Record<ToastKind, AIconName> = { ok: 'done', err: 'warning', info: 'info' };

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [ask, setAsk] = useState<ConfirmReq | null>(null);
  const seq = useRef(0);
  const drop = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), []);
  const toast = useCallback((kind: ToastKind, title: string, desc?: string) => {
    const id = ++seq.current;
    setToasts(t => [...t.slice(-3), { id, kind, title, desc }]);
    if (kind !== 'err') setTimeout(() => drop(id), 5000);
  }, [drop]);
  const confirm = useCallback((o: Omit<ConfirmReq, 'resolve'>) => new Promise<boolean>(resolve => setAsk({ ...o, resolve })), []);
  const answer = (ok: boolean) => { ask?.resolve(ok); setAsk(null); };
  return (
    <UiContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map(t => (
            <motion.div key={t.id} layout className={`toast ${t.kind}`} role={t.kind === 'err' ? 'alert' : 'status'}
              initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}>
              <AIcon name={TOAST_ICON[t.kind]} duo />
              <div className="grow"><b>{t.title}</b>{t.desc && <span>{t.desc}</span>}</div>
              <button type="button" className="icon-btn sm" aria-label="بستن پیام" onClick={() => drop(t.id)}><AIcon name="close" /></button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <Dialog open={!!ask} onClose={() => answer(false)} title={ask?.title ?? ''} icon={ask?.danger ? 'warning' : 'info'}
        footer={<>
          <button type="button" className="btn outline" data-autofocus={ask?.danger ? '' : undefined} onClick={() => answer(false)}>انصراف</button>
          <button type="button" className={`btn${ask?.danger ? ' danger' : ''}`} data-autofocus={ask?.danger ? undefined : ''} onClick={() => answer(true)}>{ask?.confirm}</button>
        </>}>
        <div className="muted">{ask?.body}</div>
      </Dialog>
    </UiContext.Provider>
  );
}
