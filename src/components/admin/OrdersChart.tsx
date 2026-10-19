'use client';
import { useState } from 'react';

/* Single-series bar chart: orders per day. One hue, thin bars with rounded tops on a zero baseline,
   recessive grid, per-bar hover tooltip with a hit area wider than the bar, and a hidden table for screen readers. */
export function OrdersChart({ data }: { data: { day: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = 200, padTop = 12, padBottom = 26, padStart = 28;
  const plotH = H - padTop - padBottom;
  const max = Math.max(4, ...data.map(d => d.count));
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const slot = (W - padStart) / data.length;
  const barW = Math.min(22, slot - 4);
  const y = (v: number) => padTop + plotH - (v / top) * plotH;
  // RTL: the newest day sits on the left so time reads right-to-left like the page.
  const x = (i: number) => padStart + (data.length - 1 - i) * slot + (slot - barW) / 2;
  const label = (day: string) => new Date(day + 'T12:00:00Z').toLocaleDateString('fa-IR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const r = 4;
  const bar = (bx: number, by: number, h: number) =>
    h <= 0 ? '' : h < r
      ? `M${bx},${by + h}V${by}H${bx + barW}V${by + h}Z`
      : `M${bx},${by + h}V${by + r}Q${bx},${by} ${bx + r},${by}H${bx + barW - r}Q${bx + barW},${by} ${bx + barW},${by + r}V${by + h}Z`;

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="نمودار تعداد سفارش در هر روز">
        {[0, 1, 2, 3, 4].map(k => (
          <g key={k}>
            <line className="grid-line" x1={padStart} x2={W} y1={y(k * step)} y2={y(k * step)} />
            <text className="axis" x={padStart - 6} y={y(k * step) + 3} textAnchor="end">{(k * step).toLocaleString('fa-IR')}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const bx = x(i), by = y(d.count), h = y(0) - by;
          return (
            <g key={d.day} className="col" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect className="hit" x={padStart + (data.length - 1 - i) * slot} y={padTop} width={slot} height={plotH} />
              <path className="bar" d={bar(bx, by, h)} style={hover === i ? { fill: '#24406a' } : undefined} />
              {(i % 2 === (data.length - 1) % 2) && (
                <text className="axis" x={bx + barW / 2} y={H - 8} textAnchor="middle">{label(d.day)}</text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="tip" style={{ left: `${((x(hover) + barW / 2) / W) * 100}%`, top: `${(y(data[hover].count) / H) * 100}%` }}>
          {label(data[hover].day)}: {data[hover].count.toLocaleString('fa-IR')} سفارش
        </div>
      )}
      <table className="sr-only">
        <caption>سفارش‌ها در هر روز</caption>
        <tbody>{data.map(d => <tr key={d.day}><th>{label(d.day)}</th><td>{d.count}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
