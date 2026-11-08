'use client';
/* Sign-in: one password (ADMIN_PASSWORD) on the form side, the atelier's olive abaya on the other. GSAP brings the
   picture and its caption in once; Motion staggers the form. */
import { motion } from 'motion/react';
import { useRef, useState } from 'react';
import { AIcon } from './ui/Icon';
import { item, MotionRoot, stagger, useGsap } from './ui/motion';

export function LoginForm() {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const art = useRef<HTMLDivElement>(null);
  useGsap(art, ({ reduce, gsap }) => {
    if (reduce) return;
    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .from('.ring', { scale: 0.6, opacity: 0, duration: 1.4 })
      .from('img', { y: 60, opacity: 0, duration: 1.2 }, 0.15)
      .from('.quote > *', { y: 24, opacity: 0, duration: 0.8, stagger: 0.12 }, 0.6);
  });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setMsg('');
    const password = String(new FormData(e.currentTarget).get('password') ?? '');
    try {
      const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      if (r.ok) { location.href = '/admin'; return; }
      setMsg((await r.json().catch(() => ({}))).error || 'ورود انجام نشد');
    } catch {
      setMsg('ارتباط با سرور برقرار نشد؛ اینترنت را بررسی کنید و دوباره امتحان کنید');
    } finally {
      setBusy(false);
    }
  }

  return (
    <MotionRoot>
      <div className="login">
        <div className="login-form">
          <motion.form onSubmit={submit} variants={stagger} initial="hidden" animate="show" noValidate>
            <motion.span variants={item} className="brand-mark" aria-hidden="true">M</motion.span>
            <motion.div variants={item} className="stack-sm">
              <h1>ورود به پنل مزون</h1>
              <p className="muted">سفارش‌ها، مشتریان، محصولات و فروش آتلیه در یک جا.</p>
            </motion.div>
            {/* Hidden username so password managers file the password under this site. */}
            <input type="text" name="username" autoComplete="username" value="admin" readOnly hidden />
            <motion.div variants={item} className="field">
              <label className="lbl" htmlFor="pw">رمز عبور</label>
              <div className="pw">
                <input id="pw" className="input" type={show ? 'text' : 'password'} name="password" required autoComplete="current-password" autoFocus dir="ltr"
                  aria-invalid={!!msg || undefined} aria-describedby={msg ? 'pw-err' : undefined} onChange={() => msg && setMsg('')} />
                <button type="button" className="icon-btn" aria-label={show ? 'پنهان کردن رمز' : 'نمایش رمز'} aria-pressed={show} onClick={() => setShow(s => !s)}><AIcon name={show ? 'eyeOff' : 'eye'} /></button>
              </div>
              {msg && <motion.span id="pw-err" className="err" role="alert" initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: [6, -4, 2, 0] }}><AIcon name="warning" />{msg}</motion.span>}
            </motion.div>
            <motion.button variants={item} className="btn" disabled={busy} whileTap={{ scale: 0.98 }}>
              {busy ? <><AIcon name="spinner" className="spin" />در حال ورود…</> : <><AIcon name="lock" />ورود</>}
            </motion.button>
            <motion.p variants={item} className="xs muted">برای امنیت، بعد از ۸ تلاش ناموفق ورود ۱۵ دقیقه بسته می‌ماند.</motion.p>
          </motion.form>
        </div>
        <div className="login-art" ref={art} aria-hidden="true">
          <span className="ring" />
          <img src="/images/models/olive.webp" alt="" />
          <div className="quote">
            <b>MAZUN ATELIER</b>
            <p>عبا و کفتان دست‌دوز از مسقط؛ هر سفارش، از کارگاه تا در خانهٔ مشتری، اینجا دنبال می‌شود.</p>
          </div>
        </div>
      </div>
    </MotionRoot>
  );
}
