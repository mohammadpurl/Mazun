/* The on-device mirror's geometry, kept free of the DOM so it can be tested: how long the cloth falls, how far a
   sleeve turns with the arm, and angle arithmetic that never spins the long way round. */

export type XY = { x: number; y: number };

/** An angle folded into (-π, π]. */
export const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Eases from `prev` toward `next` by `t`, the short way round for angles. */
export const easeAngle = (prev: number, next: number, t: number) => wrap(prev + wrap(next - prev) * t);

/** How far the cloth should fall below the shoulders: to the ankles when they show (a touch past them, to the floor);
 *  otherwise from the hips (the floor sits about 2.7 shoulder-to-hip lengths down); otherwise from the shoulder width
 *  (shoulder joints to floor is about 3.8 widths). */
export function clothLength(mid: XY, scale: number, ankles: XY | null, hips: XY | null): number {
  if (ankles) return Math.hypot(ankles.x - mid.x, ankles.y - mid.y) * 1.04;
  if (hips) return Math.hypot(hips.x - mid.x, hips.y - mid.y) * 2.7;
  return scale * 3.8;
}

/** The vertical scale for a cut-out whose cloth runs `below` pixels under its shoulder line, kept within a believable
 *  stretch of its own proportions (`s` is the width scale). */
export const stretch = (s: number, len: number, below: number) => Math.max(s * 0.85, Math.min(s * 1.9, len / Math.max(1, below)));

/** How far to turn a sleeve: from the way it hangs in the photo (its weight vector, drawn at scales sx/sy) to the
 *  upper arm's angle in the body's own frame, kept short of turning inside out. */
export function sleeveTurn(armBody: number, hang: { dx: number; dy: number }, sx: number, sy: number): number {
  const rest = Math.atan2(hang.dy * sy, hang.dx * sx);
  return Math.max(-2.4, Math.min(2.4, wrap(armBody - rest)));
}

/** True when `p` lies inside the polygon. */
export function inside(p: XY, poly: XY[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/** The part of a garment cut-out that counts as one sleeve: outside the torso from the shoulder line, then below the
 *  armpit only outside a diagonal running down and out to the sleeve's end, so the skirt's flare stays with the body.
 *  `dir` is -1 for the image's left (her right arm) and 1 for its right. */
export function sleevePolygon(dir: -1 | 1, f: { row: number; cx: number; span: number }, w: number, h: number): XY[] {
  const edge = f.cx + dir * f.span * 0.32, outer = dir < 0 ? 0 : w;
  const top = Math.max(0, f.row - f.span * 0.06), armpit = f.row + f.span * 0.35, end = Math.min(h, f.row + h * 0.45);
  return [{ x: edge, y: top }, { x: edge, y: armpit }, { x: outer, y: end }, { x: outer, y: top }];
}
