'use client';
/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import type { L10n } from '@/lib/types';
import { uploadImage } from './api';

export const LANG_LABEL = { fa: 'فارسی', ar: 'عربی', en: 'انگلیسی' } as const;
export const emptyL10n = (): L10n => ({ en: '', ar: '', fa: '' });

/** One translated text: an input (or textarea) per language. Used by every admin form with shop-facing text. */
export function L10nFields({ label, value, onChange, multiline, max = 200, error }: {
  label: string; value: L10n; onChange: (v: L10n) => void; multiline?: boolean; max?: number; error?: string;
}) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="grid">
        {(['fa', 'ar', 'en'] as const).map(l => (
          <label key={l} className="f">{LANG_LABEL[l]}
            {multiline
              ? <textarea value={value[l]} dir={l === 'en' ? 'ltr' : 'rtl'} maxLength={max} onChange={e => onChange({ ...value, [l]: e.target.value })} />
              : <input value={value[l]} dir={l === 'en' ? 'ltr' : 'rtl'} maxLength={max} onChange={e => onChange({ ...value, [l]: e.target.value })} />}
          </label>
        ))}
      </div>
      {error && <span className="err small">{error}</span>}
    </fieldset>
  );
}

/** Image upload with preview and remove. Uploads immediately (resized to WebP) and reports the URL. */
export function ImageField({ label, hint, value, onChange, onBusy }: {
  label: string; hint?: string; value: string; onChange: (url: string) => void; onBusy?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true); onBusy?.(true); setError('');
    try { onChange(await uploadImage(file, 1800)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); onBusy?.(false); }
  }
  return (
    <div className="drop">
      {value ? <img src={value} alt="" /> : <div className="ph">{hint ?? 'بدون تصویر'}</div>}
      <label className="f" style={{ alignItems: 'center' }}>{label}
        <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      {value && <button type="button" className="btn alt sm" onClick={() => onChange('')}>حذف تصویر</button>}
      {busy && <span className="small muted">در حال بارگذاری…</span>}
      {error && <span className="err small">{error}</span>}
    </div>
  );
}
