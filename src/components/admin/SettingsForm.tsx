'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { L10n, Settings } from '@/lib/types';
import { api } from './api';

type L10nKey = 'brand' | 'tagline' | 'ticker' | 'currency' | 'originCity';
const L10N_FIELDS: [L10nKey, string][] = [
  ['brand', 'نام برند'], ['tagline', 'زیرعنوان'], ['ticker', 'متن نوار پایین صفحه'], ['currency', 'واحد پول'], ['originCity', 'شهر مبدأ ارسال'],
];

export function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => { setS(x => ({ ...x, [k]: v })); setMsg(null); };
  const setL = (k: L10nKey, l: keyof L10n, v: string) => set(k, { ...s[k], [l]: v });

  async function save() {
    setBusy(true); setErrors({}); setMsg(null);
    try {
      const saved = await api<Settings>('/api/admin/settings', 'PUT', s);
      setS(saved); setMsg({ ok: true, text: 'ذخیره شد ✓ تغییرات همین حالا در سایت دیده می‌شود.' });
      router.refresh();
    } catch (e) {
      setErrors((e as Error & { errors?: Record<string, string> }).errors ?? {});
      setMsg({ ok: false, text: (e as Error).message });
    } finally { setBusy(false); }
  }

  const days = (k: 'prepDays' | 'shipDays' | 'bufferDays', label: string) => (
    <label className="f">{label}<input type="number" min={0} max={365} value={s[k]} onChange={e => set(k, Math.max(0, Number(e.target.value) || 0))} /></label>
  );

  return (
    <div className="stack">
      <div className="top"><h1>تنظیمات سایت</h1></div>

      <section className="card stack">
        <h2>متن‌های سایت</h2>
        {L10N_FIELDS.map(([k, label]) => (
          <fieldset key={k}>
            <legend>{label}</legend>
            <div className="grid">
              {(['fa', 'ar', 'en'] as const).map(l => (
                <label key={l} className="f">{{ fa: 'فارسی', ar: 'عربی', en: 'انگلیسی' }[l]}
                  <input value={s[k][l]} dir={l === 'en' ? 'ltr' : 'rtl'} onChange={e => setL(k, l, e.target.value)} />
                </label>
              ))}
            </div>
            {errors[k] && <span className="err small">{errors[k]}</span>}
          </fieldset>
        ))}
      </section>

      <section className="card stack">
        <h2>دریافت سفارش</h2>
        <p className="muted small" style={{ margin: 0 }}>سفارش اول در پنل ثبت می‌شود، بعد مشتری با یک پیام آماده به این کانال هدایت می‌شود.</p>
        <div className="grid">
          <label className="f">کانال سفارش
            <select value={s.channel} onChange={e => set('channel', e.target.value as Settings['channel'])}>
              <option value="whatsapp">واتس‌اپ</option><option value="telegram">تلگرام</option><option value="instagram">اینستاگرام</option>
            </select>
          </label>
          <label className="f">شماره واتس‌اپ (با کد کشور، مثل 96891234567)
            <input value={s.whatsapp} dir="ltr" inputMode="numeric" onChange={e => set('whatsapp', e.target.value)} />
            {errors.whatsapp && <span className="err">{errors.whatsapp}</span>}
          </label>
          <label className="f">نام کاربری تلگرام (بدون @)
            <input value={s.telegram} dir="ltr" onChange={e => set('telegram', e.target.value)} />
            {errors.telegram && <span className="err">{errors.telegram}</span>}
          </label>
          <label className="f">نام کاربری اینستاگرام (بدون @)
            <input value={s.instagram} dir="ltr" onChange={e => set('instagram', e.target.value)} />
            {errors.instagram && <span className="err">{errors.instagram}</span>}
          </label>
        </div>
      </section>

      <section className="card stack">
        <h2>زمان‌بندی ارسال</h2>
        <p className="muted small" style={{ margin: 0 }}>ابزار «زمان رسیدن» در سایت با این اعداد (به‌علاوهٔ روزهای اضافهٔ هر لباس) آخرین روز سفارش را حساب می‌کند.</p>
        <div className="grid">
          {days('prepDays', 'روزهای آماده‌سازی سفارش')}
          {days('shipDays', 'روزهای ارسال')}
          {days('bufferDays', 'روزهای حاشیهٔ اطمینان')}
        </div>
      </section>

      <div className="row">
        <button type="button" className="btn" disabled={busy} onClick={save}>{busy ? 'در حال ذخیره…' : 'ذخیرهٔ تنظیمات'}</button>
        {msg && <span className={`msg ${msg.ok ? 'ok' : 'err'}`} role="status">{msg.text}</span>}
      </div>
    </div>
  );
}
