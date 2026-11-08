'use client';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SCAN_FRAMES, estimateBust, readFrame, type Hint } from '@/lib/body-scan';
import { latinDigits } from '@/lib/concierge';
import type { SizeInputs } from '@/lib/fit';
import { useBoutique } from '../../boutique/Boutique';
import { trapTab } from '../focus';
import { Icon } from '../Icon';
import { createPoseTracker, type PoseTracker } from '../pose';
import { useShop } from '../Shop';
import { SPRING, num } from '../tokens';
import { useConcierge, type SizeResult } from './useConcierge';

/* Size from the camera: she gives her height, stands back, and pose landmarks found in the browser give the proportions.
   The model and the frames stay on the device; only the result (a bust estimate) is kept, in this browser session. */

type Phase = 'intro' | 'camera' | 'result' | 'denied' | 'failed';

export function BodyScan() {
  const a = useConcierge();
  return <AnimatePresence>{a.scanning && <Dialog key="scan" />}</AnimatePresence>;
}

function Dialog() {
  const b = useBoutique();
  const { c } = useShop();
  const a = useConcierge();
  const [phase, setPhase] = useState<Phase>('intro');
  const [height, setHeight] = useState('');
  const [bad, setBad] = useState(false);
  const [hint, setHint] = useState<Hint | 'loading' | 'hold'>('loading');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SizeResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const cm = useRef(0);
  const { setScanning } = a;
  const close = useCallback(() => setScanning(false), [setScanning]);

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    (box.current?.querySelector('input') ?? box.current)?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') close();
      trapTab(e, box.current);
    };
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', key); back?.focus?.(); };
  }, [close]);

  const start = () => {
    const n = Number(latinDigits(height));
    if (!(n >= 130 && n <= 210)) { setBad(true); return; }
    setBad(false); cm.current = n; setProgress(0); setHint('loading'); setPhase('camera'); setAttempt(x => x + 1);
  };

  useEffect(() => {
    if (phase !== 'camera') return;
    let stream: MediaStream | null = null, lm: PoseTracker | null = null, raf = 0, stop = false, last = -1, timer = 0;
    const frames: { shoulder: number; hip: number }[] = [];
    const finish = () => {
      const bust = estimateBust(frames, cm.current);
      if (bust === null) { setPhase('failed'); return; }
      const inputs: SizeInputs = { height: cm.current, usual: 'M', fit: 'regular', bust, len: 'ankle' };
      const r = a.submitSize(inputs, true);
      setResult(r);
      setPhase(r ? 'result' : 'failed');
    };
    const loop = () => {
      if (stop) return;
      raf = requestAnimationFrame(loop);
      const v = video.current;
      if (!v || !lm || v.readyState < 2 || v.currentTime === last) return;
      last = v.currentTime;
      let found;
      // A tracker that dies mid-scan would otherwise throw on every frame with the hint frozen.
      try { found = lm.detectForVideo(v, performance.now()).landmarks?.[0]; } catch { stop = true; setPhase('failed'); return; }
      const r = readFrame(found, v.videoWidth / v.videoHeight);
      if (!r.ok) { setHint(r.hint); return; }
      frames.push({ shoulder: r.shoulder, hip: r.hip });
      setHint('hold');
      setProgress(frames.length / SCAN_FRAMES);
      if (frames.length >= SCAN_FRAMES) { stop = true; finish(); }
    };
    (async () => {
      try {
        // Development only: ?scan-test=<image> stands a still of a person in front of the camera, so the scan can be tried without one.
        const testImage = process.env.NODE_ENV !== 'production' ? new URLSearchParams(location.search).get('scan-test') : null;
        if (testImage) {
          const img = new Image(), cv = document.createElement('canvas');
          cv.width = 960; cv.height = 1280;
          await new Promise(r => { img.onload = r; img.src = testImage; });
          const paint = () => { const x = cv.getContext('2d')!; x.fillStyle = '#d9d4cc'; x.fillRect(0, 0, 960, 1280); const k = 1180 / img.naturalHeight; x.drawImage(img, 480 - img.naturalWidth * k / 2, 50, img.naturalWidth * k, 1180); };
          paint(); timer = window.setInterval(paint, 60);
          stream = cv.captureStream(15);
        } else {
          if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) { setPhase('failed'); return; }
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 1280 } }, audio: false });
        }
        if (stop) { stream.getTracks().forEach(t => t.stop()); return; }
        stream.getVideoTracks()[0]?.addEventListener('ended', () => { if (!stop) { stop = true; setPhase('failed'); } });
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        lm = await createPoseTracker();
        if (stop) { lm.close(); return; }
        setHint('noone');
        loop();
      } catch (e) {
        if (!stop) setPhase((e as Error).name === 'NotAllowedError' || (e as Error).name === 'SecurityError' ? 'denied' : 'failed');
      }
    })();
    return () => { stop = true; cancelAnimationFrame(raf); clearInterval(timer); stream?.getTracks().forEach(t => t.stop()); lm?.close(); };
    // Restarts only for a new attempt; `a` changes with every message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, attempt]);

  const hintText = { loading: c.aiScanLoading, noone: c.aiScanNoone, back: c.aiScanBack, closer: c.aiScanCloser, face: c.aiScanFace, hold: c.aiScanHold }[hint];
  const R = 46, around = 2 * Math.PI * R;

  return (
    <motion.div ref={box} tabIndex={-1} className="ai-scan" role="dialog" aria-modal="true" aria-label={c.aiScanTitle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <header className="ai-scan__head">
        <h2>{c.aiScanTitle}</h2>
        <button type="button" className="mz-reset mz-icon-btn" aria-label={c.close} onClick={close}><Icon name="close" /></button>
      </header>

      {phase === 'intro' && (
        <motion.form className="ai-scan__panel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.soft} onSubmit={e => { e.preventDefault(); start(); }}>
          <span className="ai-scan__ic" aria-hidden="true"><Icon name="pose" weight="duotone" size={40} /></span>
          <p>{c.aiScanIntro}</p>
          <label className="ai-field">
            <span>{c.aiScanHeight}</span>
            <input inputMode="numeric" autoComplete="off" maxLength={3} value={height} onChange={e => { setHeight(e.target.value); setBad(false); }} placeholder={num(165, b.lang)} aria-invalid={bad || undefined} aria-describedby={bad ? 'ai-scan-err' : undefined} />
          </label>
          {bad && <p className="ai-err" id="ai-scan-err" role="alert">{c.aiScanHeightBad}</p>}
          <button type="submit" className="mz-btn is-light mz-pill">{c.aiScanStart}<Icon name="next" size={20} className="mz-arrow" /></button>
          <p className="ai-scan__note"><Icon name="lock" size={18} />{c.aiScanPrivacy}</p>
        </motion.form>
      )}

      {phase === 'camera' && (
        <div className="ai-scan__stage">
          <video ref={video} playsInline muted aria-hidden="true" />
          <svg className="ai-scan__guide" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="1" />
            <circle cx="50" cy="50" r={R} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeDasharray={around} strokeDashoffset={around * (1 - progress)} transform="rotate(-90 50 50)" />
          </svg>
          <p className="ai-scan__hint" role="status">{hintText}</p>
        </div>
      )}

      {phase === 'result' && result && (
        <motion.div className="ai-scan__panel" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING.soft}>
          <p className="ai-scan__label">{c.aiScanDone}</p>
          <p className="ai-scan__size" dir="ltr">{result.rec.size}</p>
          <p>{c.aiScanBust.replace('{bust}', num(result.inputs.bust, b.lang))}</p>
          <p className="ai-scan__note"><Icon name="info" size={18} />{c.aiScanNote}</p>
          <button type="button" className="mz-btn is-light mz-pill" onClick={() => { close(); a.focusInput(); }}>{c.aiScanUse}<Icon name="next" size={20} className="mz-arrow" /></button>
          <button type="button" className="mz-reset mz-link ai-scan__again" onClick={start}>{c.aiScanAgain}</button>
        </motion.div>
      )}

      {(phase === 'denied' || phase === 'failed') && (
        <div className="ai-scan__panel" role="alert">
          <span className="ai-scan__ic" aria-hidden="true"><Icon name="noCamera" size={40} /></span>
          <p>{phase === 'denied' ? c.liveDenied : c.aiScanFailed}</p>
          <button type="button" className="mz-btn is-light mz-pill" onClick={() => { close(); a.findSize(); a.focusInput(); }}>{c.aiSizeAskCta}</button>
          {phase === 'denied' && <button type="button" className="mz-reset mz-link ai-scan__again" onClick={start}>{c.liveRetry}</button>}
        </div>
      )}
    </motion.div>
  );
}
