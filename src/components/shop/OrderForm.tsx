'use client';
import { useState } from 'react';
import type { Lang } from '@/lib/types';
import { STRINGS } from './i18n';

export interface Placed { id: number; garmentName: string; price: number; customerName: string }

/** Collects the customer's details and places the order through /api/orders. */
export function OrderForm({ garmentId, size, lang, onCancel, onSoldOut, onPlaced }: {
  garmentId: string; size: string; lang: Lang;
  onCancel: () => void; onSoldOut: () => void; onPlaced: (o: Placed) => void;
}) {
  const t = STRINGS[lang];
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = Object.fromEntries(['customerName', 'phone', 'city', 'address', 'note', 'eventDate', 'website'].map(k => [k, String(f.get(k) ?? '')]));
    const local: Record<string, string> = {};
    if (body.customerName.trim().length < 2) local.customerName = t.eName;
    const digits = (body.phone.match(/[0-9۰-۹٠-٩]/g) ?? []).length;
    if (digits < 7 || digits > 15) local.phone = t.ePhone;
    setErrors(local); setMsg('');
    if (Object.keys(local).length) return;

    setBusy(true);
    try {
      const r = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, garmentId, size, lang }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) { onPlaced({ ...data, customerName: body.customerName.trim() }); return; }
      if (r.status === 429) setMsg(t.eRate);
      else if (data.errors?.size === 'soldout') onSoldOut();
      else if (data.errors?.garmentId) setMsg(t.eGone);
      else if (data.errors) setErrors({ ...(data.errors.customerName && { customerName: t.eName }), ...(data.errors.phone && { phone: t.ePhone }) });
      else setMsg(t.eNet);
    } catch {
      setMsg(t.eNet);
    } finally {
      setBusy(false);
    }
  }

  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className={`field${errors[name] ? ' bad' : ''}`}>
      {label}
      <input name={name} aria-invalid={!!errors[name]} {...props} />
      {errors[name] && <span className="e">{errors[name]}</span>}
    </label>
  );

  return (
    <form className="oform" onSubmit={submit} noValidate>
      <h3>{t.formTitle}</h3>
      {field('customerName', t.name, { autoComplete: 'name', required: true, maxLength: 80 })}
      {field('phone', t.phone, { type: 'tel', autoComplete: 'tel', inputMode: 'tel', dir: 'ltr', required: true, maxLength: 20 })}
      <div className="grid2">
        {field('city', t.city, { autoComplete: 'address-level2', maxLength: 60 })}
        {field('eventDate', t.eventDate, { type: 'date' })}
      </div>
      {field('address', t.address, { autoComplete: 'street-address', maxLength: 300 })}
      <label className="field">{t.note}<textarea name="note" maxLength={500} /></label>
      <div className="hp" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div className="msg" role="alert">{msg}</div>
      <div className="row">
        <button type="submit" className="primary" disabled={busy} style={{ flex: 1 }}>{busy ? t.sending : t.submit}</button>
        <button type="button" className="ghost" onClick={onCancel} disabled={busy}>{t.cancel}</button>
      </div>
    </form>
  );
}
