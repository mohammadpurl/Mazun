/* Reads body proportions from pose landmarks (MediaPipe, in the browser). The customer gives her height, which sets the
   scale; the joints then give shoulder and hip widths, from which a bust measurement is estimated for the size guide.
   It is an estimate from joints, not a tape measure, so the shop always calls it one. No DOM, so it can be tested. */

export type Landmark = { x: number; y: number; visibility?: number };
export type Hint = 'noone' | 'back' | 'closer' | 'face';
export type Reading = { ok: true; shoulder: number; hip: number } | { ok: false; hint: Hint };

const NOSE = 0, L_SHOULDER = 11, R_SHOULDER = 12, L_HIP = 23, R_HIP = 24, L_ANKLE = 27, R_ANKLE = 28;

/** Nose to ankle is about this share of standing height. */
const NOSE_TO_ANKLE = 0.89;
/** Bust from the shoulder joints, and from the hip joints less the usual bust-to-hip difference. */
const BUST_PER_SHOULDER = 2.55, BUST_PER_HIP = 4.95, HIP_MINUS_BUST = 8;

const seen = (p: Landmark | undefined) => !!p && (p.visibility ?? 1) > 0.5;
/** Ankles under a long abaya are found with low confidence but in the right place, so they get a lower bar. */
const located = (p: Landmark | undefined) => !!p && (p.visibility ?? 1) > 0.15;
const mid = (a: Landmark, b: Landmark) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** One frame: shoulder and hip widths as shares of standing height, or what she should change. `aspect` is the
 *  frame's width over its height, because landmarks are given as shares of each side. */
export function readFrame(lm: Landmark[] | undefined, aspect: number): Reading {
  if (!lm) return { ok: false, hint: 'noone' };
  const [nose, ls, rs, lh, rh] = [lm[NOSE], lm[L_SHOULDER], lm[R_SHOULDER], lm[L_HIP], lm[R_HIP]];
  if (!seen(nose) || !seen(ls) || !seen(rs)) return { ok: false, hint: 'noone' };
  const la = lm[L_ANKLE], ra = lm[R_ANKLE];
  if (!seen(lh) || !seen(rh) || !located(la) || !located(ra) || la.y > 0.99 || ra.y > 0.99 || nose.y < 0.01) return { ok: false, hint: 'back' };
  const ankles = mid(la, ra);
  const span = ankles.y - nose.y;
  if (span <= 0) return { ok: false, hint: 'back' };
  if (span < 0.5) return { ok: false, hint: 'closer' };
  const stature = span / NOSE_TO_ANKLE;
  const shoulder = Math.hypot((ls.x - rs.x) * aspect, ls.y - rs.y) / stature;
  const hip = Math.hypot((lh.x - rh.x) * aspect, lh.y - rh.y) / stature;
  // Turned away, the shoulders close up; shoulders that tilt mean she is leaning.
  if (shoulder < 0.13 || Math.abs(ls.y - rs.y) > span * 0.05) return { ok: false, hint: 'face' };
  return { ok: true, shoulder, hip };
}

const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** The bust estimate in cm from good frames and her height: medians, so a stray frame cannot move it. */
export function estimateBust(frames: { shoulder: number; hip: number }[], heightCm: number): number | null {
  if (!frames.length || heightCm <= 0) return null;
  const shoulder = median(frames.map(f => f.shoulder)) * heightCm;
  const hip = median(frames.map(f => f.hip)) * heightCm;
  const bust = (shoulder * BUST_PER_SHOULDER + hip * BUST_PER_HIP - HIP_MINUS_BUST) / 2;
  return Math.round(Math.max(70, Math.min(135, bust)));
}

/** Frames collected before the scan is done. */
export const SCAN_FRAMES = 36;
