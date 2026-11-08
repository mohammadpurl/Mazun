'use client';
/* Where this period's orders went: Oman as a field of dots, a route from the atelier in Muscat to every city that
   ordered, the busiest cities labelled with their order count. GSAP draws the routes one after another and sends a
   light along each, once (no looping decoration). Hover or focus a city for its numbers. */
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import { OMAN_CITIES } from '@/lib/places';
import { faNum } from '../ui/format';
import { useGsap, useSeen } from '../ui/motion';
import { useWidth } from './useWidth';

type LonLat = [number, number];
/** Mainland Oman and the Musandam exclave, simplified (lon, lat). Accurate to a few kilometres; drawn as dots. */
const MAINLAND: LonLat[] = [
  [56.37, 24.98], [56.62, 24.55], [56.75, 24.35], [57.1, 24.0], [57.5, 23.8], [57.9, 23.68], [58.2, 23.62], [58.55, 23.62], [58.75, 23.45], [58.95, 23.2],
  [59.25, 22.9], [59.53, 22.58], [59.82, 22.52], [59.8, 22.3], [59.55, 21.95], [59.3, 21.45], [58.95, 21.05], [58.7, 20.6], [58.3, 20.4], [57.95, 20.2],
  [57.75, 19.8], [57.7, 19.4], [57.8, 19.05], [57.4, 18.9], [56.95, 18.75], [56.6, 18.2], [56.3, 17.92], [55.7, 17.75], [55.3, 17.4], [54.8, 17.0],
  [54.1, 16.95], [53.6, 16.75], [53.1, 16.65], [52.8, 17.3], [52.0, 19.0], [54.0, 19.65], [55.0, 20.0], [55.67, 22.0], [55.2, 22.7], [55.75, 23.95],
  [55.85, 24.25], [56.05, 24.75],
];
const MUSANDAM: LonLat[] = [[56.08, 26.08], [56.2, 26.38], [56.4, 26.36], [56.48, 26.1], [56.4, 25.85], [56.25, 25.65], [56.1, 25.8]];
const inside = (p: LonLat, poly: LonLat[]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const LON0 = 51.7, LON1 = 60.1, LAT0 = 16.4, LAT1 = 26.6, KX = Math.cos((21.5 * Math.PI) / 180);
const HOME = OMAN_CITIES.find(c => c.key === 'muscat')!;

export interface MapCity { key: string; name: string; lat: number | null; lon: number | null; orders: number; revenue: number }

export function OmanMap({ cities, money }: { cities: MapCity[]; money: (n: number) => string }) {
  const [box, w] = useWidth<HTMLDivElement>();
  const [seenRef, seen] = useSeen<HTMLDivElement>(0.3);
  const svg = useRef<SVGSVGElement>(null);
  const [on, setOn] = useState<string | null>(null);
  const W = Math.max(w, 260), H = Math.max(340, Math.min(540, W * 0.92));
  const pad = 26;
  const k = Math.min((W - pad * 2) / ((LON1 - LON0) * KX), (H - pad * 2) / (LAT1 - LAT0));
  const ox = (W - (LON1 - LON0) * KX * k) / 2, oy = (H - (LAT1 - LAT0) * k) / 2;
  const proj = (lon: number, lat: number) => [ox + (lon - LON0) * KX * k, oy + (LAT1 - lat) * k] as const;

  const dots = useMemo(() => {
    const step = Math.max(6, Math.round(k * 0.18));
    const out: [number, number][] = [];
    for (let y = oy; y < H - oy; y += step) for (let x = ox; x < W - ox; x += step) {
      const lon = LON0 + (x - ox) / (KX * k), lat = LAT1 - (y - oy) / k;
      if (inside([lon, lat], MAINLAND) || inside([lon, lat], MUSANDAM)) out.push([x, y]);
    }
    return out;
  }, [W, H, k, ox, oy]);

  const placed = cities.filter(c => c.lat !== null && c.lon !== null && c.orders > 0);
  const max = Math.max(1, ...placed.map(c => c.orders));
  const [hx, hy] = proj(HOME.lon, HOME.lat);
  const routes = placed.filter(c => c.key !== HOME.key).map(c => {
    const [x, y] = proj(c.lon!, c.lat!);
    const mx = (hx + x) / 2, my = (hy + y) / 2, dx = x - hx, dy = y - hy, len = Math.hypot(dx, dy) || 1;
    const bend = Math.min(80, len * 0.28);
    return { ...c, x, y, d: `M${hx},${hy} Q${mx - (dy / len) * bend},${my + (dx / len) * bend} ${x},${y}` };
  });
  const home = placed.find(c => c.key === HOME.key);

  // Labels for the busiest cities: each tries east, west, above and below its dot and takes the first place that stays
  // inside the map and clear of other labels and dots; a city with no free place keeps just its dot.
  const labels = useMemo(() => {
    const pts = [...routes.map(r => [r.x, r.y] as const), [hx, hy] as const];
    const taken: { x: number; y: number; w: number; h: number }[] = [];
    const hit = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
      a.x < b.x + b.w + 4 && b.x < a.x + a.w + 4 && a.y < b.y + b.h + 4 && b.y < a.y + a.h + 4;
    const out: { key: string; text: string; n: number; x: number; y: number; w: number }[] = [];
    const homeRow = { key: HOME.key, name: HOME.fa, orders: home?.orders ?? 0, x: hx, y: hy, home: true };
    const list = [homeRow, ...[...routes].sort((a, b) => b.orders - a.orders).map(c => ({ ...c, home: false }))];
    for (const c of list.slice(0, 7)) {
      const text = c.home ? `${c.name} · آتلیه` : c.name;
      const lw = Math.round(text.length * 6.4 + (c.orders ? 32 : 18)), lh = 22;
      const tries = [
        { x: c.x + 12, y: c.y - lh / 2 }, { x: c.x - lw - 12, y: c.y - lh / 2 },
        { x: c.x - lw / 2, y: c.y - lh - 12 }, { x: c.x - lw / 2, y: c.y + 12 },
      ].map(p => ({ ...p, w: lw, h: lh }));
      const spot = tries.find(r => r.x >= 4 && r.x + r.w <= W - 4 && r.y >= 4 && r.y + r.h <= H - 4
        && !taken.some(t => hit(r, t)) && !pts.some(([px, py]) => (px !== c.x || py !== c.y) && px > r.x - 6 && px < r.x + r.w + 6 && py > r.y - 6 && py < r.y + r.h + 6));
      if (!spot) continue;
      taken.push(spot);
      out.push({ key: c.key, text, n: c.orders, x: spot.x, y: spot.y, w: lw });
    }
    return out;
  }, [routes.map(r => r.key + r.orders).join(), W, H]); // eslint-disable-line react-hooks/exhaustive-deps

  useGsap(svg, ({ reduce, gsap }) => {
    if (!seen || !w) return;
    const root = svg.current!;
    const paths = [...root.querySelectorAll<SVGPathElement>('.route')];
    const pins = root.querySelectorAll('.city');
    const tags = root.querySelectorAll('.label');
    const dots = root.querySelectorAll('.dot');
    const shown = [...pins, ...tags];
    if (reduce) { if (paths.length) gsap.set(paths, { strokeDashoffset: 0 }); if (shown.length) gsap.set(shown, { opacity: 1, scale: 1 }); return; }
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    if (dots.length) tl.fromTo(dots, { opacity: 0 }, { opacity: 1, duration: 0.6, stagger: { amount: 0.6, from: 'random' } }, 0);
    paths.forEach((p, i) => {
      const L = p.getTotalLength();
      gsap.set(p, { strokeDasharray: L, strokeDashoffset: L });
      tl.to(p, { strokeDashoffset: 0, duration: 1.1 }, 0.5 + i * 0.12);
      const light = root.querySelector<SVGCircleElement>(`.light[data-i="${i}"]`);
      if (light) {
        const o = { t: 0 };
        tl.fromTo(light, { opacity: 0 }, { opacity: 1, duration: 0.1 }, 0.5 + i * 0.12);
        tl.to(o, { t: 1, duration: 1.1, ease: 'power1.inOut', onUpdate: () => { const pt = p.getPointAtLength(o.t * L); light.setAttribute('cx', String(pt.x)); light.setAttribute('cy', String(pt.y)); } }, 0.5 + i * 0.12);
        tl.to(light, { opacity: 0, duration: 0.3 }, '>-0.1');
      }
    });
    if (pins.length) tl.fromTo(pins, { opacity: 0, scale: 0, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2.2)', stagger: 0.06 }, 0.7);
    if (tags.length) tl.fromTo(tags, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.08 }, 1.1);
  }, [seen, w, routes.length]);

  const cur = placed.find(c => c.key === on) ?? (on === HOME.key ? home : undefined);
  const curXY = cur ? proj(cur.lon!, cur.lat!) : null;

  return (
    <div ref={seenRef} className="map-box">
      <div ref={box} style={{ position: 'relative', direction: 'ltr' }}>
        <svg ref={svg} className="map" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="نقشهٔ عمان با مسیر ارسال سفارش‌ها از آتلیه در مسقط به شهرها">
          <defs>
            <linearGradient id="routeGrad" x1="0" x2="1">
              <stop offset="0" stopColor="#D9838B" /><stop offset="1" stopColor="#E8C9A0" />
            </linearGradient>
          </defs>
          <g>{dots.map(([x, y], i) => <circle key={i} className="dot" cx={x} cy={y} r={1.6} style={{ opacity: seen ? undefined : 0 }} />)}</g>
          {routes.map((r, i) => <path key={r.key} className="route" d={r.d} style={{ opacity: on && on !== r.key ? 0.25 : 1, transition: 'opacity .2s' }} data-i={i} />)}
          {routes.map((_, i) => <circle key={i} className="light" data-i={i} r={3} fill="#FFF3E2" opacity={0} />)}
          {[...routes, ...(home ? [{ ...home, x: hx, y: hy }] : [])].map(c => {
            const r = 3.5 + (c.orders / max) * 5;
            const isHome = c.key === HOME.key;
            return (
              <g key={c.key} className={`city${isHome ? ' home' : ''}`} tabIndex={0} role="button" aria-label={`${c.name}: ${faNum(c.orders)} سفارش، ${money(c.revenue)}`}
                onPointerEnter={() => setOn(c.key)} onPointerLeave={() => setOn(null)} onFocus={() => setOn(c.key)} onBlur={() => setOn(null)} style={{ cursor: 'pointer', outline: 'none', opacity: seen ? undefined : 0 }}>
                <circle className="halo" cx={c.x} cy={c.y} r={r + 7} />
                <circle className="core" cx={c.x} cy={c.y} r={r} />
              </g>
            );
          })}
          {!home && <g className="city home"><circle className="halo" cx={hx} cy={hy} r={10} /><circle className="core" cx={hx} cy={hy} r={5} /></g>}
          {labels.map(l => (
            <g key={l.key} className="label" style={{ opacity: seen ? undefined : 0 }} pointerEvents="none">
              <rect x={l.x} y={l.y} width={l.w} height={22} rx={11} />
              <text x={l.x + l.w - 10} y={l.y + 15} textAnchor="end">{l.text}</text>
              {l.n > 0 && <text className="n" x={l.x + 10} y={l.y + 15} textAnchor="start">{faNum(l.n)}</text>}
            </g>
          ))}
        </svg>
        <AnimatePresence>
          {cur && curXY && (
            <motion.div className="ctip" style={{ direction: 'rtl', left: curXY[0], top: curXY[1] }}
              initial={{ opacity: 0, y: 4, x: '-50%' }} animate={{ opacity: 1, y: 'calc(-100% - 16px)', x: '-50%' }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <b>{cur.name}</b>
              <div className="r"><span>سفارش</span><strong>{faNum(cur.orders)}</strong></div>
              <div className="r"><span>فروش</span><strong>{money(cur.revenue)}</strong></div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
