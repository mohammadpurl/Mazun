'use client';
/* Site settings: brand texts, where orders are sent, delivery timing, the monthly sales goal for the dashboard, and
   the home page's pictures and featured piece. One save bar for the whole page. */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Garment, HomeContent, L10n, OrderChannel, Settings } from '@/lib/types';
import { useUi } from '../ui/Dialog';
import { Dropdown } from '../ui/Dropdown';
import { Field, L10nField, PageHeader, Segmented } from '../ui/controls';
import { faDigits, faNum, intInput, numInput, faGrouped } from '../ui/format';
import { AIcon, type AIconName } from '../ui/Icon';
import { Reveal } from '../ui/motion';
import { useLeaveGuard } from '../ui/useLeaveGuard';
import { api } from '../api';
import { Slot } from '../products/Media';

type L10nKey = 'brand' | 'tagline' | 'ticker' | 'currency' | 'originCity';
const TEXTS: [L10nKey, string, string?][] = [
  ['brand', 'نام برند'], ['tagline', 'زیرعنوان', 'زیر نام برند در سربرگ'], ['ticker', 'متن نوار بالای سایت'], ['currency', 'واحد پول', 'در قیمت‌ها و پنل'], ['originCity', 'شهر مبدأ ارسال'],
];
const SECTIONS: { id: string; label: string; icon: AIconName }[] = [
  { id: 'texts', label: 'برند و متن‌ها', icon: 'store' }, { id: 'channel', label: 'دریافت سفارش', icon: 'whatsapp' },
  { id: 'delivery', label: 'زمان‌بندی ارسال', icon: 'timer' }, { id: 'goal', label: 'هدف فروش', icon: 'target' }, { id: 'home', label: 'صفحهٔ اصلی', icon: 'home' },
];

export function SettingsPage({ initial, garments }: { initial: Settings; garments: Garment[] }) {
  const router = useRouter();
  const { toast } = useUi();
  const [saved, setSaved] = useState(initial);
  const [s, setS] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [goalText, setGoalText] = useState(initial.monthlyGoal ? String(initial.monthlyGoal) : '');
  const dirty = JSON.stringify(s) !== JSON.stringify(saved);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS(x => ({ ...x, [k]: v }));
  const setHome = (o: Partial<HomeContent>) => setS(x => ({ ...x, home: { ...x.home, ...o } }));
  const currency = s.currency.fa || 'ریال';

  useLeaveGuard(dirty && !busy);

  async function save() {
    setBusy(true); setErrors({});
    try {
      const out = await api<Settings>('/api/admin/settings', 'PUT', s);
      setS(out); setSaved(out);
      toast('ok', 'تنظیمات ذخیره شد', 'تغییرات همین حالا در سایت دیده می‌شود.');
      router.refresh();
    } catch (e) {
      const er = (e as Error & { errors?: Record<string, string> }).errors ?? {};
      setErrors(er);
      toast('err', 'ذخیره نشد', (e as Error).message);
      const first = Object.keys(er)[0];
      document.getElementById(['whatsapp', 'telegram', 'instagram'].includes(first) ? 'channel' : 'texts')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } finally { setBusy(false); }
  }
  const days = (k: 'prepDays' | 'shipDays' | 'bufferDays', label: string, help: string) => (
    <Field label={label} help={help}>{(id, d) => (
      <div className="input-wrap">
        <input id={id} className="input num" inputMode="numeric" aria-describedby={d} value={faDigits(String(s[k]))} onChange={e => set(k, Math.min(365, Number(intInput(e.target.value)) || 0))} />
        <span className="suffix">روز</span>
      </div>
    )}</Field>
  );
  const head = (id: string, title: string, sub: string, icon: AIconName) => (
    <div className="card-head" style={{ margin: 0 }}><span className="tile sm soft"><AIcon name={icon} duo /></span><div className="titles"><h2>{title}</h2><p>{sub}</p></div></div>
  );

  return (
    <>
      <PageHeader icon="settings" title="تنظیمات سایت" crumbs={[{ label: 'تنظیمات' }, { label: 'تنظیمات سایت' }]} sub="متن‌های فروشگاه، کانال سفارش، زمان ارسال، هدف فروش و صفحهٔ اصلی." />
      <div className="settings">
        <aside className="aside">
          <nav className="card section-nav" aria-label="بخش‌های تنظیمات" style={{ padding: 10 }}>
            {SECTIONS.map(x => <a key={x.id} href={`#${x.id}`}><AIcon name={x.icon} duo /><span>{x.label}</span></a>)}
          </nav>
        </aside>
        <div className="stack">
          <Reveal className="card stack" id="texts" style={{ scrollMarginTop: 104 }}>
            {head('texts', 'برند و متن‌ها', 'به سه زبان فروشگاه؛ زبانی که خالی بماند از انگلیسی پر می‌شود', 'store')}
            {TEXTS.map(([k, label, help]) => <L10nField key={k} label={label} help={help} value={s[k] as L10n} onChange={v => set(k, v)} max={k === 'currency' ? 20 : 120} error={errors[k]} />)}
          </Reveal>

          <Reveal className="card stack" id="channel" style={{ scrollMarginTop: 104 }}>
            {head('channel', 'دریافت سفارش', 'سفارش اول در پنل ثبت می‌شود، بعد مشتری با پیام آماده به این کانال می‌رود', 'whatsapp')}
            <Segmented<OrderChannel> label="کانال سفارش" value={s.channel} onChange={v => set('channel', v)} options={[
              { value: 'whatsapp', label: 'واتس‌اپ', icon: 'whatsapp' }, { value: 'telegram', label: 'تلگرام', icon: 'send' }, { value: 'instagram', label: 'اینستاگرام', icon: 'image' },
            ]} />
            <div className="form-grid">
              <Field label="شمارهٔ واتس‌اپ" help="با کد کشور و فقط رقم، مثل 96891234567" error={errors.whatsapp}>{(id, d, bad) => <input id={id} className="input ltr" inputMode="numeric" aria-describedby={d} aria-invalid={bad || undefined} value={s.whatsapp} onChange={e => set('whatsapp', e.target.value)} />}</Field>
              <Field label="نام کاربری تلگرام" help="بدون @" error={errors.telegram}>{(id, d, bad) => <input id={id} className="input ltr" aria-describedby={d} aria-invalid={bad || undefined} value={s.telegram} onChange={e => set('telegram', e.target.value)} />}</Field>
              <Field label="نام کاربری اینستاگرام" help="بدون @" error={errors.instagram}>{(id, d, bad) => <input id={id} className="input ltr" aria-describedby={d} aria-invalid={bad || undefined} value={s.instagram} onChange={e => set('instagram', e.target.value)} />}</Field>
            </div>
          </Reveal>

          <Reveal className="card stack" id="delivery" style={{ scrollMarginTop: 104 }}>
            {head('delivery', 'زمان‌بندی ارسال', 'ابزار «زمان رسیدن» سایت با این اعداد و روزهای اضافهٔ هر لباس آخرین روز سفارش را حساب می‌کند', 'timer')}
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
              {days('prepDays', 'آماده‌سازی سفارش', 'دوخت و بسته‌بندی')}
              {days('shipDays', 'ارسال', 'از آتلیه تا مشتری')}
              {days('bufferDays', 'حاشیهٔ اطمینان', 'برای پیش‌آمدها')}
            </div>
            <div className="alert info"><AIcon name="info" /><div className="grow"><b>روی هم {faNum(s.prepDays + s.shipDays + s.bufferDays)} روز</b><p>مشتری باید دست‌کم این‌قدر پیش از مراسمش سفارش بدهد.</p></div></div>
          </Reveal>

          <Reveal className="card stack" id="goal" style={{ scrollMarginTop: 104 }}>
            {head('goal', 'هدف فروش ماهانه', 'در داشبورد کنار فروش این ماه نشان داده می‌شود؛ صفر یعنی بدون هدف', 'target')}
            <Field label={`هدف هر ماه (${currency})`}>{(id, d) => (
              <div className="input-wrap" style={{ maxWidth: 320 }}>
                <input id={id} className="input num" inputMode="decimal" aria-describedby={d} value={faGrouped(goalText)} placeholder="مثلاً ۹٬۰۰۰" onChange={e => { const t = numInput(e.target.value); setGoalText(t); set('monthlyGoal', Number(t) || 0); }} />
                <span className="suffix">{currency}</span>
              </div>
            )}</Field>
          </Reveal>

          <Reveal className="card stack" id="home" style={{ scrollMarginTop: 104 }}>
            {head('home', 'صفحهٔ اصلی', 'تا عکسی گذاشته نشود جای آن رنگ ملایم نشان داده می‌شود؛ عکس مجموعه‌ها در بخش «مجموعه‌ها» است', 'home')}
            <Field label="لباس معرفی‌شده زیر عکس اصلی">{(id, d) => (
              <div style={{ maxWidth: 420 }}>
                <Dropdown id={id} describedBy={d} searchable value={s.home.featuredId ?? ''} onChange={v => setHome({ featuredId: v || null })}
                  options={[{ value: '', label: 'اولین لباس رگال' }, ...garments.filter(g => g.kind === 'garment').map(g => ({ value: g.id, label: g.name.fa || g.name.en, swatch: g.colors[0]?.hex }))]} />
              </div>
            )}</Field>
            <div className="slots" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }}>
              <Slot label="نمای نزدیک پارچه (مربع)" hint="رها کنید یا بزنید" value={s.home.fabric} onChange={fabric => setHome({ fabric })} cover onBusy={n => setUploading(u => Math.max(0, u + n))} />
              <Slot label="آتلیه (افقی و عریض)" hint="رها کنید یا بزنید" value={s.home.atelier} onChange={atelier => setHome({ atelier })} cover onBusy={n => setUploading(u => Math.max(0, u + n))} />
            </div>
          </Reveal>

          <div className="savebar">
            <span className={`state${dirty ? '' : ' clean'}`}><i aria-hidden="true" />{uploading ? 'در حال بارگذاری تصویر…' : dirty ? 'تغییرات ذخیره نشده' : 'همه چیز ذخیره شده'}</span>
            {dirty && <button type="button" className="btn ghost" onClick={() => { setS(saved); setGoalText(saved.monthlyGoal ? String(saved.monthlyGoal) : ''); }} disabled={busy}>بازگرداندن</button>}
            <button type="button" className="btn" onClick={save} disabled={busy || uploading > 0 || !dirty}>{busy ? 'در حال ذخیره…' : <><AIcon name="check" />ذخیرهٔ تنظیمات</>}</button>
          </div>
        </div>
      </div>
    </>
  );
}
