'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Garment, HomeContent, L10n, Settings } from '@/lib/types';
import { api } from './api';
import { ImageField } from './fields';

type L10nKey = 'brand' | 'tagline' | 'ticker' | 'currency' | 'originCity';
const L10N_FIELDS: [L10nKey, string][] = [
  ['brand', 'نام برند'], ['tagline', 'زیرعنوان'], ['ticker', 'متن نوار پایین صفحه'], ['currency', 'واحد پول'], ['originCity', 'شهر مبدأ ارسال'],
];

export function SettingsForm({ initial, garments }: { initial: Settings; garments: Garment[] }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => { setS(x => ({ ...x, [k]: v })); setMsg(null); };
  const setL = (k: L10nKey, l: keyof L10n, v: string) => set(k, { ...s[k], [l]: v });
  const setHome = (o: Partial<HomeContent>) => set('home', { ...s.home, ...o });
  const [uploading, setUploading] = useState(0);
  const onBusy = (b: boolean) => setUploading(n => n + (b ? 1 : -1));

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

      <section className="card stack">
        <h2>صفحهٔ اصلی</h2>
        <p className="muted small" style={{ margin: 0 }}>تا عکسی گذاشته نشود، جای آن رنگ ملایم نمایش داده می‌شود. عکس‌ها خودکار کوچک و بهینه می‌شوند. عکس مجموعه‌ها در بخش «مجموعه‌ها» است. بعد از تغییر، «ذخیرهٔ تنظیمات» را بزنید.</p>
        <label className="f" style={{ maxWidth: 420 }}>لباس معرفی‌شده زیر عکس اصلی
          <select value={s.home.featuredId ?? ''} onChange={e => setHome({ featuredId: e.target.value || null })}>
            <option value="">اولین لباس رگال</option>
            {garments.filter(g => g.kind === 'garment').map(g => <option key={g.id} value={g.id}>{g.name.fa || g.name.en}</option>)}
          </select>
        </label>
        <div className="imgs" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
          <ImageField label="عکس اصلی بالای صفحه (افقی، عریض)" value={s.home.hero} onChange={hero => setHome({ hero })} onBusy={onBusy} />
          <ImageField label="نمای نزدیک پارچه (مربع)" value={s.home.fabric} onChange={fabric => setHome({ fabric })} onBusy={onBusy} />
          <ImageField label="آتلیه (افقی، خیلی عریض)" value={s.home.atelier} onChange={atelier => setHome({ atelier })} onBusy={onBusy} />
          <ImageField label="اتاق پرو: عکس نمونهٔ مشتری (۳ به ۴)" value={s.home.tryBefore} onChange={tryBefore => setHome({ tryBefore })} onBusy={onBusy} />
          <ImageField label="اتاق پرو: همان مشتری با لباس (۳ به ۴)" value={s.home.tryAfter} onChange={tryAfter => setHome({ tryAfter })} onBusy={onBusy} />
        </div>
      </section>

      <div className="row">
        <button type="button" className="btn" disabled={busy || uploading > 0} onClick={save}>{busy ? 'در حال ذخیره…' : 'ذخیرهٔ تنظیمات'}</button>
        {msg && <span className={`msg ${msg.ok ? 'ok' : 'err'}`} role="status">{msg.text}</span>}
      </div>
    </div>
  );
}
