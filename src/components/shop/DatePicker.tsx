'use client';
/* The shop's own date picker (no native date input): a button that opens a month grid. Persian readers get the
   Persian calendar, Arabic and English the Gregorian one, each with its own month names, weekdays and digits. Days
   are UTC midnights, so time zones never move a date; the form receives an ISO yyyy-mm-dd value. Keyboard: arrows
   move by day (mirrored in right-to-left) and week, Page Up/Down by month, Home/End to the week's ends, Enter picks,
   Escape closes. */
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Lang } from '@/lib/types';
import { Icon } from './Icon';
import { EASE } from './tokens';

const DAY = 86400000;
const LOCALE: Record<Lang, string> = { en: 'en-GB-u-ca-gregory', ar: 'ar-OM-u-ca-gregory', fa: 'fa-IR-u-ca-persian' };
const CAL: Record<Lang, string> = { en: 'gregory', ar: 'gregory', fa: 'persian' };
/** Weeks start on Saturday (Date#getUTCDay 6) in every language: the shop serves one market, Oman. */
const WEEK_START = 6;

const fmt = new Map<string, Intl.DateTimeFormat>();
function df(locale: string, o: Intl.DateTimeFormatOptions) {
  const k = locale + JSON.stringify(o);
  if (!fmt.has(k)) fmt.set(k, new Intl.DateTimeFormat(locale, { ...o, timeZone: 'UTC' }));
  return fmt.get(k)!;
}
/** A date in words. Chrome's Persian patterns put the year first ("۱۴۰۵ آبان ۱۵, جمعه"); Persian readers expect
 *  weekday, day, month, year ("جمعه ۱۵ آبان ۱۴۰۵"), so Persian is put together from its parts. */
function say(lang: Lang, t: number, o: Intl.DateTimeFormatOptions) {
  const f = df(LOCALE[lang], o);
  if (lang !== 'fa') return f.format(t);
  const p = Object.fromEntries(f.formatToParts(t).map(x => [x.type, x.value]));
  return [p.weekday, p.day, p.month, p.year].filter(Boolean).join(' ');
}
const todayUtc = () => { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
const toIso = (t: number) => new Date(t).toISOString().slice(0, 10);
const fromIso = (s?: string | null) => { const m = s ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) : null; return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; };
/** The calendar month a day falls in, as a comparable key. */
const monthKey = (t: number, cal: string) => df(`en-u-ca-${cal}-nu-latn`, { year: 'numeric', month: 'numeric' }).format(t);
const dayOfMonth = (t: number, cal: string) => +df(`en-u-ca-${cal}-nu-latn`, { day: 'numeric' }).format(t);
/** First and last day of the month a day falls in: back by its day number, then forward from day 28 to the next 1st. */
function monthSpan(t: number, cal: string) {
  const first = t - (dayOfMonth(t, cal) - 1) * DAY;
  let last = first + 27 * DAY;
  while (dayOfMonth(last + DAY, cal) !== 1) last += DAY;
  return { first, last };
}

export type DatePickerText = { choose: string; clear: string; prev: string; next: string };

export function DatePicker({ id: fieldId, name, lang, labelledBy, text, min, defaultValue }: {
  id?: string; name: string; lang: Lang; labelledBy: string; text: DatePickerText; min?: 'today'; defaultValue?: string;
}) {
  const cal = CAL[lang], locale = LOCALE[lang], rtl = lang !== 'en';
  const [value, setValue] = useState<number | null>(() => fromIso(defaultValue));
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const intoGrid = useRef(false);
  const id = useId();
  const floor = min === 'today' ? todayUtc() : -Infinity;

  const shown = focus || todayUtc();
  const key = monthKey(shown, cal);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { first, last } = useMemo(() => monthSpan(shown, cal), [key, cal]);
  const lead = (new Date(first).getUTCDay() - WEEK_START + 7) % 7;
  const days = useMemo(() => Array.from({ length: Math.round((last - first) / DAY) + 1 }, (_, i) => first + i * DAY), [first, last]);
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => Date.UTC(2024, 0, 7) + ((WEEK_START + i) % 7) * DAY), []);

  const show = () => { intoGrid.current = true; setFocus(value ?? Math.max(todayUtc(), floor)); setOpen(true); };
  const close = (refocus = true) => { setOpen(false); if (refocus) trigger.current?.focus(); };
  const pick = (t: number) => { if (t < floor) return; setValue(t); close(); };

  // Focus follows the active day when the panel opens or the keyboard moves it (the month buttons keep theirs);
  // a press outside the panel closes it.
  useEffect(() => {
    if (!open || !intoGrid.current) return;
    intoGrid.current = false;
    grid.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus({ preventScroll: true });
  }, [open, focus]);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!panel.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) close(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const shiftMonth = (t: number, dir: 1 | -1) => {
    const span = monthSpan(t, cal);
    const offset = Math.round((t - span.first) / DAY);
    const other = monthSpan(dir > 0 ? span.last + DAY : span.first - DAY, cal);
    return Math.min(other.first + offset * DAY, other.last);
  };
  /** Where a key moves the active day, or null for keys the grid does not use. Only the pressed key is worked out. */
  const target = (k: string): number | null => {
    const wd = (new Date(focus).getUTCDay() - WEEK_START + 7) % 7;
    switch (k) {
      case 'ArrowRight': return rtl ? focus - DAY : focus + DAY;
      case 'ArrowLeft': return rtl ? focus + DAY : focus - DAY;
      case 'ArrowDown': return focus + 7 * DAY;
      case 'ArrowUp': return focus - 7 * DAY;
      case 'Home': return focus - wd * DAY;
      case 'End': return focus + (6 - wd) * DAY;
      case 'PageDown': return shiftMonth(focus, 1);
      case 'PageUp': return shiftMonth(focus, -1);
      default: return null;
    }
  };
  // On the whole picker, so Escape works from the field, the month buttons and the grid alike. It closes only the
  // picker: marked as handled for the sheet or dialog around it, and stopped, since React listens on the document too.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); close(); return; }
    if (!open || !grid.current?.contains(e.target as Node)) return;
    const t = target(e.key);
    // Never into the days before the first one that can be picked.
    if (t !== null) { e.preventDefault(); intoGrid.current = true; setFocus(Math.max(t, floor)); }
  };

  const prevOff = first - DAY < floor;
  const label = value ? say(lang, value, { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }) : text.choose;
  return (
    <div className="mz-date" onKeyDown={onKey}>
      <input type="hidden" name={name} value={value ? toIso(value) : ''} />
      <button ref={trigger} id={fieldId} type="button" className={`mz-date__field${value ? '' : ' is-empty'}`} aria-haspopup="dialog" aria-expanded={open}
        aria-labelledby={`${labelledBy} ${id}-v`} onClick={() => (open ? close() : show())}>
        <span id={`${id}-v`}>{label}</span><Icon name="calendar" size={18} />
      </button>
      {value && <button type="button" className="mz-date__clear" onClick={() => { setValue(null); trigger.current?.focus(); }}>{text.clear}</button>}
      <AnimatePresence>
        {open && (
          <motion.div ref={panel} className="mz-date__panel" role="dialog" aria-modal="false" aria-labelledby={`${id}-m`}
            onBlur={e => { const to = e.relatedTarget as Node | null; if (to && !e.currentTarget.contains(to) && to !== trigger.current) setOpen(false); }}
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25, ease: EASE }}
            // Once it has settled, bring the whole month into view, not just the focused day.
            onAnimationComplete={() => { if (open) panel.current?.scrollIntoView({ block: 'nearest' }); }}>
            <div className="mz-date__head">
              <button type="button" className="mz-date__nav" aria-label={text.prev} aria-disabled={prevOff || undefined} onClick={() => { if (!prevOff) setFocus(shiftMonth(focus, -1)); }}><Icon name="back" size={18} /></button>
              <span id={`${id}-m`} aria-live="polite">{say(lang, first, { month: 'long', year: 'numeric' })}</span>
              <button type="button" className="mz-date__nav" aria-label={text.next} onClick={() => setFocus(shiftMonth(focus, 1))}><Icon name="next" size={18} /></button>
            </div>
            <div ref={grid} className="mz-date__grid" role="grid" aria-labelledby={`${id}-m`}>
              <div role="row" className="mz-date__row">
                {weekdays.map(w => <span key={w} role="columnheader" aria-label={df(locale, { weekday: 'long' }).format(w)}><abbr aria-hidden="true" title={df(locale, { weekday: 'long' }).format(w)}>{df(locale, { weekday: lang === 'en' ? 'short' : 'narrow' }).format(w)}</abbr></span>)}
              </div>
              {Array.from({ length: Math.ceil((lead + days.length) / 7) }, (_, r) => (
                <div key={r} role="row" className="mz-date__row">
                  {Array.from({ length: 7 }, (_, c) => {
                    const t = days[r * 7 + c - lead];
                    if (t === undefined) return <span key={c} role="gridcell" />;
                    const off = t < floor;
                    return (
                      <span key={c} role="gridcell" aria-selected={t === value}>
                        <button type="button" tabIndex={t === focus ? 0 : -1} aria-disabled={off || undefined}
                          aria-label={say(lang, t, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                          className={`mz-date__day${t === value ? ' is-on' : ''}${t === todayUtc() ? ' is-today' : ''}`}
                          onClick={() => pick(t)} onFocus={() => t !== focus && setFocus(t)}>
                          {df(locale, { day: 'numeric' }).format(t)}
                        </button>
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
