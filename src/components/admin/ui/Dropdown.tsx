'use client';
/* The panel's own select (no native <select>): a combobox button with a listbox popover. Keyboard: arrows open and
   move, Home/End, Enter or Space picks, Escape closes, typing a letter jumps to the next option starting with it.
   Optional search field for long lists. Opens upwards when there is no room below. Also: Menu, a button with a list of
   actions, used for row actions and the header menus. */
import Link from 'next/link';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Floating } from './Floating';
import { searchable } from './format';
import { AIcon, type AIconName } from './Icon';

export interface Option<V extends string = string> { value: V; label: string; icon?: AIconName; hint?: string; disabled?: boolean; swatch?: string }

/** Closes the popover on a press outside the trigger and the popover. */
function useOutside(open: boolean, setOpen: (v: boolean) => void, refs: React.RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!refs.some(r => r.current?.contains(e.target as Node))) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

export function Dropdown<V extends string = string>({ value, onChange, options, placeholder = 'انتخاب کنید', label, labelledBy, id, icon, searchable: withSearch,
  variant, align, invalid, describedBy, disabled, prefix }: {
  value: V | '' | null; onChange: (v: V) => void; options: Option<V>[]; placeholder?: string; label?: string; labelledBy?: string; id?: string;
  icon?: AIconName; searchable?: boolean; variant?: 'pill' | 'compact'; align?: 'end'; invalid?: boolean; describedBy?: string; disabled?: boolean; prefix?: string;
}) {
  const auto = useId();
  const listId = `${id ?? auto}-list`;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  useOutside(open, setOpen, [trigger, pop]);
  // The hint is searched too, so a customer can be found by her phone number.
  const shown = useMemo(() => (q ? options.filter(o => searchable(`${o.label} ${o.hint ?? ''}`).includes(searchable(q))) : options), [options, q]);
  const current = options.find(o => o.value === value);

  const openList = useCallback(() => {
    if (disabled) return;
    const i = Math.max(0, options.findIndex(o => o.value === value));
    setQ(''); setActive(i); setOpen(true);
  }, [disabled, options, value]);
  const close = (refocus = true) => { setOpen(false); if (refocus) trigger.current?.focus(); };
  const pick = (o: Option<V> | undefined) => { if (!o || o.disabled) return; onChange(o.value); close(); };

  useEffect(() => {
    if (!open) return;
    pop.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const move = (d: number) => {
    if (!shown.length) return;
    let i = active;
    for (let n = 0; n < shown.length; n++) { i = (i + d + shown.length) % shown.length; if (!shown[i].disabled) break; }
    setActive(i);
  };
  const onKey = (e: KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList(); }
      return;
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(1); break;
      case 'ArrowUp': e.preventDefault(); move(-1); break;
      case 'Home': e.preventDefault(); setActive(0); break;
      case 'End': e.preventDefault(); setActive(shown.length - 1); break;
      case 'Enter': e.preventDefault(); pick(shown[active]); break;
      case ' ': if (!withSearch) { e.preventDefault(); pick(shown[active]); } break;
      case 'Escape': e.preventDefault(); e.stopPropagation(); close(); break;
      case 'Tab': e.preventDefault(); close(); break;
      default:
        if (!withSearch && e.key.length === 1) {
          const k = searchable(e.key);
          const start = active + 1;
          const hit = [...shown.slice(start), ...shown.slice(0, start)].find(o => searchable(o.label).startsWith(k));
          if (hit) setActive(shown.indexOf(hit));
        }
    }
  };
  const optId = (i: number) => `${listId}-${i}`;

  return (
    <div className={`dd${variant ? ' ' + variant : ''}`} onKeyDown={onKey}>
      <button ref={trigger} id={id} type="button" className="dd-trigger" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
        aria-activedescendant={open && !withSearch && shown[active] ? optId(active) : undefined} aria-label={label} aria-labelledby={labelledBy}
        aria-invalid={invalid || undefined} aria-describedby={describedBy} disabled={disabled} onClick={() => (open ? close() : openList())}>
        {(current?.icon ?? icon) && <AIcon name={(current?.icon ?? icon)!} />}
        {current?.swatch && <span className="swatch" style={{ background: current.swatch }} />}
        <span className={`val${current ? '' : ' ph'}`} title={current?.label}>{current ? (prefix ? `${prefix}: ${current.label}` : current.label) : placeholder}</span>
        <AIcon name="down" className="chev" />
      </button>
      <Floating anchor={trigger} open={open} align={align === 'end' ? 'end' : 'start'} popRef={pop} onShown={() => { if (withSearch) search.current?.focus(); }}>
            {withSearch && (
              <div className="pop-search">
                <input ref={search} className="input" value={q} placeholder="جستجو…" aria-label="جستجو در گزینه‌ها" role="combobox" aria-expanded aria-controls={listId}
                  aria-activedescendant={shown[active] ? optId(active) : undefined} onChange={e => { setQ(e.target.value); setActive(0); }} />
              </div>
            )}
            <ul id={listId} role="listbox" className="opts" aria-label={label}>
              {shown.map((o, i) => (
                <li key={o.value} id={optId(i)} data-i={i} role="option" aria-selected={o.value === value} aria-disabled={o.disabled || undefined}
                  className={`opt${i === active ? ' active' : ''}`} onPointerEnter={() => setActive(i)} onPointerDown={e => e.preventDefault()} onClick={() => pick(o)}>
                  {o.icon && <AIcon name={o.icon} />}
                  {o.swatch && <span className="swatch" style={{ background: o.swatch }} />}
                  <span>{o.label}</span>
                  {o.hint && <span className="hint">{o.hint}</span>}
                  <AIcon name="check" className="tick" />
                </li>
              ))}
              {!shown.length && <li className="empty" role="presentation">موردی پیدا نشد</li>}
            </ul>
      </Floating>
    </div>
  );
}

export interface MenuItem { label: string; icon?: AIconName; onSelect?: () => void; href?: string; danger?: boolean; divider?: boolean; external?: boolean }

/** A button that opens a list of actions (role=menu). Arrow keys move, Enter acts, Escape closes. */
export function Menu({ items, label, children, buttonClass = 'icon-btn', align = 'end', width }: {
  items: MenuItem[]; label: string; children: ReactNode; buttonClass?: string; align?: 'start' | 'end'; width?: number;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  useOutside(open, setOpen, [btn, pop]);
  const close = () => { setOpen(false); btn.current?.focus(); };
  const onKey = (e: KeyboardEvent) => {
    if (!open) return;
    const els = [...(pop.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
    if (e.key === 'Home') { e.preventDefault(); els[0]?.focus(); }
    if (e.key === 'End') { e.preventDefault(); els.at(-1)?.focus(); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    if (e.key === 'Tab') { e.preventDefault(); close(); }
  };
  return (
    <div className="dd" style={{ display: 'inline-block' }} onKeyDown={onKey}>
      <button ref={btn} type="button" className={buttonClass} aria-label={buttonClass.includes('icon-btn') ? label : undefined} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => setOpen(o => !o)}>
        {children}
      </button>
      <Floating anchor={btn} open={open} align={align} popRef={pop} id={id} role="menu" label={label} className="pop menu" minWidth={false}
        onShown={() => pop.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus()}>
            {width && <span style={{ display: 'block', width }} aria-hidden="true" />}
            {items.map((it, i) => it.divider ? <hr key={i} /> : it.href && it.external ? (
              <a key={i} role="menuitem" tabIndex={-1} className={`opt${it.danger ? ' danger' : ''}`} href={it.href} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
                {it.icon && <AIcon name={it.icon} />}<span>{it.label}</span>
              </a>
            ) : it.href ? (
              <Link key={i} role="menuitem" tabIndex={-1} className={`opt${it.danger ? ' danger' : ''}`} href={it.href} prefetch={false} onClick={() => setOpen(false)}>
                {it.icon && <AIcon name={it.icon} />}<span>{it.label}</span>
              </Link>
            ) : (
              <button key={i} type="button" role="menuitem" tabIndex={-1} className={`opt${it.danger ? ' danger' : ''}`} onClick={() => { setOpen(false); it.onSelect?.(); }}>
                {it.icon && <AIcon name={it.icon} />}<span>{it.label}</span>
              </button>
            ))}
      </Floating>
    </div>
  );
}
