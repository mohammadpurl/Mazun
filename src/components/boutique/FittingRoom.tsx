'use client';
/* eslint-disable @next/next/no-img-element -- customer photo and generated preview are data URLs */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { effectivePrice } from '@/lib/fit';
import type { Garment } from '@/lib/types';
import { Art, CLIP } from './Art';
import { useBoutique } from './Boutique';

type State = 'empty' | 'ready' | 'loading' | 'result' | 'error';

/** Downscales a photo to a JPEG data URL so uploads stay small. The photo never leaves memory except for the AI call. */
function toDataUrl(file: File, max = 1024): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      res(c.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

/** Without the AI: the garment photo (or its coloured silhouette) laid over the customer's photo. */
async function overlay(person: string, g: Garment, color: number): Promise<string> {
  const load = (u: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = u; });
  const p = await load(person);
  const W = 600, H = 800, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  const s = Math.max(W / p.width, H / p.height);
  x.drawImage(p, (W - p.width * s) / 2, (H - p.height * s) / 2, p.width * s, p.height * s);
  const gw = W * 0.56, gh = gw * 1.5, gx = (W - gw) / 2, gy = H * 0.18;
  x.save(); x.shadowColor = 'rgba(0,0,0,.3)'; x.shadowBlur = 18; x.globalAlpha = 0.94;
  if (g.front) {
    const gi = await load(g.front);
    const r = Math.min(gw / gi.width, gh / gi.height);
    x.drawImage(gi, gx + (gw - gi.width * r) / 2, gy, gi.width * r, gi.height * r);
  } else {
    const pts = CLIP[g.shape].replace(/^polygon\(|\)$/g, '').split(',').map(pt => pt.trim().split(/\s+/).map(v => parseFloat(v) / 100));
    x.beginPath();
    pts.forEach(([px, py], i) => (i ? x.lineTo(gx + px * gw, gy + py * gh) : x.moveTo(gx + px * gw, gy + py * gh)));
    x.closePath();
    x.fillStyle = (g.colors[color] ?? g.colors[0])?.hex ?? '#6F7258';
    x.fill();
  }
  x.restore();
  return c.toDataURL('image/jpeg', 0.9);
}

export function FittingRoom() {
  const b = useBoutique();
  const { t, tx } = b;
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const [state, setState] = useState<State>('empty');
  const [photo, setPhoto] = useState('');
  const [result, setResult] = useState('');
  const [byAi, setByAi] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cmp, setCmp] = useState(50);
  const [mode, setMode] = useState<'slider' | 'side'>('slider');
  const [picker, setPicker] = useState(false);
  const [gid, setGid] = useState(b.garments[0]?.id ?? '');
  const [color, setColor] = useState(0);
  const [size, setSize] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const g = b.byId(q.get('g'));
    if (g && g.kind === 'garment') {
      setGid(g.id);
      const c = Number(q.get('c'));
      if (Number.isInteger(c) && c >= 0 && c < g.colors.length) setColor(c);
      const s = q.get('s');
      if (s && g.sizes.some(x => x.n === s && x.ok)) setSize(s);
    }
    return () => clearInterval(timer.current);
  }, [b]);

  const g = b.byId(gid);
  if (!g) return <main className="studio"><p className="lead">{t.emptyRack}</p></main>;

  const pick = (id: string) => { setGid(id); setColor(0); setSize(null); setPicker(false); if (state === 'result') setState('ready'); };

  async function choose(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { b.toast(t.badFile); return; }
    try { setPhoto(await toDataUrl(file)); setResult(''); setState('ready'); } catch { b.toast(t.badFile); }
  }

  async function generate() {
    if (state === 'empty' || state === 'error' || !photo) { b.toast(t.needPhoto); return; }
    setState('loading'); setProgress(0);
    clearInterval(timer.current);
    // Eases towards 90% while the preview is made; jumps to 100 when it arrives.
    timer.current = setInterval(() => setProgress(p => Math.min(90, p + (90 - p) * 0.06 + 0.4)), 120);
    try {
      let img: string;
      if (b.ai.image) {
        const r = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'tryon', person: photo, garmentId: g!.id, color, lang: b.lang }) });
        if (r.status === 429) { clearInterval(timer.current); setState('ready'); b.toast(t.rateLimited); return; }
        if (!r.ok) throw new Error(String(r.status));
        img = (await r.json()).image;
        setByAi(true);
      } else {
        img = await overlay(photo, g!, color);
        await new Promise(res => setTimeout(res, 1200));
        setByAi(false);
      }
      clearInterval(timer.current);
      setProgress(100); setResult(img); setCmp(50); setState('result');
    } catch {
      clearInterval(timer.current);
      setState('error');
    }
  }

  function addToBag() {
    if (!size) { b.toast(t.pickSizeFirst); return; }
    b.addToBag(g!.id, color, size);
    b.toast(`${t.added} — ${tx(g!.name)}, ${size}`);
  }

  const stage = Math.min(2, Math.floor(progress / 34));
  const tag = byAi ? t.aiTag : t.simpleTag;
  const noPhoto = state === 'empty' || state === 'error';

  return (
    <main className="studio">
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { choose(e.target.files?.[0]); e.target.value = ''; }} />
      <div className="stage-col">
        <div className="portrait" dir="ltr">
          {state === 'empty' && (
            <div className="invite" dir={b.dir}>
              <i className="ph-duotone ph-person-simple" style={{ fontSize: 44, color: 'var(--olive-7)' }} />
              <h2>{t.upT}</h2>
              <ul className="ticks">{t.tips.map(x => <li key={x}><i className="ph-duotone ph-check" /><span>{x}</span></li>)}</ul>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
                <button type="button" className="btn" onClick={() => fileRef.current?.click()}><i className="ph-duotone ph-upload-simple" style={{ fontSize: 18 }} />{t.upload}</button>
                <Link href="/#rack" className="tlink u">{t.browse}</Link>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(41,35,31,.7)', display: 'flex', gap: 8, alignItems: 'baseline', maxWidth: '40ch' }}>
                <i className="ph-duotone ph-lock-simple" style={{ flex: 'none' }} />{t.privacy}
              </p>
            </div>
          )}
          {(state === 'ready' || state === 'loading') && (
            <>
              <img className="cover" src={photo} alt={t.before} />
              <span className="tag tl">{t.before}</span>
            </>
          )}
          {state === 'loading' && (
            <>
              <div className="scan-veil" />
              <div className="scan" style={{ top: `${progress}%` }} />
              <div className="loading" dir={b.dir} role="status">
                <span style={{ fontSize: 22, lineHeight: 1.2 }}>{t.stages[stage]}…</span>
                <div className="bar"><span style={{ width: `${progress}%` }} /></div>
                <div className="stg">
                  {t.stages.map((l, i) => (
                    <span key={l} className={i <= stage ? 'on' : ''}>
                      <i className={i < stage ? 'ph-duotone ph-check' : i === stage ? 'ph-duotone ph-circle-notch' : 'ph-duotone ph-circle'} />{l}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
          {state === 'result' && mode === 'slider' && (
            <>
              <img className="cover" src={photo} alt={t.before} />
              <img className="cover" src={result} alt={t.after} style={{ clipPath: `inset(0 0 0 ${cmp}%)` }} />
              <div className="handle" style={{ left: `${cmp}%` }}><div><i className="ph-duotone ph-arrows-horizontal" style={{ fontSize: 20 }} /></div></div>
              <input className="range" type="range" min={0} max={100} value={cmp} onChange={e => setCmp(Number(e.target.value))} aria-label={t.slider} />
              <span className="tag tl">{t.before}</span>
              <span className="tag dark tr">{t.after} · {tag}</span>
            </>
          )}
          {state === 'result' && mode === 'side' && (
            <>
              <div className="side-by-side">
                <div><img className="cover" src={photo} alt={t.before} /></div>
                <div><img className="cover" src={result} alt={t.after} /></div>
              </div>
              <span className="tag tl">{t.before}</span>
              <span className="tag dark tr">{t.after} · {tag}</span>
            </>
          )}
          {state === 'error' && (
            <div className="oops" dir={b.dir} role="alert">
              <i className="ph-duotone ph-warning" style={{ fontSize: 40, color: 'var(--rust)' }} />
              <h2>{t.errT}</h2>
              <p style={{ margin: 0, fontSize: 16, color: 'rgba(41,35,31,.82)', maxWidth: '36ch' }}>{t.errB}</p>
              <ul className="ticks">{t.errList.map(x => <li key={x}><i className="ph-duotone ph-x-circle" />{x}</li>)}</ul>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
                <button type="button" className="btn" onClick={() => fileRef.current?.click()}><i className="ph-duotone ph-upload-simple" style={{ fontSize: 18 }} />{t.retry}</button>
                <button type="button" className="tlink u" onClick={() => { setPhoto(''); setState('empty'); }}>{t.seeTips}</button>
              </div>
            </div>
          )}
        </div>
        {state === 'result' && byAi && (
          <div className="kept">
            <span className="label">{t.preserved}</span>
            {t.presList.map(x => <span key={x}><i className="ph-duotone ph-check" />{x}</span>)}
          </div>
        )}
      </div>

      <aside>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span className="kicker">{t.toK}</span>
          <h1>{t.toT}</h1>
          <p className="note" style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}><i className="ph-duotone ph-info" style={{ flex: 'none' }} />{b.ai.image ? t.privacy : t.aiOff}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="label-row">
            <span className="label">{t.garment}</span>
            <button type="button" className="tlink u" style={{ padding: '4px 0' }} aria-expanded={picker} onClick={() => setPicker(p => !p)}>{t.changeG}</button>
          </div>
          <div className="gsel">
            <div className="pic"><span style={{ position: 'absolute', inset: 6 }}><Art g={g} color={color} /></span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 22, lineHeight: 1.2 }}>{tx(g.name)}</span>
              <span style={{ fontSize: 15, color: 'rgba(41,35,31,.74)' }}>{tx(g.type)}</span>
              <span style={{ fontSize: 15, marginTop: 4 }}>{b.price(effectivePrice(g))}</span>
            </div>
          </div>
          {picker && (
            <div className="picker">
              {b.garments.map(x => (
                <button key={x.id} type="button" aria-pressed={x.id === gid} onClick={() => pick(x.id)}>
                  <span className="pic"><span style={{ position: 'absolute', inset: 6 }}><Art g={x} /></span></span>
                  <span style={{ fontSize: 13 }}>{tx(x.name)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {g.colors.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="label">{t.color} · <b>{tx(g.colors[color].name)}</b></span>
            <div className="swatches">
              {g.colors.map((c, i) => <button key={i} type="button" className="swatch" style={{ background: c.hex }} aria-label={tx(c.name)} aria-pressed={color === i}
                onClick={() => { setColor(i); if (state === 'result') setState('ready'); }} />)}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="label-row">
            <span className="label">{t.size}</span>
            <button type="button" className="tlink" style={{ padding: '4px 0' }} onClick={() => b.openSize({ garmentId: g.id, onUse: setSize })}><i className="ph-duotone ph-ruler" />{t.findSize}</button>
          </div>
          <div className="sizes">
            {g.sizes.map(s => <button key={s.n} type="button" className="size" style={{ minWidth: 48, height: 44 }} disabled={!s.ok} aria-pressed={size === s.n} onClick={() => setSize(s.n)}>{s.n}</button>)}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {state === 'result' ? (
            <button type="button" className="btn block" onClick={addToBag}><i className="ph-duotone ph-handbag" style={{ fontSize: 18 }} />{size ? `${t.addBag} · ${size}` : t.addBag}</button>
          ) : state === 'loading' ? (
            <button type="button" className="btn block" aria-disabled="true" style={{ cursor: 'progress', opacity: .6 }}><i className="ph-duotone ph-circle-notch" style={{ fontSize: 18 }} />{t.generating}…</button>
          ) : (
            <button type="button" className="btn block" aria-disabled={noPhoto} onClick={generate}><i className="ph-duotone ph-coat-hanger" style={{ fontSize: 18 }} />{t.generate}</button>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {state === 'result' ? (
              <>
                <button type="button" className="btn ghost sm" onClick={() => setMode(m => (m === 'slider' ? 'side' : 'slider'))} title={t.compare}>
                  <i className="ph-duotone ph-columns" />{mode === 'slider' ? t.side : t.slider}
                </button>
                <button type="button" className="btn ghost sm" onClick={() => setPicker(true)}><i className="ph-duotone ph-coat-hanger" />{t.another}</button>
              </>
            ) : (
              <>
                <button type="button" className="btn ghost sm" aria-disabled="true" style={{ opacity: .45 }} title={t.cmpHint} onClick={() => b.toast(t.cmpHint)}><i className="ph-duotone ph-columns" />{t.compare}</button>
                <button type="button" className="btn ghost sm" onClick={addToBag}><i className="ph-duotone ph-handbag" />{t.addBag}</button>
              </>
            )}
          </div>
          {(state === 'ready' || state === 'result') && (
            <button type="button" className="tlink" style={{ alignSelf: 'flex-start' }} onClick={() => fileRef.current?.click()}><i className="ph-duotone ph-camera" />{t.change}</button>
          )}
        </div>
      </aside>
    </main>
  );
}
