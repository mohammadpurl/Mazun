'use client';
/* Small charts: the sparkline in the KPI tiles, the progress ring, the donut of sales by collection and the
   vertical bars (sizes, upcoming events). GSAP draws strokes and grows bars; Motion handles hover and tooltips. */
import { AnimatePresence, motion } from 'motion/react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { CountUp, useGsap, useSeen } from '../ui/motion';
import { smoothPath, useWidth } from './useWidth';

/** A tiny trend line with a soft fill, for the KPI tiles. */
export function Sparkline({ values, className = 'spark', height = 46 }: { values: number[]; className?: string; height?: number }) {
  const [box, w] = useWidth<HTMLDivElement>();
  const svg = useRef<SVGSVGElement>(null);
  const gid = useId().replace(/:/g, '');
  const W = Math.max(w, 60), H = height;
  const max = Math.max(1, ...values), min = Math.min(0, ...values);
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * W, H - 4 - ((v - min) / (max - min || 1)) * (H - 10)] as [number, number]);
  const line = smoothPath(pts);
  const area = pts.length ? `${line}L${W},${H}L0,${H}Z` : '';
  useGsap(svg, ({ reduce, gsap }) => {
    const p = svg.current?.querySelector<SVGPathElement>('.l');
    if (!p || reduce || !w) return;
    const L = p.getTotalLength();
    gsap.fromTo(p, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.out', delay: 0.3 });
    gsap.fromTo(svg.current!.querySelector('.a'), { opacity: 0 }, { opacity: 1, duration: 1, delay: 0.6 });
  }, [w, line]);
  return (
    <div ref={box} className={className} aria-hidden="true" style={{ direction: 'ltr' }}>
      <svg ref={svg} width={W} height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '100%' }}>
        <defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".45" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient></defs>
        <path className="a" d={area} fill={`url(#${gid})`} />
        <path className="l" d={line} fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** A progress ring (0–100), drawn when it scrolls into view. */
export function Ring({ pct, label, color = 'var(--success)', size = 132, children }: { pct: number; label: string; color?: string; size?: number; children?: ReactNode }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const svg = useRef<SVGSVGElement>(null);
  const r = 52, C = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  useGsap(svg, ({ reduce, gsap }) => {
    const arc = svg.current?.querySelector('.arc');
    if (!arc || !seen) return;
    gsap.fromTo(arc, { strokeDashoffset: C }, { strokeDashoffset: C * (1 - p / 100), duration: reduce ? 0 : 1.4, ease: 'power3.out' });
  }, [seen, p]);
  return (
    <div ref={ref} className="ring" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${Math.round(p)}٪`}>
      <svg ref={svg} viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--muted-2)" strokeWidth="11" />
        <circle className="arc" cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C} />
      </svg>
      <div className="mid">{children ?? <><b><CountUp value={p} format={v => Math.round(v).toLocaleString('fa-IR') + '٪'} /></b><span>{label}</span></>}</div>
    </div>
  );
}

export interface Slice { id: string; label: string; value: number; color: string }

/** Share of a whole. Arcs are drawn in turn; hovering an arc (or its row in the legend) lifts it and shows its value
 *  in the middle. The legend is the table view: every slice is named with its value and share. */
export function Donut({ slices, total, format, centerLabel, legend }: {
  slices: Slice[]; total: number; format: (n: number) => string; centerLabel: string; legend: (on: string | null, setOn: (id: string | null) => void) => ReactNode;
}) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const svg = useRef<SVGSVGElement>(null);
  const [on, setOn] = useState<string | null>(null);
  const R = 70, SW = 22, C = 2 * Math.PI * R, GAP = slices.length > 1 ? 3 : 0;
  const sum = slices.reduce((a, s) => a + s.value, 0) || 1;
  let acc = 0;
  const arcs = slices.map(s => {
    const len = Math.max(0, (s.value / sum) * C - GAP);
    const a = { ...s, len, off: -acc };
    acc += (s.value / sum) * C;
    return a;
  });
  useGsap(svg, ({ reduce, gsap }) => {
    if (!seen) return;
    const els = svg.current!.querySelectorAll<SVGCircleElement>('.seg');
    els.forEach((el, i) => {
      const len = arcs[i]?.len ?? 0;
      if (reduce) { gsap.set(el, { strokeDasharray: `${len} ${C}` }); return; }
      gsap.fromTo(el, { strokeDasharray: `0 ${C}` }, { strokeDasharray: `${len} ${C}`, duration: 0.9, ease: 'power2.out', delay: 0.1 + i * 0.12 });
    });
  }, [seen, slices.map(s => s.value).join()]);
  const cur = slices.find(s => s.id === on);
  return (
    <div className="donut-wrap" ref={ref}>
      <div className="donut">
        <svg ref={svg} viewBox="0 0 180 180" role="img" aria-label={`${centerLabel}: ${format(total)}`}>
          <g transform="rotate(-90 90 90)">
            <circle cx="90" cy="90" r={R} fill="none" stroke="var(--muted)" strokeWidth={SW} />
            {arcs.map(a => (
              <motion.circle key={a.id} className="seg" cx="90" cy="90" r={R} fill="none" stroke={a.color} strokeWidth={SW} strokeDasharray={`0 ${C}`} strokeDashoffset={a.off}
                style={{ cursor: 'pointer', transformOrigin: '50% 50%', opacity: 1 }} initial={false} animate={{ scale: on === a.id ? 1.06 : 1, opacity: on && on !== a.id ? 0.35 : 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }} onPointerEnter={() => setOn(a.id)} onPointerLeave={() => setOn(null)} />
            ))}
          </g>
        </svg>
        <div className="mid" aria-hidden="true">
          <AnimatePresence mode="wait">
            <motion.div key={cur?.id ?? 'all'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <b>{cur ? format(cur.value) : <CountUp value={total} format={format} />}</b>
              <span>{cur ? cur.label : centerLabel}</span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      {legend(on, setOn)}
    </div>
  );
}

export interface Bar { label: string; a: number; b?: number; note?: string }

/** Vertical bars, optionally two stacked parts (a at the bottom, b on top), growing from the baseline. */
export function Bars({ data, height = 170, colorA = 'var(--c1)', colorB = 'var(--c3)', nameA, nameB, format, summary }: {
  data: Bar[]; height?: number; colorA?: string; colorB?: string; nameA: string; nameB?: string; format: (n: number) => string; summary: string;
}) {
  const [box, w] = useWidth<HTMLDivElement>();
  const [seenRef, seen] = useSeen<HTMLDivElement>();
  const svg = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const slot = Math.max(w, 200) / Math.max(1, data.length);
  // Too narrow for every label in one row: every other label drops to a second row, so a bar with orders always has its
  // label (an empty week's odd label is left out).
  const twoRows = slot < 56;
  const W = Math.max(w, 200), H = height + (twoRows ? 14 : 0), pb = twoRows ? 40 : 26, pt = 18;
  const max = Math.max(1, ...data.map(d => d.a + (d.b ?? 0)));
  const bw = Math.min(38, slot * 0.56);
  const ih = H - pb - pt;
  useGsap(svg, ({ reduce, gsap }) => {
    if (!seen || !w) return;
    const bars = svg.current!.querySelectorAll('.bar');
    if (reduce) { gsap.set(bars, { scaleY: 1 }); return; }
    gsap.fromTo(bars, { scaleY: 0 }, { scaleY: 1, duration: 0.8, ease: 'back.out(1.4)', stagger: 0.05, transformOrigin: '50% 100%' });
  }, [seen, w, data.map(d => d.a + '/' + (d.b ?? 0)).join()]);
  const h = hover !== null ? data[hover] : null;
  return (
    <div ref={seenRef} className="chart" style={{ direction: 'ltr' }}>
      <div ref={box} style={{ position: 'relative' }}>
        <svg ref={svg} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} onPointerLeave={() => setHover(null)}>
          <line className="gl" x1={0} x2={W} y1={H - pb} y2={H - pb} />
          {data.map((d, i) => {
            const cx = slot * i + slot / 2;
            const ha = (d.a / max) * ih, hb = ((d.b ?? 0) / max) * ih;
            const base = H - pb;
            return (
              <g key={i} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} opacity={hover !== null && hover !== i ? 0.45 : 1} style={{ transition: 'opacity .2s' }}>
                <rect className="hit" x={cx - slot / 2} y={0} width={slot} height={H} />
                <g className="bar" style={{ transform: seen ? undefined : 'scaleY(0)', transformBox: 'fill-box', transformOrigin: '50% 100%' }}>
                  {ha > 0 && <rect x={cx - bw / 2} y={base - ha} width={bw} height={ha} rx={hb > 0 ? 2 : 6} fill={colorA} />}
                  {hb > 0 && <rect x={cx - bw / 2} y={base - ha - hb - (ha > 0 ? 2 : 0)} width={bw} height={hb} rx={6} fill={colorB} />}
                </g>
                {d.a + (d.b ?? 0) > 0 && <text className="ax" x={cx} y={base - ha - hb - 6} textAnchor="middle" style={{ fill: 'var(--fg)', fontWeight: 600 }}>{format(d.a + (d.b ?? 0))}</text>}
                {(!twoRows || i % 2 === 0 || d.a + (d.b ?? 0) > 0) && <text className="ax" x={cx} y={twoRows && i % 2 ? H - 6 : H - (twoRows ? 20 : 8)} textAnchor="middle">{d.label}</text>}
              </g>
            );
          })}
        </svg>
        <AnimatePresence>
          {h && hover !== null && (
            <motion.div className="ctip" style={{ top: 0, direction: 'rtl' }} initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1, left: `${((slot * hover + slot / 2) / W) * 100}%`, x: '-50%' }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
              <b>{h.label}</b>
              <div className="r"><span><i className="key" style={{ '--k': colorA } as React.CSSProperties} />{nameA}</span><strong>{format(h.a)}</strong></div>
              {nameB && <div className="r"><span><i className="key" style={{ '--k': colorB } as React.CSSProperties} />{nameB}</span><strong>{format(h.b ?? 0)}</strong></div>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="sr-only"><table>
        <caption>{summary}</caption>
        <tbody>{data.map((d, i) => <tr key={i}><td>{d.label}</td><td>{nameA}: {format(d.a)}</td>{nameB && <td>{nameB}: {format(d.b ?? 0)}</td>}</tr>)}</tbody>
      </table></div>
    </div>
  );
}
