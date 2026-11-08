'use client';
/* Small controls shared by every admin page. */
import Link from 'next/link';
import { motion } from 'motion/react';
import { useId, useState, type ReactNode } from 'react';
import { initials, tintOf } from '@/lib/customers';
import { PAYMENT_LABEL, STATUS_LABEL } from '@/lib/labels';
import type { L10n, OrderStatus, PaymentStatus } from '@/lib/types';
import { faPct } from './format';
import { AIcon, type AIconName } from './Icon';

/** Period and view switches: one pressed option on a sliding pill. */
export function Segmented<V extends string>({ value, onChange, options, label, dark, size, grid }: {
  value: V; onChange: (v: V) => void; options: { value: V; label: string; count?: number; icon?: AIconName }[]; label: string; dark?: boolean; size?: 'sm';
  /** Two equal columns, for four options in a narrow card. */
  grid?: boolean;
}) {
  const id = useId();
  return (
    <div className={`seg${dark ? ' on-dark' : ''}${grid ? ' grid2' : ''}`} role="group" aria-label={label} style={size === 'sm' ? { fontSize: 12 } : undefined}>
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.value === value && <motion.span layoutId={`seg-${id}`} className="pill" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
          {o.icon && <AIcon name={o.icon} />}
          <span>{o.label}</span>
          {o.count !== undefined && <span className="n num">{o.count.toLocaleString('fa-IR')}</span>}
        </button>
      ))}
    </div>
  );
}

export function Checkbox({ checked, onChange, label, hideLabel, indeterminate }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hideLabel?: boolean; indeterminate?: boolean;
}) {
  return (
    <label className="cb">
      <input type="checkbox" checked={checked} ref={el => { if (el) el.indeterminate = !!indeterminate; }} onChange={e => onChange(e.target.checked)} aria-label={hideLabel ? label : undefined} />
      <span className="box" aria-hidden="true"><AIcon name={indeterminate ? 'minus' : 'check'} /></span>
      {!hideLabel && <span>{label}</span>}
    </label>
  );
}

export function Switch({ checked, onChange, label, hint, hideLabel }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; hideLabel?: boolean }) {
  const id = useId();
  if (hideLabel) return <span className="sw"><button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} /></span>;
  return (
    <div className="sw">
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={id} aria-describedby={hint ? id + 'h' : undefined} onClick={() => onChange(!checked)} />
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.4 }} onClick={() => onChange(!checked)}>
        <span id={id}>{label}</span>
        {hint && <span id={id + 'h'} className="xs muted">{hint}</span>}
      </span>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label?: string }) {
  return (
    <div className="search input-wrap">
      <AIcon name="search" />
      <input className="input" type="search" value={value} placeholder={placeholder} aria-label={label ?? placeholder} onChange={e => onChange(e.target.value)}
        style={value ? { paddingInlineEnd: 44 } : undefined} />
      {value && <button type="button" className="icon-btn sm clear" aria-label="پاک کردن جستجو" onClick={() => onChange('')}><AIcon name="close" /></button>}
    </div>
  );
}

const STATUS_ICON: Record<OrderStatus, AIconName> = { new: 'sparkle', confirmed: 'sealCheck', preparing: 'hourglass', shipped: 'shipments', delivered: 'done', cancelled: 'xCircle' };
export function StatusChip({ status }: { status: OrderStatus }) {
  return <span className={`chip st-${status}`}><AIcon name={STATUS_ICON[status]} />{STATUS_LABEL[status]}</span>;
}
export const statusIcon = (s: OrderStatus) => STATUS_ICON[s];
const PAY_ICON: Record<PaymentStatus, AIconName> = { unpaid: 'clock', partial: 'handCoins', paid: 'done', refunded: 'undo' };
export function PayChip({ status }: { status: PaymentStatus }) {
  return <span className={`chip pay-${status}`}><AIcon name={PAY_ICON[status]} />{PAYMENT_LABEL[status]}</span>;
}

/** +12٪ / −8٪ against the previous period; nothing to compare shows "تازه". */
export function Delta({ value, invert }: { value: number | null; invert?: boolean }) {
  if (value === null) return <span className="delta flat">—</span>;
  const good = invert ? value < 0 : value > 0;
  const cls = value === 0 ? 'flat' : good ? 'up' : 'down';
  return (
    <span className={`delta ${cls}`} aria-label={`${value >= 0 ? 'افزایش' : 'کاهش'} ${faPct(Math.abs(value), 1)}`}>
      {value !== 0 && <AIcon name={value > 0 ? 'trendUp' : 'trendDown'} />}{value > 0 ? '+' : value < 0 ? '−' : ''}{faPct(Math.abs(value), 1)}
    </span>
  );
}

export function Avatar({ name, seed, size }: { name: string; seed?: string; size?: 'sm' | 'lg' }) {
  return <span className={`av t${tintOf(seed ?? name)}${size ? ' ' + size : ''}`} aria-hidden="true">{initials(name)}</span>;
}

export function PageHeader({ icon, title, sub, crumbs, children }: {
  icon: AIconName; title: string; sub?: ReactNode; crumbs?: { label: string; href?: string }[]; children?: ReactNode;
}) {
  return (
    <motion.header className="page-head" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
      <motion.span className="tile" initial={{ scale: 0.6, rotate: -12, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.08 }}>
        <AIcon name={icon} duo />
      </motion.span>
      <div className="titles">
        {crumbs && (
          <nav className="crumbs" aria-label="مسیر صفحه">
            {crumbs.map((c, i) => (
              <span key={i} className="row" style={{ gap: 6 }}>
                {i > 0 && <AIcon name="left" />}
                {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {children && <div className="actions">{children}</div>}
    </motion.header>
  );
}

export function Empty({ icon = 'package', title, body, action, small }: { icon?: AIconName; title: string; body?: ReactNode; action?: ReactNode; small?: boolean }) {
  return (
    <div className={`empty${small ? ' sm' : ''}`}>
      <motion.span className="art" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 18 }}><AIcon name={icon} duo /></motion.span>
      <b>{title}</b>
      {body && <span>{body}</span>}
      {action}
    </div>
  );
}

/** Label + control + help/error, wired with aria-describedby. The control is rendered by `children(id, describedBy)`. */
export function Field({ label, help, error, children, className }: {
  label: string; help?: ReactNode; error?: string; className?: string; children: (id: string, describedBy: string | undefined, invalid: boolean) => ReactNode;
}) {
  const id = useId();
  const described = [help ? id + 'h' : '', error ? id + 'e' : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field${className ? ' ' + className : ''}`}>
      <label className="lbl" htmlFor={id} id={id + 'l'}>{label}</label>
      {children(id, described, !!error)}
      {help && !error && <span className="help" id={id + 'h'}>{help}</span>}
      {error && <span className="err" id={id + 'e'} role="alert"><AIcon name="warning" />{error}</span>}
    </div>
  );
}

const LANGS = [['fa', 'فارسی'], ['ar', 'عربی'], ['en', 'English']] as const;
/** One translated text with a tab per language; a dot marks the languages that are filled in. */
export function L10nField({ label, value, onChange, multiline, max = 200, error, help }: {
  label: string; value: L10n; onChange: (v: L10n) => void; multiline?: boolean; max?: number; error?: string; help?: string;
}) {
  const id = useId();
  const [lang, setLang] = useState<keyof L10n>('fa');
  const props = {
    id: id + lang, value: value[lang], dir: lang === 'en' ? 'ltr' : 'rtl', maxLength: max, 'aria-labelledby': `${id}l ${id}t${lang}`,
    'aria-invalid': !!error || undefined, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [lang]: e.target.value }),
  } as const;
  return (
    <div className="l10n field">
      <div className="l10n-head">
        <span className="lbl" id={id + 'l'}>{label}</span>
        <div className="l10n-tabs" role="tablist" aria-label={`زبان ${label}`}>
          {LANGS.map(([l, name]) => (
            <button key={l} id={`${id}t${l}`} type="button" role="tab" aria-selected={lang === l} aria-controls={id + l} onClick={() => setLang(l)}>
              <i className={value[l].trim() ? '' : 'empty'} aria-hidden="true" />{name}
            </button>
          ))}
        </div>
      </div>
      {multiline ? <textarea className="textarea" role="tabpanel" {...props} /> : <input className="input" role="tabpanel" {...props} />}
      {help && !error && <span className="help">{help}</span>}
      {error && <span className="err" role="alert"><AIcon name="warning" />{error}</span>}
    </div>
  );
}

export function Skeleton({ h = 16, w = '100%', r }: { h?: number; w?: number | string; r?: number }) {
  return <span className="sk" style={{ display: 'block', height: h, width: w, borderRadius: r }} aria-hidden="true" />;
}
