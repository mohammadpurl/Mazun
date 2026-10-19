'use client';
import { useState } from 'react';

export function LoginForm() {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setMsg('');
    const password = String(new FormData(e.currentTarget).get('password') ?? '');
    try {
      const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      if (r.ok) { location.href = '/admin'; return; }
      setMsg((await r.json().catch(() => ({}))).error || 'ورود انجام نشد');
    } catch {
      setMsg('ارتباط با سرور برقرار نشد');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="card login" onSubmit={submit}>
      <h1>ورود مدیر</h1>
      {/* Hidden username so password managers file the password under this site. */}
      <input type="text" name="username" autoComplete="username" value="admin" readOnly hidden />
      <label className="f">رمز عبور<input type="password" name="password" required autoComplete="current-password" autoFocus /></label>
      <button className="btn" disabled={busy}>{busy ? 'در حال ورود…' : 'ورود'}</button>
      <div className="msg err" role="alert">{msg}</div>
    </form>
  );
}
