'use client';
import { useCallback, useState } from 'react';
import { SIZE_ORDER } from '@/lib/defaults';
import { chartOf, recommendSize, type FitPref, type SizeInputs } from '@/lib/fit';
import { Art } from './Art';
import { Sheet, useBoutique } from './Boutique';

/** Size assistant: opens over the product (or the fitting room) without losing it. Input -> recommendation.
 *  Pure logic in lib/fit.ts; never derived from a photo. */
export function SizeAssistant() {
  const b = useBoutique();
  const close = useCallback(() => b.openSize(null), [b]);
  const g = b.byId(b.sizeReq?.garmentId);
  return (
    <Sheet open={!!g} onClose={close} label={b.t.szT} width={500} z={70}>
      {g && b.sizeReq && <Body key={g.id} garmentId={g.id} onUse={b.sizeReq.onUse} onClose={close} />}
    </Sheet>
  );
}

// Kept for the session, so reopening the assistant on another piece keeps the customer's answers.
let remembered: SizeInputs & { meas: boolean; waist: string; hips: string } = { height: 165, usual: 'M', fit: 'regular', bust: 0, len: 'ankle', meas: false, waist: '', hips: '' };

function Body({ garmentId, onUse, onClose }: { garmentId: string; onUse: (s: string) => void; onClose: () => void }) {
  const b = useBoutique();
  const { t, tx } = b;
  const g = b.byId(garmentId)!;
  const [sz, setSzState] = useState(remembered);
  const [step, setStep] = useState<'input' | 'result'>('input');
  const set = (o: Partial<typeof sz>) => setSzState(s => (remembered = { ...s, ...o }));
  const rec = recommendSize(sz, g);
  const chart = chartOf(g);
  const fitLabel = { fitted: t.fitted, regular: t.regular, relaxed: t.relaxed }[sz.fit];

  const seg = <T extends string>(opts: [T, string][], cur: T, on: (v: T) => void) => (
    <div className="seg">{opts.map(([k, l]) => <button key={k} type="button" aria-pressed={cur === k} onClick={() => on(k)}>{l}</button>)}</div>
  );
  const fitSeg = seg<FitPref>([['fitted', t.fitted], ['regular', t.regular], ['relaxed', t.relaxed]], sz.fit, v => set({ fit: v }));

  return (
    <div className="sheet-pad">
      <div className="label-row" style={{ alignItems: 'center' }}>
        <span className="kicker">{t.szT}</span>
        <button type="button" className="ibtn" aria-label={t.close} onClick={onClose} style={{ marginInlineEnd: -10 }}><i className="ph-duotone ph-x" style={{ fontSize: 20 }} /></button>
      </div>
      <div className="for">
        <div className="pic"><span style={{ position: 'absolute', inset: 4 }}><Art g={g} /></span></div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="muted" style={{ fontSize: 13 }}>{t.szFor}</span>
          <span style={{ fontSize: 20, lineHeight: 1.2 }}>{tx(g.name)}</span>
          <span style={{ fontSize: 14, color: 'rgba(41,35,31,.74)' }}>{tx(g.type)}</span>
        </div>
      </div>

      {step === 'input' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <label className="field" style={{ width: 160 }}>{t.height}
            <input type="number" inputMode="numeric" min={130} max={210} value={sz.height || ''} onChange={e => set({ height: Number(e.target.value) || 0 })} style={{ fontSize: 18 }} />
          </label>
          <div className="field">{t.usual}{seg(SIZE_ORDER.map(s => [s, s] as [string, string]), sz.usual, v => set({ usual: v }))}</div>
          <div className="field">{t.fitPref}{fitSeg}</div>
          <div className="field"><span>{t.lenPref} · <em>{t.optional}</em></span>{seg([['ankle', t.ankle], ['floor', t.floor]], sz.len, v => set({ len: v }))}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <button type="button" className="tlink" style={{ color: 'var(--ink)', fontWeight: 400, fontSize: 15 }} aria-expanded={sz.meas} onClick={() => set({ meas: !sz.meas })}>
              <i className={sz.meas ? 'ph-duotone ph-minus' : 'ph-duotone ph-plus'} style={{ color: 'var(--olive-7)' }} />{t.optMeas} <em className="muted">{t.optional}</em>
            </button>
            {sz.meas && (
              <div className="meas">
                <label className="field">{t.bust} (cm)<input type="number" inputMode="numeric" placeholder="90" value={sz.bust || ''} onChange={e => set({ bust: Number(e.target.value) || 0 })} /></label>
                <label className="field">{t.waist} (cm)<input type="number" inputMode="numeric" placeholder="74" value={sz.waist} onChange={e => set({ waist: e.target.value })} /></label>
                <label className="field">{t.hips} (cm)<input type="number" inputMode="numeric" placeholder="98" value={sz.hips} onChange={e => set({ hips: e.target.value })} /></label>
              </div>
            )}
          </div>
          <button type="button" className="btn block" onClick={() => setStep('result')}>{t.recommend}</button>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(41,35,31,.7)', display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <i className="ph-duotone ph-camera-slash" style={{ flex: 'none' }} />{t.noPhoto}
          </p>
        </div>
      ) : !rec ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p className="lead">{t.noneAvailable}</p>
          <button type="button" className="tlink u" onClick={() => setStep('input')}>{t.edit}</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <span className="infotag"><i className="ph-duotone ph-info" />{t.guidance}</span>
          <div className="rec">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="kicker" style={{ fontSize: 13, letterSpacing: '.14em' }}>{t.suggest}</span>
              <span className="big">{rec.size}</span>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 15, color: 'rgba(41,35,31,.84)', flex: 1 }}>
              {t.explain(sz.usual, fitLabel, rec.size, tx(g.type) || tx(g.name), String(sz.bust), rec.ease, sz.height || 165, rec.height, sz.len)}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'rgba(41,35,31,.76)' }}>{t.range}</span>
            <div className="scale">
              {g.sizes.map(s => (
                <div key={s.n}>
                  <div className={`s${s.n === rec.size ? ' on' : ''}${s.ok ? '' : ' out'}`}>{s.n}</div>
                  <small>{s.n === rec.size ? t.recLabel : s.ok ? '' : t.soldOut}</small>
                </div>
              ))}
            </div>
          </div>
          <div className="field">{t.adjust}{fitSeg}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'rgba(41,35,31,.76)' }}>{t.guide}</span>
            <div className="guide">
              {[t.size, t.bust, t.waist, t.hips, t.lengthCol].map(h => <span key={h} className="h">{h}</span>)}
              {Object.entries(chart).flatMap(([n, row]) => [n, row.bust, row.waist, row.hips, row.length].map((v, i) => (
                <span key={`${n}-${i}`} className={n === rec.size ? 'on' : ''}>{v ?? '–'}</span>
              )))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button type="button" className="btn block" onClick={() => { onUse(rec.size); onClose(); }}>{t.useSize} {rec.size}</button>
            <button type="button" className="tlink u" style={{ alignSelf: 'flex-start' }} onClick={() => setStep('input')}>{t.edit}</button>
          </div>
        </div>
      )}
    </div>
  );
}
