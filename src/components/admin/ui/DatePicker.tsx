'use client';
/* The panel's date picker (no native date input): a field that opens a Persian-calendar month grid, as a popover on
   wide screens and a bottom sheet on phones. Days are UTC midnights so no time zone moves a date; the value is an
   ISO yyyy-mm-dd string or null. Keyboard: arrows move by day (mirrored for right-to-left) and week, Page Up/Down by
   month, Home/End to the week's ends, Enter picks, Escape closes. */
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Floating } from './Floating';
import { AIcon } from './Icon';
import { useMedia } from './useMedia';

const DAY = 86_400_000;
const LOCALE = 'fa-IR-u-ca-persian';
/** Weeks start on Saturday. */
const WEEK_START = 6;
const fmts = new Map<string, Intl.DateTimeFormat>();
const df = (o: Intl.DateTimeFormatOptions, locale = LOCALE) => {
  const k = locale + JSON.stringify(o);
  let f = fmts.get(k);
  if (!f) { f = new Intl.DateTimeFormat(locale, { ...o, timeZone: 'UTC' }); fmts.set(k, f); }
  return f;
};
const say = (t: number, o: Intl.DateTimeFormatOptions) => {
  const p = Object.fromEntries(df(o).formatToParts(t).map(x => [x.type, x.value]));
  return [p.weekday, p.day, p.month, p.year].filter(Boolean).join(' ');
};
const toIso = (t: number) => new Date(t).toISOString().slice(0, 10);
const fromIso = (s?: string | null) => { const m = s ? /^(\d{4})-(\d{2})-(\d{2})/.exec(s) : null; return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; };
/** Today in the shop's time zone (as the server counts it), as a UTC midnight. */
const todayUtc = () => fromIso(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Muscat' }).format(new Date()))!;
const dayOfMonth = (t: number) => +df({ day: 'numeric' }, 'en-u-ca-persian-nu-latn').format(t);
function monthSpan(t: number) {
  const first = t - (dayOfMonth(t) - 1) * DAY;
  let last = first + 28 * DAY;
  while (dayOfMonth(last + DAY) !== 1) last += DAY;
  return { first, last };
}

export function DatePicker({ value, onChange, label, labelledBy, id, placeholder = 'انتخاب تاریخ', min, max, clearable = true, invalid, describedBy }: {
  value: string | null; onChange: (v: string | null) => void; label?: string; labelledBy?: string; id?: string; placeholder?: string;
  min?: string; max?: string; clearable?: boolean; invalid?: boolean; describedBy?: string;
}) {
  const auto = useId();
  const sheet = useMedia('(max-width: 767px)');
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.querySelector<HTMLElement>('.adm')), []);
  const v = fromIso(value);
  const floor = fromIso(min) ?? -Infinity, ceil = fromIso(max) ?? Infinity;
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const toGrid = useRef(false);
  const today = todayUtc();
  const shown = focus || today;
  const { first, last } = useMemo(() => monthSpan(shown), [shown]);
  const lead = (new Date(first).getUTCDay() - WEEK_START + 7) % 7;
  const days = useMemo(() => Array.from({ length: Math.round((last - first) / DAY) + 1 }, (_, i) => first + i * DAY), [first, last]);
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => Date.UTC(2024, 0, 7) + ((WEEK_START + i) % 7) * DAY), []);
  const clamp = (t: number) => Math.min(Math.max(t, floor), ceil);

  const [title, setTitle] = useState('');
  const show = () => {
    toGrid.current = true; setFocus(clamp(v ?? todayUtc())); setOpen(true);
    // The field's own label, shown on top of the phone sheet that covers it.
    setTitle(label ?? (id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent ?? '' : ''));
  };
  const close = (refocus = true) => { setOpen(false); if (refocus) trigger.current?.focus(); };
  const pick = (t: number) => { if (t < floor || t > ceil) return; onChange(toIso(t)); close(); };

  const focusDay = () => {
    const el = grid.current?.querySelector<HTMLButtonElement>('[tabindex="0"]');
    if (!el) return;
    toGrid.current = false;
    el.focus({ preventScroll: true });
  };
  useEffect(() => { if (open && toGrid.current) focusDay(); }, [open, focus]);
  useEffect(() => {
    if (!open || sheet) return;
    const away = (e: PointerEvent) => { if (!panel.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) close(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open, sheet]);

  const shift = (t: number, dir: 1 | -1) => {
    const span = monthSpan(t);
    const off = Math.round((t - span.first) / DAY);
    const other = monthSpan(dir > 0 ? span.last + DAY : span.first - DAY);
    return Math.min(other.first + off * DAY, other.last);
  };
  const target = (k: string): number | null => {
    const wd = (new Date(focus).getUTCDay() - WEEK_START + 7) % 7;
    switch (k) {
      case 'ArrowRight': return focus - DAY; // right-to-left: right is the previous day
      case 'ArrowLeft': return focus + DAY;
      case 'ArrowDown': return focus + 7 * DAY;
      case 'ArrowUp': return focus - 7 * DAY;
      case 'Home': return focus - wd * DAY;
      case 'End': return focus + (6 - wd) * DAY;
      case 'PageDown': return shift(focus, 1);
      case 'PageUp': return shift(focus, -1);
      default: return null;
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === 'Tab' && open && panel.current?.contains(e.target as Node)) {
      // Tab cycles inside the calendar (month buttons, the day, today/clear) so focus never leaves a dialog behind it.
      const els = [...panel.current.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"])')];
      const i = els.indexOf(e.target as HTMLElement);
      e.preventDefault();
      els[(i + (e.shiftKey ? -1 : 1) + els.length) % els.length]?.focus();
      return;
    }
    if (!open || !grid.current?.contains(e.target as Node)) return;
    const t = target(e.key);
    if (t !== null) { e.preventDefault(); toGrid.current = true; setFocus(clamp(t)); }
  };

  const hid = `${id ?? auto}-m`;
  const body = (
    <div className="dp-panel">
      <div className="dp-head">
        <button type="button" className="icon-btn sm" aria-label="ماه قبل" disabled={first - DAY < floor} onClick={() => setFocus(clamp(shift(focus, -1)))}><AIcon name="right" /></button>
        <b id={hid} aria-live="polite">{df({ month: 'long', year: 'numeric' }).format(first)}</b>
        <button type="button" className="icon-btn sm" aria-label="ماه بعد" disabled={last + DAY > ceil} onClick={() => setFocus(clamp(shift(focus, 1)))}><AIcon name="left" /></button>
      </div>
      <div ref={grid} className="dp-grid" role="grid" aria-labelledby={hid}>
        <div role="row" className="dp-row">
          {weekdays.map(w => <span key={w} role="columnheader" aria-label={df({ weekday: 'long' }).format(w)}><abbr title={df({ weekday: 'long' }).format(w)} aria-hidden="true">{df({ weekday: 'narrow' }).format(w)}</abbr></span>)}
        </div>
        {Array.from({ length: Math.ceil((lead + days.length) / 7) }, (_, r) => (
          <div key={r} role="row" className="dp-row">
            {Array.from({ length: 7 }, (_, c) => {
              const t = days[r * 7 + c - lead];
              if (t === undefined) return <span key={c} role="gridcell" />;
              const off = t < floor || t > ceil;
              return (
                <span key={c} role="gridcell" aria-selected={t === v}>
                  <button type="button" tabIndex={t === focus ? 0 : -1} aria-disabled={off || undefined} aria-label={say(t, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    className={`dp-day${t === v ? ' on' : ''}${t === today ? ' today' : ''}`}
                    onClick={() => pick(t)} onFocus={() => t !== focus && setFocus(t)}>
                    {df({ day: 'numeric' }).format(t)}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div className="dp-foot">
        <button type="button" className="btn ghost sm" onClick={() => pick(clamp(today))}>امروز</button>
        {clearable && value && <button type="button" className="btn ghost sm" onClick={() => { onChange(null); close(); }}>پاک کردن</button>}
      </div>
    </div>
  );

  return (
    <div className="dd" onKeyDown={onKey} onBlur={e => {
      const to = e.relatedTarget as Node | null;
      if (open && !sheet && to && !panel.current?.contains(to) && !trigger.current?.contains(to)) close(false);
    }}>
      <button ref={trigger} id={id} type="button" className="dd-trigger" aria-haspopup="dialog" aria-expanded={open} aria-label={label} aria-labelledby={labelledBy}
        aria-invalid={invalid || undefined} aria-describedby={describedBy} onClick={() => (open ? close() : show())}>
        <AIcon name="calendar" />
        <span className={`val${v === null ? ' ph' : ''}`}>{v === null ? placeholder : say(v, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        <AIcon name="down" className="chev" />
      </button>
      <Floating anchor={trigger} open={open && !sheet} popRef={panel} role="dialog" labelledBy={hid} className="pop dp-pop" minWidth={false} onShown={focusDay}>
        {body}
      </Floating>
      {host && createPortal(
        <AnimatePresence>
          {open && sheet && (
            <motion.div key="s" className="scrim" style={{ zIndex: 96 }} onClick={() => close()} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          )}
          {open && sheet && (
            <motion.div key="p" ref={panel} className="sheet" role="dialog" aria-modal="true" aria-labelledby={hid}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}>
              <div className="grab" />
              {title && <b className="sheet-title">{title}</b>}
              {body}
            </motion.div>
          )}
        </AnimatePresence>,
        host,
      )}
    </div>
  );
}
