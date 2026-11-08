'use client';
/* Trend over time: this period as a filled line, the previous period as a dashed line on the same scale (one axis).
   GSAP draws the lines and fades the fill in when the chart scrolls into view; Motion moves the hover cursor, the dot
   and the tooltip. Pointer, touch and arrow keys all move the reading. Time runs left to right in both directions. */
import { AnimatePresence, motion } from 'motion/react';
import { useId, useMemo, useRef, useState } from 'react';
import { useGsap, useSeen } from '../ui/motion';
import { niceTicks, smoothPath, useWidth } from './useWidth';

export interface Point { label: string; value: number; prev?: number; note?: string }

export function AreaChart({ data, height = 260, format, axisFormat, name, prevName, color = 'var(--c1)', dark, bare, summary }: {
  data: Point[]; height?: number; format: (n: number) => string; axisFormat?: (n: number) => string; name: string; prevName?: string;
  color?: string; dark?: boolean; bare?: boolean; summary: string;
}) {
  const gid = useId().replace(/:/g, '');
  const [box, w] = useWidth<HTMLDivElement>();
  const [seenRef, seen] = useSeen<HTMLDivElement>();
  const svg = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const pad = bare ? { t: 8, r: 6, b: 6, l: 6 } : { t: 16, r: 12, b: 30, l: 52 };
  const W = Math.max(w, 200), H = height;
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const hasPrev = data.some(d => d.prev !== undefined);
  const max = Math.max(1, ...data.map(d => Math.max(d.value, d.prev ?? 0)));
  const ticks = niceTicks(max, bare ? 2 : 4);
  const top = ticks.at(-1)!;
  const x = (i: number) => pad.l + (data.length < 2 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / top) * ih;
  const pts = useMemo(() => data.map((d, i) => [x(i), y(d.value)] as [number, number]), [data, W, H, top]); // eslint-disable-line react-hooks/exhaustive-deps
  const prevPts = useMemo(() => data.map((d, i) => [x(i), y(d.prev ?? 0)] as [number, number]), [data, W, H, top]); // eslint-disable-line react-hooks/exhaustive-deps
  const line = smoothPath(pts);
  const area = pts.length ? `${line}L${pts.at(-1)![0]},${pad.t + ih}L${pts[0][0]},${pad.t + ih}Z` : '';
  const prevLine = hasPrev ? smoothPath(prevPts) : '';
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 74))));

  useGsap(svg, ({ reduce, gsap }) => {
    if (!seen || !w) return;
    const lines = svg.current!.querySelectorAll<SVGPathElement>('.draw');
    const fill = svg.current!.querySelector('.fill');
    const ghost = svg.current!.querySelector('.ghost');
    const axes = svg.current!.querySelectorAll('.ax, .gl');
    if (!lines.length) return;
    if (reduce) { gsap.set(lines, { strokeDasharray: 'none' }); return; }
    lines.forEach(p => { const L = p.getTotalLength(); gsap.set(p, { strokeDasharray: L, strokeDashoffset: L }); });
    // Only targets that exist (a bare chart has no axes, an empty one no fill), so GSAP never warns about a missing one.
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    tl.to(lines, { strokeDashoffset: 0, duration: 1.3 });
    if (fill) tl.fromTo(fill, { opacity: 0 }, { opacity: 1, duration: 0.8 }, 0.35);
    if (axes.length) tl.fromTo(axes, { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: 0.02 }, 0);
    if (ghost) tl.fromTo(ghost, { opacity: 0 }, { opacity: 0.7, duration: 0.8 }, 0.2);
  }, [seen, w, data.length, line]);

  const at = (clientX: number) => {
    const r = svg.current?.getBoundingClientRect();
    if (!r || !data.length) return;
    const px = ((clientX - r.left) / r.width) * W;
    const i = Math.round(((px - pad.l) / iw) * (data.length - 1));
    setHover(Math.min(data.length - 1, Math.max(0, i)));
  };
  const h = hover !== null ? data[hover] : null;
  const tipLeft = hover !== null ? (x(hover) / W) * 100 : 0;
  const flip = tipLeft > 62;

  return (
    <div ref={seenRef} className="chart" style={{ direction: 'ltr' }}>
      <div ref={box} style={{ position: 'relative' }}>
        <svg ref={svg} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} tabIndex={0}
          onPointerMove={e => at(e.clientX)} onPointerDown={e => at(e.clientX)} onPointerLeave={() => setHover(null)} onBlur={() => setHover(null)}
          onKeyDown={e => {
            if (e.key === 'ArrowRight') { e.preventDefault(); setHover(i => Math.min(data.length - 1, (i ?? -1) + 1)); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); setHover(i => Math.max(0, (i ?? data.length) - 1)); }
            if (e.key === 'Escape') setHover(null);
          }}
          style={{ touchAction: 'pan-y', outline: 'none' }}>
          <defs>
            <linearGradient id={`f${gid}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity={dark ? 0.42 : 0.26} />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {!bare && ticks.map(t => (
            <g key={t}>
              <line className="gl" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} style={dark ? { stroke: 'var(--hero-line)' } : undefined} />
              <text className="ax" x={pad.l - 10} y={y(t) + 4} textAnchor="end" style={dark ? { fill: 'var(--hero-muted)' } : undefined}>{(axisFormat ?? format)(t)}</text>
            </g>
          ))}
          {!bare && data.map((d, i) => (i % every === 0 || i === data.length - 1) && (data.length - 1 - i >= every || i === data.length - 1) ? (
            <text key={i} className="ax" x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
              style={dark ? { fill: 'var(--hero-muted)' } : undefined}>{d.label}</text>
          ) : null)}
          <path className="fill" d={area} fill={`url(#f${gid})`} style={{ opacity: seen ? undefined : 0 }} />
          {hasPrev && <path className="ghost" d={prevLine} fill="none" stroke={dark ? 'rgba(244,234,228,.35)' : 'var(--muted-fg)'} strokeWidth={1.5} strokeDasharray="4 5" style={{ opacity: seen ? 0.7 : 0 }} />}
          <path className="draw" d={line} fill="none" stroke={color} strokeWidth={bare ? 2 : 2.4} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: seen ? 1 : 0 }} />
          {h && hover !== null && (
            <g pointerEvents="none">
              <motion.line className="cursor" y1={pad.t} y2={pad.t + ih} initial={false} animate={{ x1: x(hover), x2: x(hover) }} transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                style={dark ? { stroke: 'rgba(244,234,228,.4)' } : undefined} />
              {hasPrev && <motion.circle r={4} fill={dark ? 'var(--hero)' : 'var(--card)'} stroke={dark ? 'rgba(244,234,228,.6)' : 'var(--muted-fg)'} strokeWidth={2} initial={false}
                animate={{ cx: x(hover), cy: y(h.prev ?? 0) }} transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
              <motion.circle r={6} fill={color} stroke={dark ? 'var(--hero)' : 'var(--card)'} strokeWidth={3} initial={false}
                animate={{ cx: x(hover), cy: y(h.value) }} transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
            </g>
          )}
        </svg>
        <AnimatePresence>
          {h && hover !== null && (
            <motion.div className="ctip" style={{ top: Math.max(0, y(h.value) - 20), direction: 'rtl' }} initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1, left: `${tipLeft}%`, x: flip ? 'calc(-100% - 14px)' : '14px' }} exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
              <b>{h.label}</b>
              <div className="r"><span><i className="key line" style={{ '--k': color } as React.CSSProperties} />{name}</span><strong>{format(h.value)}</strong></div>
              {hasPrev && <div className="r"><span><i className="key dash" style={{ '--k': 'var(--muted-fg)' } as React.CSSProperties} />{prevName}</span><strong>{format(h.prev ?? 0)}</strong></div>}
              {h.note && <div className="r"><span>{h.note}</span></div>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="sr-only"><table>
        <caption>{summary}</caption>
        <thead><tr><th>بازه</th><th>{name}</th>{hasPrev && <th>{prevName}</th>}</tr></thead>
        <tbody>{data.map((d, i) => <tr key={i}><td>{d.label}</td><td>{format(d.value)}</td>{hasPrev && <td>{format(d.prev ?? 0)}</td>}</tr>)}</tbody>
      </table></div>
    </div>
  );
}
