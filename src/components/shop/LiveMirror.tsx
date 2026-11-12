'use client';
/* eslint-disable @next/next/no-img-element -- garment cut-outs and the captured picture as data URLs */
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { effectivePrice } from '@/lib/fit';
import { clothLength, easeAngle, inside, sleevePolygon, sleeveTurn, stretch } from '@/lib/mirror-fit';
import { LIVE_SECONDS } from '@/lib/live-tryon';
import type { Garment } from '@/lib/types';
import { useBoutique } from '../boutique/Boutique';
import { productHref } from './Chrome';
import { lockScroll, trapTab } from './focus';
import { useLiveAi } from './liveAi';
import { Icon } from './Icon';
import { createPoseTracker, type PoseLandmark, type PoseTracker } from './pose';
import { useShop } from './Shop';
import { SPRING, cardBg, num } from './tokens';

/* The live mirror: the front camera, with the chosen abaya laid on the shoulders as the customer moves. Body tracking
   runs in the browser (MediaPipe pose landmarker, loaded on demand from our own public/mediapipe); in this on-device
   mode no frame leaves the device unless the customer asks for a realistic render, which goes through the regular
   try-on. With a live try-on key she can instead, after consenting, be dressed live by AI (liveAi.ts), where the
   camera stream goes to the provider. Every mode is a mirror: she and the abaya both appear flipped. */

type Pt = PoseLandmark;
type Landmarker = PoseTracker;
type Status = 'starting' | 'live' | 'denied' | 'unsupported' | 'error';
/** One sleeve lifted off the garment: its own small canvas (`ox`, `oy` place it on the cut-out), the shoulder it turns
 *  on, and the direction it hangs in the photo. */
type Sleeve = { piece: HTMLCanvasElement; ox: number; oy: number; px: number; py: number; hang: { dx: number; dy: number } };
/** A garment cut-out, scaled to at most 1000 px tall: where its shoulders sit (the shoulder line's row, its centre and
 *  width), the body without its sleeves, and the two sleeves: `r` on the image's left (her right arm), `l` on its right. */
type Fit = { src: HTMLCanvasElement; w: number; h: number; row: number; cx: number; span: number; body?: HTMLCanvasElement; r?: Sleeve; l?: Sleeve };
/** Where she stands, the cloth's length, and each upper arm's angle in her body's own frame. */
type Pose = { x: number; y: number; angle: number; scale: number; r: number; l: number; len: number };

/** Lets a fit's canvases go; iOS Safari has a hard ceiling on canvas memory. */
function release(f: Fit | null) {
  if (!f) return;
  for (const c of [f.src, f.body, f.r?.piece, f.l?.piece]) if (c) { c.width = 0; c.height = 0; }
}

/** Reads the shoulder line off the cut-out's alpha: a little below the first opaque row (the collar). */
function measure(img: HTMLImageElement): Fit {
  const k = Math.min(1, 1000 / img.naturalHeight);
  const src = document.createElement('canvas');
  src.width = Math.round(img.naturalWidth * k); src.height = Math.round(img.naturalHeight * k);
  const ctx = src.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, src.width, src.height);
  const { data, width, height } = ctx.getImageData(0, 0, src.width, src.height);
  const solid = (x: number, y: number) => data[(y * width + x) * 4 + 3] > 120;
  let top = 0;
  for (; top < height; top++) { let hit = false; for (let x = 0; x < width; x += 2) if (solid(x, top)) { hit = true; break; } if (hit) break; }
  const row = Math.min(height - 1, top + Math.round(height * 0.055));
  let l = 0, r = width - 1;
  while (l < width && !solid(l, row)) l++;
  while (r > l && !solid(r, row)) r--;
  // A photo without transparency fills its frame; assume a centred garment with shoulders across 60% of it.
  if (top === 0 && l === 0 && r === width - 1) return { src, w: width, h: height, row: Math.round(height * 0.08), cx: width / 2, span: width * 0.6 };
  const fit: Fit = { src, w: width, h: height, row, cx: (l + r) / 2, span: Math.max(1, r - l) };
  return { ...fit, ...cutSleeves(fit, data) };
}

/** Lifts each sleeve off the body so it can turn with the arm (see sleevePolygon for where the cut runs). The sleeve
 *  gets a soft edge; the body loses only the part well inside that edge, so it stays whole wherever the sleeve fades. */
function cutSleeves(f: Fit, data: Uint8ClampedArray): Pick<Fit, 'body' | 'r' | 'l'> {
  const soft = Math.max(4, f.span * 0.04);
  const side = (dir: -1 | 1): Sleeve | undefined => {
    const poly = sleevePolygon(dir, f, f.w, f.h);
    const xs = poly.map(q => q.x), ys = poly.map(q => q.y);
    const ox = Math.max(0, Math.floor(Math.min(...xs) - soft)), oy = Math.max(0, Math.floor(Math.min(...ys) - soft));
    const cw = Math.min(f.w, Math.ceil(Math.max(...xs) + soft)) - ox, ch = Math.min(f.h, Math.ceil(Math.max(...ys) + soft)) - oy;
    if (cw < 8 || ch < 8) return undefined;
    const px = f.cx + dir * f.span * 0.36, py = f.row + f.span * 0.1;
    // Its weight centre tells which way it hangs in the photo.
    let sx = 0, sy = 0, n = 0;
    for (let y = oy; y < oy + ch; y += 3) for (let x = ox; x < ox + cw; x += 3) {
      if (data[(y * f.w + x) * 4 + 3] > 120 && inside({ x, y }, poly)) { sx += x; sy += y; n++; }
    }
    if (n < 30) return undefined;
    const piece = document.createElement('canvas');
    piece.width = cw; piece.height = ch;
    const g = piece.getContext('2d')!;
    g.translate(-ox, -oy);
    g.filter = `blur(${soft / 2}px)`;
    g.beginPath(); poly.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.closePath();
    g.fill();
    g.filter = 'none';
    g.globalCompositeOperation = 'source-in';
    g.drawImage(f.src, 0, 0);
    return { piece, ox, oy, px, py, hang: { dx: sx / n - px, dy: sy / n - py } };
  };
  const r = side(-1), l = side(1);
  if (!r && !l) return {};
  const body = document.createElement('canvas');
  body.width = f.w; body.height = f.h;
  const b = body.getContext('2d')!;
  b.drawImage(f.src, 0, 0);
  b.globalCompositeOperation = 'destination-out';
  for (const [sl, dir] of [[r, -1], [l, 1]] as const) {
    if (!sl) continue;
    // The same cut, pulled in by a soft edge on every side.
    const [a, armpit, end, out] = sleevePolygon(dir, f, f.w, f.h);
    b.beginPath();
    b.moveTo(a.x + dir * soft * 1.5, a.y); b.lineTo(armpit.x + dir * soft * 1.5, armpit.y + soft);
    b.lineTo(end.x, end.y - soft * 3); b.lineTo(out.x, out.y);
    b.closePath(); b.fill();
  }
  return { body, r, l };
}

export function LiveMirror({ garments, initial, onClose, onRealistic, onPhoto }: {
  garments: Garment[]; initial?: string | null; onClose: () => void; onRealistic?: (frame: string, garmentId: string) => void; onPhoto?: () => void;
}) {
  const b = useBoutique();
  const { c } = useShop();
  const [status, setStatus] = useState<Status>('starting');
  const [tracking, setTracking] = useState<'loading' | 'ready' | 'off'>('loading');
  const [seen, setSeen] = useState(false);
  const [gid, setGid] = useState(initial && garments.some(g => g.id === initial && g.front) ? initial : garments.find(g => g.front)?.id ?? null);
  const [shot, setShot] = useState<{ composite: string; frame: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  // With a live try-on key (Decart or fal.ai) the mirror asks first, then dresses her live with AI; otherwise it lays the cut-out on her.
  const [mode, setMode] = useState<'consent' | 'ai' | 'local'>(b.ai.live ? 'consent' : 'local');
  const [stream, setStream] = useState<MediaStream | null>(null);
  /** The camera's width over height, once it is known. */
  const [cam, setCam] = useState<number | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const fit = useRef<Fit | null>(null);
  const pose = useRef<Pose | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const seenRef = useRef(false);
  const close = useRef(onClose);
  close.current = onClose;
  const g = garments.find(x => x.id === gid);

  // Camera. It is off while the customer looks at her picture, so the light goes out too.
  const looking = !!shot;
  useEffect(() => {
    if (looking || mode === 'consent') return;
    // Development only: ?mirror-test feeds a still of the house model through the mirror instead of a camera, so the
    // fitting can be checked without one. Stripped from production builds.
    if (process.env.NODE_ENV !== 'production' && new URLSearchParams(location.search).has('mirror-test')) {
      const img = new Image(), cv = document.createElement('canvas');
      cv.width = 960; cv.height = 720;
      let t = 0;
      const paint = () => { const x = cv.getContext('2d')!; x.fillStyle = '#d9d4cc'; x.fillRect(0, 0, 960, 720); const k = 700 / img.naturalHeight; x.drawImage(img, 480 - img.naturalWidth * k / 2, 10, img.naturalWidth * k, 700); };
      let fake: MediaStream | null = null;
      img.onload = () => { paint(); t = window.setInterval(paint, 100); fake = cv.captureStream(15); video.current!.srcObject = fake; video.current!.play().catch(() => {}); setStream(fake); setStatus('live'); };
      img.src = new URLSearchParams(location.search).get('mirror-test') || '/images/models/olive.webp';
      return () => { window.clearInterval(t); fake?.getTracks().forEach(tr => tr.stop()); setStream(null); };
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) { setStatus('unsupported'); return; }
    let stream: MediaStream | null = null, gone = false;
    setStatus('starting');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
      .then(async s => {
        if (gone) { s.getTracks().forEach(t => t.stop()); return; }
        stream = s;
        s.getVideoTracks()[0]?.addEventListener('ended', () => { if (!gone) setStatus('error'); });
        const v = video.current!;
        v.srcObject = s;
        setStream(s);
        try { await v.play(); } catch { if (!gone) setStatus('error'); return; }
        if (!gone) setStatus('live');
      })
      .catch((e: Error) => { if (!gone) setStatus(e.name === 'NotAllowedError' || e.name === 'SecurityError' ? 'denied' : 'error'); });
    return () => { gone = true; stream?.getTracks().forEach(t => t.stop()); setStream(null); };
  }, [attempt, looking, mode]);

  // The garment's shoulder line, measured once per garment.
  useEffect(() => {
    release(fit.current);
    fit.current = null;
    if (!g?.front) return;
    let off = false;
    const img = new Image();
    // Uploaded photos live on the storage host; without CORS the canvas could neither read nor export them.
    img.crossOrigin = 'anonymous';
    img.onload = () => { if (off) return; try { fit.current = measure(img); } catch { fit.current = null; } };
    img.src = g.front;
    return () => { off = true; };
  }, [g?.front]);

  // Body tracking and drawing. Without tracking the mirror still shows the camera, with a note.
  useEffect(() => {
    if (status !== 'live' || shot || mode !== 'local') return;
    // A fresh tracker each time the mirror comes back, so the hint starts honest.
    setTracking('loading'); setSeen(false); seenRef.current = false; pose.current = null;
    let lm: Landmarker | null = null, raf = 0, stop = false, last = -1, misses = 0, ready = false;
    (async () => {
      try {
        lm = await createPoseTracker();
        if (stop) { lm?.close(); return; }
        ready = true;
        setTracking('ready');
      } catch { if (!stop) setTracking('off'); }
    })();
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const v = video.current, cv = canvas.current;
      if (!v || !cv || v.readyState < 2 || !v.videoWidth || !v.videoHeight || !cv.clientWidth || !cv.clientHeight) return;
      const W = cv.clientWidth, H = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const ctx = cv.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Cover-fit the frame, mirrored like a looking glass.
      const vw = v.videoWidth, vh = v.videoHeight, k = Math.max(W / vw, H / vh), dw = vw * k, dh = vh * k, ox = (W - dw) / 2, oy = (H - dh) / 2;
      ctx.save();
      ctx.translate(W, 0); ctx.scale(-1, 1);
      ctx.drawImage(v, ox, oy, dw, dh);
      if (lm && v.currentTime !== last) {
        last = v.currentTime;
        const p = lm.detectForVideo(v, performance.now()).landmarks?.[0];
        const ls = p?.[11], rs = p?.[12];
        if (ls && rs && (ls.visibility ?? 1) > 0.5 && (rs.visibility ?? 1) > 0.5) {
          misses = 0;
          const at = (q: Pt) => ({ x: ox + q.x * dw, y: oy + q.y * dh });
          const a = at(rs), bp = at(ls);
          const angle = Math.atan2(bp.y - a.y, bp.x - a.x);
          const prev = pose.current;
          // Each upper arm's angle in the body's own frame (shoulder to elbow, or to the wrist when the elbow is
          // hidden); with neither in view the arm keeps its last angle rather than snapping back.
          const arm = (sh: Pt, el: Pt | undefined, wr: Pt | undefined, last: number | undefined) => {
            const end = el && (el.visibility ?? 1) > 0.5 ? el : wr && (wr.visibility ?? 1) > 0.5 ? wr : null;
            if (!end) return last ?? Math.PI / 2;
            const s0 = at(sh), e0 = at(end);
            return Math.atan2(e0.y - s0.y, e0.x - s0.x) - angle;
          };
          const mid = { x: (a.x + bp.x) / 2, y: (a.y + bp.y) / 2 }, scale = Math.hypot(bp.x - a.x, bp.y - a.y);
          const seen2 = (i: number, j: number) => { const u = p?.[i], w = p?.[j]; return u && w && (u.visibility ?? 1) > 0.5 && (w.visibility ?? 1) > 0.5 ? { x: (at(u).x + at(w).x) / 2, y: (at(u).y + at(w).y) / 2 } : null; };
          const next: Pose = { x: mid.x, y: mid.y, angle, scale, len: clothLength(mid, scale, seen2(27, 28), seen2(23, 24)),
            r: arm(rs, p?.[14], p?.[16], prev?.r), l: arm(ls, p?.[13], p?.[15], prev?.l) };
          const t = 0.35, mix = (k: 'x' | 'y' | 'scale' | 'len') => prev![k] + (next[k] - prev![k]) * t;
          pose.current = prev ? { x: mix('x'), y: mix('y'), scale: mix('scale'), len: mix('len'), angle: easeAngle(prev.angle, next.angle, t), r: easeAngle(prev.r, next.r, t), l: easeAngle(prev.l, next.l, t) } : next;
          if (!seenRef.current) { seenRef.current = true; setSeen(true); }
        } else if (++misses > 20 && seenRef.current) { pose.current = null; seenRef.current = false; setSeen(false); }
      }
      // Without tracking the abaya stands still in the middle and the customer lines herself up with it.
      const tracked = !!pose.current;
      const f = fit.current, q = pose.current ?? (ready ? null : { x: W / 2, y: H * 0.3, angle: 0, scale: Math.min(W, H) * 0.3, r: 0, l: 0, len: H * 0.66 });
      if (f && q) {
        // Width from the shoulders (the joints sit inside the cloth's shoulder seams, so a little wider), length from
        // where the body ends, kept within a believable stretch of the photo's own proportions.
        const s = (q.scale * 1.32) / f.span, sy = stretch(s, q.len, f.h - f.row);
        ctx.translate(q.x, q.y); ctx.rotate(q.angle);
        ctx.drawImage(f.body ?? f.src, -f.cx * s, -f.row * sy, f.w * s, f.h * sy);
        // Sleeves go on top, each turned on its shoulder to follow the arm. A sleeve stretches less than the skirt.
        const ss = Math.min(sy, s * 1.2);
        for (const [sl, armBody] of [[f.r, q.r], [f.l, q.l]] as const) {
          if (!sl || !tracked) continue;
          ctx.save();
          ctx.translate((sl.px - f.cx) * s, (sl.py - f.row) * sy);
          ctx.rotate(sleeveTurn(armBody, sl.hang, s, ss));
          ctx.drawImage(sl.piece, (sl.ox - sl.px) * s, (sl.oy - sl.py) * ss, sl.piece.width * s, sl.piece.height * ss);
          ctx.restore();
        }
        // Without tracking (or before it starts) the sleeves stay as photographed, on the body canvas's faint ghost.
        if (!tracked) for (const sl of [f.r, f.l]) if (sl) ctx.drawImage(sl.piece, (sl.ox - f.cx) * s, (sl.oy - f.row) * sy, sl.piece.width * s, sl.piece.height * sy);
      }
      ctx.restore();
    };
    raf = requestAnimationFrame(draw);
    return () => { stop = true; cancelAnimationFrame(raf); lm?.close(); };
  }, [status, shot, mode]);

  // Escape closes and Tab stays inside; focus moves into the mirror and the page behind stops scrolling.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') close.current();
      else trapTab(e, dialog.current);
    };
    document.addEventListener('keydown', key);
    const unlock = lockScroll();
    return () => { document.removeEventListener('keydown', key); unlock(); prev?.focus?.(); };
  }, []);

  const ai = useLiveAi({ on: mode === 'ai' && status === 'live' && !shot, stream, garment: g });
  const aiShows = mode === 'ai' && ai.state === 'live';
  const busy = ai.state === 'connecting' || ai.state === 'reconnecting';
  // One polite voice for the AI session, so a screen reader hears it start, near its end, and stop.
  const said = mode !== 'ai' || shot ? '' : busy ? c.liveAiConnecting : ai.state === 'live' ? (ai.left <= 10 ? c.liveAiLeft.replace('{n}', num(10, b.lang)) : c.liveAiLive)
    : ai.state === 'ended' ? c.liveAiEnded : ai.state === 'failed' ? c.liveAiFailed : ai.state === 'rate' ? c.liveAiRate : ai.state === 'off' ? c.liveAiOff : '';
  // Who the camera goes to, for the consent text and the note: as configured on the server.
  const who = b.ai.live === 'both' ? c.liveAiWhoBoth : b.ai.live === 'fal' ? c.liveAiWhoFal : c.liveAiWhoDecart;
  const viaDecart = b.ai.live !== 'fal', viaFal = b.ai.live === 'fal' || b.ai.live === 'both';
  const wearing = g ? `${c.liveWearing} ${b.tx(g.name)}` : c.liveTitle;
  // A button that started or switched something disappears; focus stays inside the mirror rather than falling out.
  useEffect(() => { if (!dialog.current?.contains(document.activeElement)) dialog.current?.focus(); }, [mode, ai.state, shot]);

  /** The picture as she saw it (mirrored, with the abaya), and for the on-device mirror also the bare frame for the AI,
   *  mirrored the same way and kept to 1024 px like an uploaded photo. */
  function capture() {
    if (mode === 'ai') {
      // The AI stream already shows her dressed; the picture is what she saw: the part the stage shows (object-fit:
      // cover), mirrored like the stage (the stream comes back as the camera sees her).
      const rv = ai.video.current;
      if (!aiShows || !rv?.videoWidth || !rv.clientWidth || !rv.clientHeight) return;
      const vw = rv.videoWidth, vh = rv.videoHeight, s = Math.max(rv.clientWidth / vw, rv.clientHeight / vh);
      const sw = rv.clientWidth / s, sh = rv.clientHeight / s;
      const k = Math.min(1, 1280 / Math.max(sw, sh));
      const c2 = document.createElement('canvas');
      c2.width = Math.round(sw * k); c2.height = Math.round(sh * k);
      const x2 = c2.getContext('2d')!;
      x2.translate(c2.width, 0); x2.scale(-1, 1);
      x2.drawImage(rv, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, c2.width, c2.height);
      const pic = c2.toDataURL('image/jpeg', 0.9);
      // Looking at the picture ends the session; another one starts only when she asks.
      ai.hold();
      setShot({ composite: pic, frame: pic });
      return;
    }
    const cv = canvas.current, v = video.current;
    if (!cv || !v || !v.videoWidth || !v.videoHeight) return;
    const k = Math.min(1, 1024 / Math.max(v.videoWidth, v.videoHeight));
    const raw = document.createElement('canvas');
    raw.width = Math.round(v.videoWidth * k); raw.height = Math.round(v.videoHeight * k);
    const rc = raw.getContext('2d')!;
    rc.translate(raw.width, 0); rc.scale(-1, 1);
    rc.drawImage(v, 0, 0, raw.width, raw.height);
    try { setShot({ composite: cv.toDataURL('image/jpeg', 0.9), frame: raw.toDataURL('image/jpeg', 0.88) }); } catch { setStatus('error'); }
  }

  const note = status === 'denied' ? c.liveDenied : status === 'unsupported' ? c.liveUnsupported : status === 'error' ? c.liveError : null;

  return (
    <motion.div ref={dialog} className="mz-live" role="dialog" aria-modal="true" aria-label={c.liveTitle} tabIndex={-1} dir={b.dir}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <div className="mz-live__top">
        <p className="mz-live__title"><Icon name="camera" size={20} />{c.liveTitle}</p>
        {b.ai.live && mode === 'local' && <button type="button" className="mz-reset mz-btn is-ghost-ink mz-pill mz-live__mode" onClick={() => { ai.restart(); setMode('ai'); }}>{c.liveAiShort}</button>}
        <button type="button" className="mz-reset mz-icon-btn mz-round mz-live__close" aria-label={c.liveClose} onClick={onClose}><Icon name="close" size={20} /></button>
      </div>

      <p className="mz-sr" role="status" aria-live="polite">{said}</p>
      {/* On a wide screen the stage takes the camera's own shape, so her head and feet are not cut off (shop.css). */}
      <div className="mz-live__stage" dir="ltr" style={cam ? ({ '--cam': String(cam) } as CSSProperties) : undefined}>
        <video ref={video} className={`mz-live__video${mode === 'ai' ? ' is-preview' : ''}`} playsInline muted aria-hidden="true"
          onLoadedMetadata={e => { const v = e.currentTarget; if (v.videoWidth && v.videoHeight) setCam(v.videoWidth / v.videoHeight); }} />
        {mode === 'local' && <canvas ref={canvas} className="mz-live__canvas" role="img" aria-label={wearing} />}
        {mode === 'ai' && <video ref={ai.video} className={`mz-live__canvas mz-live__ai${aiShows ? ' is-on' : ''}`} playsInline muted autoPlay role="img" aria-label={wearing} aria-hidden={!aiShows || !!shot} />}
        {mode === 'consent' && (
          <div className="mz-live__consent" dir={b.dir} role="group" aria-labelledby="mz-live-consent-h" aria-describedby="mz-live-consent-body">
            <Icon name="lock" size={22} />
            <h2 id="mz-live-consent-h">{c.liveAiTitle}</h2>
            <p id="mz-live-consent-body">
              {c.liveAiBody.replace('{who}', who).replace('{n}', num(LIVE_SECONDS, b.lang))}
              {viaDecart && <> {c.liveAiKeepDecart}</>}
              {viaFal && <> {c.liveAiKeepFal}</>}
            </p>
            <div className="mz-live__consent-links">
              {viaDecart && <a href="https://docs.platform.decart.ai/resources/privacy-policy" target="_blank" rel="noreferrer" className="mz-link">{c.liveAiPolicy}<Icon name="external" size={16} /></a>}
              {viaFal && <a href="https://fal.ai/legal/privacy-policy" target="_blank" rel="noreferrer" className="mz-link">{c.liveAiPolicyFal}<Icon name="external" size={16} /></a>}
            </div>
            <div className="mz-live__consent-acts">
              <button type="button" className="mz-reset mz-btn is-light mz-pill" onClick={() => setMode('ai')}><Icon name="camera" size={18} />{c.liveAiStart}</button>
              <button type="button" className="mz-reset mz-btn is-ghost-ink mz-pill" onClick={() => setMode('local')}>{c.liveAiLocal}</button>
            </div>
          </div>
        )}
        {mode === 'ai' && status === 'live' && !shot && ai.state !== 'live' && ai.state !== 'idle' && (
          <div className={`mz-live__status${busy ? '' : ' is-alert'}`} dir={b.dir}>
            {busy
              ? <><span className="mz-live__dot" aria-hidden="true" />{ai.state === 'reconnecting' ? c.liveAiReconnecting : c.liveAiConnecting}</>
              : <>
                  <p>{ai.state === 'ended' ? c.liveAiEnded : ai.state === 'rate' ? c.liveAiRate : ai.state === 'off' ? c.liveAiOff : c.liveAiFailed}</p>
                  {ai.state !== 'rate' && ai.state !== 'off' && <button type="button" className="mz-reset mz-btn is-light mz-pill" onClick={ai.restart}><Icon name="again" size={18} />{c.liveAiAgain}</button>}
                  <button type="button" className="mz-reset mz-btn is-ghost-ink mz-pill" onClick={() => setMode('local')}>{c.liveAiLocal}</button>
                </>}
          </div>
        )}
        {aiShows && !shot && <p className="mz-live__timer" dir={b.dir} aria-hidden="true">{c.liveAiLeft.replace('{n}', num(ai.left, b.lang))}</p>}
        <AnimatePresence>{shot && <motion.span key="flash" className="mz-live__flash" aria-hidden="true" initial={{ opacity: 0.7 }} animate={{ opacity: 0 }} transition={{ duration: 0.45 }} />}</AnimatePresence>
        {shot && <img className="mz-live__shot" src={shot.composite} alt={g ? wearing : ''} />}
        {status === 'starting' && mode !== 'consent' && <p className="mz-live__status" dir={b.dir}><span className="mz-live__dot" aria-hidden="true" />{c.liveStarting}</p>}
        {note && (
          <div className="mz-live__status is-alert" dir={b.dir} role="alert">
            <Icon name="alert" size={18} /><p>{note}</p>
            {status !== 'unsupported' && <button type="button" className="mz-reset mz-btn is-light mz-pill" onClick={() => setAttempt(a => a + 1)}><Icon name="again" size={18} />{c.liveRetry}</button>}
            {onPhoto && <button type="button" className="mz-reset mz-btn is-ghost-ink mz-pill" onClick={onPhoto}><Icon name="upload" size={18} />{c.choose}</button>}
          </div>
        )}
        {mode === 'local' && status === 'live' && !shot && (
          <p className="mz-live__hint" dir={b.dir}>
            {tracking === 'loading' && <span className="mz-live__dot" aria-hidden="true" />}
            {tracking === 'loading' ? c.liveLoading : tracking === 'off' ? c.liveNoTracking : seen ? c.liveTracking : c.liveHint}
          </p>
        )}
      </div>

      <div className="mz-live__bottom">
        <AnimatePresence mode="wait" initial={false}>
          {mode === 'consent' ? null : !shot ? (
            <motion.div key="pick" className="mz-live__pick" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={SPRING.soft}>
              <div className="mz-live__strip" role="group" aria-label={c.livePick}>
                {garments.filter(x => x.front).map(x => (
                  <button key={x.id} type="button" className="mz-reset mz-live__item" aria-pressed={x.id === gid} aria-label={b.tx(x.name)} style={{ background: cardBg(x.colors[0]?.hex) }} onClick={() => setGid(x.id)}>
                    <img src={x.front} alt="" loading="lazy" decoding="async" crossOrigin="anonymous" />
                  </button>
                ))}
              </div>
              <div className="mz-live__acts">
                {g && <div className="mz-live__info"><p className="mz-live__name" title={b.tx(g.name)}>{b.tx(g.name)}</p><p className="mz-live__price">{b.price(effectivePrice(g))}</p></div>}
                <button type="button" className="mz-reset mz-live__shutter" aria-label={c.liveCapture} disabled={status !== 'live' || (mode === 'ai' && !aiShows)} onClick={capture}><span /></button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="shot" className="mz-live__done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={SPRING.soft}>
              <button type="button" className="mz-reset mz-btn is-ghost-ink mz-pill" onClick={() => { setStatus('starting'); setShot(null); if (mode === 'ai') ai.restart(); }}><Icon name="again" size={18} />{c.liveRetake}</button>
              <a className="mz-btn is-ghost-ink mz-pill" href={shot.composite} download={`mazun-${gid ?? 'mirror'}.jpg`}><Icon name="save" size={18} />{c.liveSave}</a>
              {gid && <Link className="mz-btn is-ghost-ink mz-pill" href={productHref(gid)} onClick={onClose}><Icon name="bag" size={18} />{c.liveSize}</Link>}
              {mode === 'local' && onRealistic && (b.ai.image || b.ai.free) && gid && <button type="button" className="mz-reset mz-btn is-light mz-pill" onClick={() => onRealistic(shot.frame, gid)}><Icon name="hanger" size={18} />{c.liveAi}</button>}
            </motion.div>
          )}
        </AnimatePresence>
        <p className="mz-live__note"><Icon name="lock" size={18} />{mode !== 'local' ? c.liveAiNote.replace('{who}', who) : onRealistic && b.ai.image ? c.liveNote : onRealistic && b.ai.free ? c.liveNoteFree : c.liveNoteLocal}</p>
      </div>
    </motion.div>
  );
}
