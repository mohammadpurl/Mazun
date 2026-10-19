'use client';
/* Shopper tools under each garment: size guide + size advice, virtual try-on, style guide, arrival planner.
   Each works without AI (built-in answers); with AI keys on the server they call /api/ai. */
import { useState } from 'react';
import { chartOf, planArrival, suggestSize } from '@/lib/fit';
import type { Garment, Lang, Settings } from '@/lib/types';
import { LOCALE, STRINGS } from './i18n';

type Tab = 'size' | 'tryon' | 'style' | 'arrive';
export interface AiFlags { text: boolean; image: boolean }

async function ai<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  const r = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload }) });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

/** Downscales a photo to a JPEG data URL so uploads stay small. */
function fileToDataUrl(file: File, max = 768): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      res(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

/** Built-in try-on: the garment drawn over the customer's photo. */
function overlay(personUrl: string, garmentUrl: string): Promise<string> {
  const load = (u: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = u; });
  return Promise.all([load(personUrl), load(garmentUrl)]).then(([p, g]) => {
    const W = 480, H = 640, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d')!;
    const s = Math.max(W / p.width, H / p.height);
    x.drawImage(p, (W - p.width * s) / 2, (H - p.height * s) / 2, p.width * s, p.height * s);
    const gh = H * 0.78, gw = gh * g.width / g.height;
    x.save(); x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 18; x.globalAlpha = 0.93;
    x.drawImage(g, (W - gw) / 2, H * 0.17, gw, gh); x.restore();
    return c.toDataURL('image/jpeg', 0.9);
  });
}

export function Tools({ garment, lang, settings, aiOn }: { garment: Garment; lang: Lang; settings: Settings; aiOn: AiFlags }) {
  const [tab, setTab] = useState<Tab | null>(null);
  const t = STRINGS[lang].tools;
  const tabs: Tab[] = ['size', 'tryon', 'style', 'arrive'];
  return (
    <div className="tl">
      <div className="tl-chips">
        {tabs.map(k => (
          <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(tab === k ? null : k)}>{t[k]}</button>
        ))}
      </div>
      {tab && (
        <div className="tl-body" key={tab + garment.id + lang}>
          {tab === 'size' && <SizeTool garment={garment} lang={lang} aiOn={aiOn.text} />}
          {tab === 'tryon' && <TryOnTool garment={garment} lang={lang} aiOn={aiOn.image} />}
          {tab === 'style' && <StyleTool garment={garment} lang={lang} aiOn={aiOn.text} />}
          {tab === 'arrive' && <ArriveTool garment={garment} lang={lang} settings={settings} aiOn={aiOn.text} />}
        </div>
      )}
    </div>
  );
}

function SizeTool({ garment, lang, aiOn }: { garment: Garment; lang: Lang; aiOn: boolean }) {
  const t = STRINGS[lang].tools;
  const chart = chartOf(garment);
  const [h, setH] = useState(''), [w, setW] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [hl, setHl] = useState<string | null>(null);
  const [out, setOut] = useState<React.ReactNode>(null);
  const [busy, setBusy] = useState(false);

  async function find() {
    const hn = Number(h), wn = Number(w);
    if (!(hn > 0) || !(wn > 0)) { setOut(t.fillHW); return; }
    const local = suggestSize(garment, hn, wn);
    if (!aiOn || !local) {
      if (!local) return;
      setHl(local.pick);
      setOut(<>
        {t.your}: <b>{local.size}</b> <span className="tl-note">({t.basis})</span>
        {local.soldOut && <><br />{local.pick ? <>{t.soldOut} <b>{local.pick}</b></> : t.noneLeft}</>}
        {local.length && <><br />{local.length === 'long' ? t.long : local.length === 'short' ? t.short : t.okLen}</>}
      </>);
      return;
    }
    setBusy(true); setOut(t.thinking);
    try {
      const r = await ai<{ size: string; reason: string }>('size', { lang, height: hn, weight: wn, chart, sizes: garment.sizes, photo: photo ? await fileToDataUrl(photo) : null });
      setHl(r.size);
      setOut(<>{t.your}: <b>{r.size}</b><br />{r.reason}</>);
    } catch { setOut(t.err); } finally { setBusy(false); }
  }

  return <>
    <table>
      <thead><tr><th>{t.sz}</th><th>{t.bust}</th><th>{t.waist}</th><th>{t.hips}</th><th>{t.length}</th></tr></thead>
      <tbody>{Object.entries(chart).map(([n, c]) => (
        <tr key={n} className={hl === n ? 'hl' : ''}><td>{n}</td><td>{c.bust ?? '–'}</td><td>{c.waist ?? '–'}</td><td>{c.hips ?? '–'}</td><td>{c.length ?? '–'}</td></tr>
      ))}</tbody>
    </table>
    <div className="tl-note">{t.cm}</div>
    <div className="tl-row">
      <label>{t.h}<input type="number" min={120} max={210} inputMode="numeric" value={h} onChange={e => setH(e.target.value)} /></label>
      <label>{t.w}<input type="number" min={30} max={200} inputMode="numeric" value={w} onChange={e => setW(e.target.value)} /></label>
    </div>
    {aiOn && <label>{t.photoOpt}<input type="file" accept="image/*" onChange={e => setPhoto(e.target.files?.[0] ?? null)} /></label>}
    <button type="button" className="tl-go" disabled={busy} onClick={find}>{t.find}</button>
    <div className="tl-out" aria-live="polite">{out}</div>
  </>;
}

function TryOnTool({ garment, lang, aiOn }: { garment: Garment; lang: Lang; aiOn: boolean }) {
  const t = STRINGS[lang].tools;
  const [file, setFile] = useState<File | null>(null);
  const [img, setImg] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!file) { setMsg(t.upl); return; }
    setBusy(true); setMsg(t.thinking); setImg(null);
    try {
      const person = await fileToDataUrl(file, 1024);
      const src = aiOn
        ? (await ai<{ image: string }>('tryon', { person, garment: new URL(garment.front, location.href).href, lang })).image
        : await overlay(person, garment.front);
      setImg(src); setMsg('');
    } catch { setMsg(t.err); } finally { setBusy(false); }
  }
  return <>
    <label>{t.upl}<input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
    <button type="button" className="tl-go" disabled={busy} onClick={go}>{t.see}</button>
    <div className="tl-out" aria-live="polite">{msg}</div>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {img && <img className="tl-img" src={img} alt="" />}
    <div className="tl-note">{aiOn ? t.tryNoteAi : t.tryNote}</div>
  </>;
}

function StyleTool({ garment, lang, aiOn }: { garment: Garment; lang: Lang; aiOn: boolean }) {
  const t = STRINGS[lang].tools;
  const [occ, setOcc] = useState<keyof typeof t.tips>('daily');
  const [out, setOut] = useState<React.ReactNode>(null);
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!aiOn) { setOut(<ul>{t.tips[occ].map(x => <li key={x}>{x}</li>)}</ul>); return; }
    setBusy(true); setOut(t.thinking);
    try {
      const r = await ai<{ text: string }>('style', { lang, occasion: occ, garment: garment.name[lang] || garment.name.en, image: new URL(garment.front, location.href).href });
      setOut(r.text);
    } catch { setOut(t.err); } finally { setBusy(false); }
  }
  return <>
    <div className="tl-row">
      <label>{t.occ}
        <select value={occ} onChange={e => setOcc(e.target.value as keyof typeof t.tips)}>
          {(['daily', 'work', 'party', 'travel'] as const).map(k => <option key={k} value={k}>{t[k]}</option>)}
        </select>
      </label>
    </div>
    <button type="button" className="tl-go" disabled={busy} onClick={go}>{t.getStyle}</button>
    <div className="tl-out" aria-live="polite">{out}</div>
  </>;
}

function ArriveTool({ garment, lang, settings, aiOn }: { garment: Garment; lang: Lang; settings: Settings; aiOn: boolean }) {
  const t = STRINGS[lang].tools;
  const [date, setDate] = useState('');
  const [out, setOut] = useState<React.ReactNode>(null);
  const [extra, setExtra] = useState('');
  const fmt = (d: Date) => d.toLocaleDateString(LOCALE[lang], { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  async function go() {
    setExtra('');
    if (!date) { setOut(t.pickDate); return; }
    const now = new Date();
    // The visitor's own calendar day, expressed as a UTC date for the planner.
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const a = planArrival(new Date(date + 'T00:00:00Z'), today, { prep: settings.prepDays, lead: garment.leadDays, ship: settings.shipDays, buffer: settings.bufferDays });
    setOut(a.verdict === 'late' ? <>{t.tooLate} <b>{fmt(a.earliest)}</b></>
      : a.verdict === 'good' ? <>{t.good}<br />{t.orderBy}: <b>{fmt(a.latest)}</b><br />{t.ifToday}: <b>{fmt(a.earliest)}</b></>
      : <>{t.tight}<br />{t.ifToday}: <b>{fmt(a.earliest)}</b></>);
    if (aiOn) {
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      try { setExtra((await ai<{ text: string }>('arrive', { lang, garment: garment.name[lang], event: date, today: iso(today), earliest: iso(a.earliest), latest: iso(a.latest) })).text); }
      catch { /* the computed dates above are still correct */ }
    }
  }
  return <>
    <label>{t.evDate}<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
    <button type="button" className="tl-go" onClick={go}>{t.calc}</button>
    <div className="tl-out" aria-live="polite">{out}</div>
    {extra && <div className="tl-note">{extra}</div>}
  </>;
}
