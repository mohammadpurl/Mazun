'use client';
/* The dashboard: sales for the chosen period against the one before, where the orders went, what needs doing, what
   sells, money still to come in, and deliveries. Layout follows the reference panel's /dashboard: a dark hero (money
   and a map), four colour tiles, then cards. */
import Link from 'next/link';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { FUNNEL_LABEL } from '@/lib/labels';
import { PERIOD_LABEL, type Dashboard as Data, type Period } from '@/lib/stats';
import { AreaChart } from '../charts/AreaChart';
import { OmanMap } from '../charts/OmanMap';
import { Bars, Donut, Ring, Sparkline } from '../charts/small';
import { Delta, Empty, PageHeader, SearchInput, Segmented } from '../ui/controls';
import { DataTable, type Column } from '../ui/DataTable';
import { faCompact, faMonth, faNum, faPct, searchable } from '../ui/format';
import { AIcon, type AIconName } from '../ui/Icon';
import { CountUp, item, Reveal, Stagger } from '../ui/motion';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [{ value: 'week', label: 'هفته' }, { value: 'month', label: 'ماه' }, { value: 'year', label: 'سال' }];
const DAYS: Record<Period, number> = { week: 7, month: 30, year: 365 };
const PALETTE = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];

function Wave() {
  return (
    <svg className="wave" viewBox="0 0 60 82" aria-hidden="true">
      <path d="M60 0H8c-6 0-9 6-6 11 5 9 13 12 13 24 0 14-10 18-10 30 0 10 9 17 22 17h33Z" fill="#fff" opacity=".14" />
      <path d="M60 0H22c-5 0-7 5-5 9 4 8 10 11 10 21 0 12-8 16-8 26 0 8 7 14 18 14h23Z" fill="#fff" opacity=".2" />
    </svg>
  );
}

function Kpi({ tone, icon, value, format, label, sub, spark, href }: {
  tone: 1 | 2 | 3 | 4; icon: AIconName; value: number; format: (n: number) => string; label: string; sub: string; spark: number[]; href: string;
}) {
  return (
    <motion.div variants={item} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}>
      <Link href={href} className={`kpi-g k${tone}`} style={{ height: '100%' }}>
        <Wave />
        <span className="orb"><AIcon name={icon} duo /></span>
        <span className="go" aria-hidden="true"><AIcon name="left" /></span>
        <span className="v"><CountUp value={value} format={format} /></span>
        <span className="k">{label}</span>
        <span className="s">{sub}</span>
        <Sparkline values={spark} />
      </Link>
    </motion.div>
  );
}

function CardHead({ icon, title, sub, children, tone = 'soft' }: { icon: AIconName; title: string; sub?: string; children?: React.ReactNode; tone?: string }) {
  return (
    <div className="card-head">
      <span className={`tile sm ${tone}`}><AIcon name={icon} duo /></span>
      <div className="titles"><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
      {children}
    </div>
  );
}

export function Dashboard({ data, initial, currency, live, origin }: { data: Record<Period, Data>; initial: Period; currency: string; live: boolean; origin: string }) {
  const [period, setPeriod] = useState<Period>(initial);
  const d = data[period];
  const P = PERIOD_LABEL[period];
  const money = (n: number) => `${faNum(Math.round(n))} ${currency}`;
  const moneyShort = (n: number) => faCompact(n);
  const [funnelView, setFunnelView] = useState<'count' | 'pct'>('count');
  const [smooth, setSmooth] = useState<'day' | 'avg'>('avg');
  const [q, setQ] = useState('');

  const setP = (p: Period) => {
    setPeriod(p);
    const u = new URL(location.href);
    u.searchParams.set('period', p);
    history.replaceState(null, '', u);
  };
  const exportHref = useMemo(() => {
    const from = new Date(Date.now() - DAYS[period] * 86_400_000).toISOString().slice(0, 10);
    return `/api/admin/orders/export?from=${from}`;
  }, [period]);

  const series = d.series.map(b => ({ label: b.label, value: b.revenue, prev: b.prevRevenue, note: `${faNum(b.orders)} سفارش` }));
  // Daily sales jump around; a trailing seven-day average shows where they are heading.
  const avg7 = (xs: number[], i: number) => { const w = xs.slice(Math.max(0, i - 6), i + 1); return Math.round(w.reduce((a, b) => a + b, 0) / w.length); };
  const smoothed = series.map((b, i) => ({ ...b, value: avg7(series.map(x => x.value), i), prev: avg7(series.map(x => x.prev ?? 0), i), note: 'میانگین ۷ روز تا این روز' }));
  const slices = d.byCollection.slice(0, 5).map((c, i) => ({ id: c.id, label: c.name, value: c.revenue, color: PALETTE[i] }));
  const collTotal = d.byCollection.reduce((a, c) => a + c.revenue, 0);
  const funnelMax = Math.max(1, d.funnel[0].count);
  const cityRows = d.cities.filter(c => !q || searchable(c.name).includes(searchable(q)));
  const cityMax = Math.max(1, ...d.cities.map(c => c.orders));

  const cityCols: Column<Data['cities'][number]>[] = [
    { key: 'name', header: 'شهر', minWidth: 170, card: 'title', sort: c => c.name, render: c => (
      <span className="who"><span className="tile sm soft" style={{ width: 34, height: 34, fontSize: 16 }}><AIcon name="pin" duo /></span><span className="meta"><b>{c.name}</b>{c.lat === null && <span>خارج از فهرست شهرها</span>}</span></span>
    ) },
    { key: 'orders', header: 'سفارش', minWidth: 170, sort: c => c.orders, render: c => (
      <span className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
        <b className="num" style={{ minWidth: 28 }}>{faNum(c.orders)}</b>
        <motion.span style={{ flex: 1, height: 6, borderRadius: 99, background: 'var(--muted)', overflow: 'hidden', minWidth: 60 }} initial="h" whileInView="s" viewport={{ once: true }}>
          <motion.i style={{ display: 'block', height: '100%', background: 'var(--c2)', borderRadius: 99, transformOrigin: 'right' }} variants={{ h: { scaleX: 0 }, s: { scaleX: c.orders / cityMax } }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
        </motion.span>
      </span>
    ) },
    { key: 'delivered', header: 'تحویل‌شده', minWidth: 110, width: 120, sort: c => (c.orders ? c.delivered / c.orders : 0), render: c => (
      <span className={`chip ${c.orders && c.delivered / c.orders >= 0.8 ? 'ok' : 'warn'}`}>{faPct(c.orders ? (c.delivered / c.orders) * 100 : 0)}</span>
    ) },
    { key: 'days', header: 'میانگین تحویل', minWidth: 120, width: 140, sort: c => c.avgDays ?? 999, render: c => <span className="num">{c.avgDays === null ? '—' : `${faNum(c.avgDays, 1)} روز`}</span> },
    { key: 'revenue', header: 'فروش', minWidth: 140, width: 170, align: 'end', sort: c => c.revenue, render: c => <b className="num">{money(c.revenue)}</b> },
  ];

  return (
    <>
      <PageHeader icon="dashboard" title="داشبورد مزون" crumbs={[{ label: 'نمای مدیر' }, { label: faMonth() }]} sub="فروش، سفارش‌ها، ارسال و مشتریان آتلیه در یک نگاه.">
        <Segmented label="بازهٔ زمانی" value={period} onChange={setP} options={PERIOD_OPTIONS} />
        <a className="btn outline" href={exportHref} download><AIcon name="download" />خروجی سفارش‌های این بازه</a>
      </PageHeader>

      {/* hero: money on one side, the map on the other */}
      <Reveal className="hero" y={18}>
        <div className="hero-stats">
          <span className="eyebrow"><AIcon name="chartUp" duo />فروش {P.now}</span>
          <div className="big"><CountUp value={d.revenue.current} format={n => faNum(Math.round(n))} /><small>{currency}</small></div>
          <div className="vs"><Delta value={d.revenue.delta} /><span>نسبت به {P.prev} · {money(d.revenue.previous)}</span></div>
          {d.pending.count > 0 && <Link href="/admin/orders?status=new" className="vs" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>
            <AIcon name="hourglass" />+ {faNum(d.pending.count)} سفارش تأییدنشده ({money(d.pending.amount)}) که هنوز فروش حساب نمی‌شود
          </Link>}
          {d.goal ? (
            <div className="goal">
              <div className="row"><span><AIcon name="target" duo /> <b>{faPct(d.goal.pct)}</b> از هدف {d.goal.month}</span><span>هدف {money(d.goal.target)}</span></div>
              {/* The track (not the bar, which starts at zero width) is what comes into view and starts the fill. */}
              <motion.div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, d.goal.pct)} aria-label={`پیشرفت هدف ماهانه: ${faPct(d.goal.pct)}`}
                initial="h" whileInView="s" viewport={{ once: true }}>
                <motion.i variants={{ h: { scaleX: 0 }, s: { scaleX: Math.min(1, d.goal.pct / 100) } }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }} />
              </motion.div>
            </div>
          ) : (
            <Link href="/admin/settings#goal" className="vs" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}><AIcon name="target" />برای دیدن پیشرفت، هدف فروش ماهانه را تعیین کنید</Link>
          )}
          <div className="hero-trend">
            <AreaChart key={period} data={series} height={120} bare dark format={money} name="فروش" summary={`روند فروش ${P.now}`} color="#D9838B" />
          </div>
          <div className="hero-mini">
            <div><b><CountUp value={d.orders.current} format={n => faNum(Math.round(n))} /></b><span>سفارش</span></div>
            <div><b><CountUp value={d.pieces} format={n => faNum(Math.round(n))} /></b><span>قطعهٔ فروخته‌شده</span></div>
            <div><b><CountUp value={d.avgOrder.current} format={n => faCompact(n)} /></b><span>میانگین هر سفارش</span></div>
          </div>
        </div>
        <div className="hero-map">
          <span className="cap"><AIcon name="route" duo />سفارش‌های {P.now} به کجا رفتند</span>
          {d.cities.length ? <OmanMap key={period} cities={d.cities} money={money} /> : <Empty icon="pin" title="هنوز ارسالی در این بازه نیست" small />}
        </div>
      </Reveal>

      {/* four colour tiles */}
      <Stagger className="grid-4">
        <Kpi tone={1} icon="sparkle" value={d.open.new} format={n => faNum(Math.round(n))} label="سفارش‌های جدید"
          sub={d.staleNew.count ? `${faNum(d.staleNew.count)} مورد بیش از یک روز منتظر` : 'منتظر بررسی و تأیید'} spark={d.series.map(b => b.orders)} href="/admin/orders?status=new" />
        <Kpi tone={2} icon="package" value={d.shipping.awaiting} format={n => faNum(Math.round(n))} label="در انتظار ارسال"
          sub={`${faNum(d.shipping.inTransit)} مرسوله در راه`} spark={d.series.map(b => b.shipped)} href="/admin/shipments" />
        <Kpi tone={3} icon="userPlus" value={d.customers.fresh.current} format={n => faNum(Math.round(n))} label="مشتریان تازه"
          sub={d.customers.returningPct === null ? P.now : `${faPct(d.customers.returningPct)} از خریداران دوباره خریدند`} spark={d.series.map(b => b.customers)} href="/admin/customers?segment=new" />
        <Kpi tone={4} icon="wallet" value={d.payments.outstanding} format={n => faNum(Math.round(n))} label="مانده دریافت"
          sub={`${currency} · ${d.payments.overdue.count ? `${faNum(d.payments.overdue.count)} سفارش ارسال‌شده تسویه نشده` : 'از سفارش‌های پذیرفته‌شده'}`} spark={d.series.map(b => b.revenue)} href="/admin/orders?pay=due" />
      </Stagger>

      {/* sales trend + the order pipeline */}
      <div className="grid-main stretch">
        <Reveal className="card">
          <CardHead icon="chartUp" title="روند فروش" sub={`${P.now} در برابر ${P.prev} · ${currency}`}>
            {period !== 'year' && <Segmented size="sm" label="نمایش روند" value={smooth} onChange={setSmooth} options={[{ value: 'avg', label: 'میانگین ۷ روزه' }, { value: 'day', label: 'روزانه' }]} />}
            <div className="legend">
              <span><i className="key line" style={{ '--k': 'var(--c1)' } as React.CSSProperties} />{P.now}</span>
              <span><i className="key dash" style={{ '--k': 'var(--muted-fg)' } as React.CSSProperties} />{P.prev}</span>
            </div>
          </CardHead>
          {d.revenue.current || d.revenue.previous
            ? <AreaChart key={period + smooth} data={period !== 'year' && smooth === 'avg' ? smoothed : series} height={280} format={money} axisFormat={moneyShort} name={P.now} prevName={P.prev} summary={`فروش ${P.now}: ${money(d.revenue.current)}، ${P.prev}: ${money(d.revenue.previous)}`} />
            : <Empty icon="chartUp" title="در این بازه فروشی ثبت نشده" body="با اولین سفارش، روند فروش اینجا رسم می‌شود." small />}
        </Reveal>

        <Reveal className="card stack" delay={0.08}>
          <CardHead icon="filter" title="از سفارش تا تحویل" sub={`سفارش‌های ${P.now}`}>
            <Segmented size="sm" label="نمایش" value={funnelView} onChange={setFunnelView} options={[{ value: 'count', label: 'تعداد' }, { value: 'pct', label: 'درصد' }]} />
          </CardHead>
          <div className="funnel">
            {d.funnel.map((f, i) => (
              <div key={f.key} className="funnel-row">
                <div className="head">
                  <span className="step">{faNum(i + 1)}</span><span>{FUNNEL_LABEL[f.key]}</span>
                  <b>{funnelView === 'count' ? faNum(f.count) : faPct(f.pct)}</b>
                  <span className="pct">{funnelView === 'count' ? faPct(f.pct) : faNum(f.count)}</span>
                </div>
                <motion.div key={period} className="track" initial="h" whileInView="s" viewport={{ once: true }}>
                  <motion.i variants={{ h: { scaleX: 0 }, s: { scaleX: f.count / funnelMax } }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 + i * 0.12 }} style={{ opacity: 1 - i * 0.14 }} />
                </motion.div>
              </div>
            ))}
          </div>
          {d.cancelled > 0 && <p className="xs muted">{faNum(d.cancelled)} سفارش در این بازه لغو شد.</p>}
          {d.staleNew.count > 0 ? (
            <div className="insight">
              <AIcon name="hourglass" duo />
              <div className="grow"><b>{faNum(d.staleNew.count)} سفارش بیش از یک روز منتظر پاسخ است</b><span>مشتری‌ای که زود جواب بگیرد، کمتر منصرف می‌شود.</span></div>
              <Link className="btn sm" href="/admin/orders?status=new">پیگیری کنید</Link>
            </div>
          ) : (
            <div className="insight" style={{ background: 'color-mix(in srgb,var(--success) 8%,var(--card))' }}>
              <AIcon name="done" duo style={{ color: 'var(--success)' }} />
              <div className="grow"><b>همهٔ سفارش‌های جدید به‌موقع بررسی شده‌اند</b><span>هیچ سفارشی بیش از یک روز منتظر نمانده.</span></div>
            </div>
          )}
        </Reveal>
      </div>

      {/* where the money comes from + upcoming occasions */}
      <div className="grid-2">
        <Reveal className="card">
          <CardHead icon="pie" title="فروش از کدام مجموعه" sub={`سهم هر مجموعه از فروش ${P.now}`} />
          {slices.length ? (
            <Donut slices={slices} total={collTotal} format={moneyShort} centerLabel={currency} legend={(on, setOn) => (
              <ul className="shares">
                {d.byCollection.slice(0, 5).map((c, i) => (
                  <li key={c.id} className={on === c.id ? 'on' : undefined} onPointerEnter={() => setOn(c.id)} onPointerLeave={() => setOn(null)}>
                    <i className="key" style={{ '--k': PALETTE[i] } as React.CSSProperties} />
                    <span className="name">{c.name} <span className="xs muted num">({faPct(c.share)})</span></span>
                    <span className="val">{moneyShort(c.revenue)}</span>
                    <Delta value={c.delta} />
                  </li>
                ))}
              </ul>
            )} />
          ) : <Empty icon="pie" title="هنوز فروشی در این بازه نیست" small />}
        </Reveal>
        <Reveal className="card" delay={0.08}>
          <CardHead icon="calendar" title="مناسبت‌های پیش‌رو" sub="سفارش‌هایی که تاریخ مراسمشان در ۸ هفتهٔ آینده است">
            <div className="legend">
              <span><i className="key" style={{ '--k': 'var(--c1)' } as React.CSSProperties} />در دست آماده‌سازی</span>
              <span><i className="key" style={{ '--k': 'var(--c3)' } as React.CSSProperties} />ارسال شده</span>
            </div>
          </CardHead>
          {d.events.some(e => e.pending + e.ready)
            ? <Bars data={d.events.map(e => ({ label: e.label, a: e.pending, b: e.ready }))} nameA="در دست آماده‌سازی" nameB="ارسال شده" format={n => faNum(n)} summary="سفارش‌ها بر اساس هفتهٔ مراسم" />
            : <Empty icon="calendar" title="مراسمی در پیش نیست" body="وقتی مشتری تاریخ مراسم بدهد، اینجا برای برنامه‌ریزی دوخت نشان داده می‌شود." small />}
        </Reveal>
      </div>

      {/* best sellers + money and deliveries; the sold-out note sits at the foot of the card, level with the column beside it */}
      <div className="grid-main stretch">
        <Reveal className="card col-flex">
          <CardHead icon="crown" title="پرفروش‌ترین‌ها" sub={`بر اساس تعداد قطعه در ${P.now}`} tone="gold">
            <Link className="btn outline sm" href="/admin/garments"><AIcon name="products" />همهٔ محصولات</Link>
          </CardHead>
          {d.top.length ? (
            <Stagger as="ul" className="rank">
              {d.top.map((p, i) => (
                <motion.li key={p.id} variants={item}>
                  <span className={`medal${i < 3 ? ` m${i + 1}` : ''}`}>{faNum(i + 1)}</span>
                  <span className="ph" style={{ background: p.color }}>{p.image && <img src={p.image} alt="" loading="lazy" />}</span>
                  <span className="info">
                    <b title={p.name}>{p.name}</b>
                    <span className="meter">
                      <motion.span className="t" initial="h" whileInView="s" viewport={{ once: true }}><motion.i variants={{ h: { scaleX: 0 }, s: { scaleX: p.share / 100 } }} transition={{ duration: 0.9, delay: 0.2 + i * 0.06 }} /></motion.span>
                      <span className="num">{faNum(p.pieces)} قطعه</span>
                    </span>
                  </span>
                  <span className="amt">{money(p.revenue)}</span>
                </motion.li>
              ))}
            </Stagger>
          ) : <Empty icon="crown" title="هنوز فروشی ثبت نشده" small />}
          {d.soldOut.length > 0 && (
            <div className="alert foot">
              <AIcon name="warning" duo />
              <div className="grow">
                <b>سایزهای تمام‌شده</b>
                <p>{d.soldOut.map(s => `${s.name} (${s.sizes.join('، ')})`).join(' · ')}</p>
              </div>
              <Link className="btn outline sm" href="/admin/garments?stock=out">بررسی</Link>
            </div>
          )}
        </Reveal>

        <div className="stack">
          <Reveal className="card">
            <CardHead icon="wallet" title="پول در انتظار دریافت" sub="بیعانه‌ها و مانده‌ها" tone="olive" />
            <div className="money">
              <Ring pct={d.payments.paidPct} label="دریافت‌شده" />
              <div className="money-tiles">
                <div className="mtile" style={{ '--c': 'var(--success)' } as React.CSSProperties}>
                  <AIcon name="handCoins" duo /><div className="grow"><span>دریافت‌شده از سفارش‌های {P.now}</span><b><CountUp value={d.payments.collected} format={n => money(n)} /></b></div>
                </div>
                <div className="mtile" style={{ '--c': 'var(--warning)' } as React.CSSProperties}>
                  <AIcon name="hourglass" duo /><div className="grow"><span>مانده از همهٔ سفارش‌ها</span><b><CountUp value={d.payments.outstanding} format={n => money(n)} /></b></div>
                </div>
              </div>
            </div>
            <div className="row" style={{ marginBlockStart: 16, justifyContent: 'space-between' }}>
              {d.payments.overdue.count > 0
                ? <span className="chip danger"><i />{money(d.payments.overdue.amount)} مانده روی {faNum(d.payments.overdue.count)} سفارش ارسال‌شده</span>
                : <span className="chip ok"><AIcon name="done" />همهٔ ارسال‌شده‌ها تسویه‌اند</span>}
              <Link className="btn outline sm" href="/admin/orders?pay=overdue"><AIcon name="wallet" />پیگیری مانده‌ها</Link>
            </div>
          </Reveal>
          <Reveal className="dark-card" delay={0.08}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="row" style={{ gap: 12 }}>
                <span className="tile sm" style={{ background: 'linear-gradient(135deg,#8E3A43,#B8926A)' }}><AIcon name="shipments" duo /></span>
                <div><h2>ارسال‌ها در {P.now}</h2><p className="xs muted">از آتلیهٔ {origin} تا در خانهٔ مشتری</p></div>
              </div>
              {d.shipping.late
                ? <Link href="/admin/shipments?tab=transit" className="chip warn" style={{ background: 'rgba(226,165,76,.16)', color: '#F0BD6E' }}><AIcon name="clock" />{faNum(d.shipping.late)} مرسوله بیش از ۵ روز در راه</Link>
                : <span className="live"><i />همه به‌موقع</span>}
            </div>
            <div className="trio">
              <div><b><CountUp value={d.shipping.inTransit} format={n => faNum(Math.round(n))} /></b><span>در راه</span></div>
              <div><b><CountUp value={d.shipping.delivered} format={n => faNum(Math.round(n))} /></b><span>تحویل‌شده</span></div>
              <div><b>{d.shipping.avgDays === null ? '—' : <CountUp value={d.shipping.avgDays} format={n => faNum(n, 1)} />}</b><span>میانگین روز تا تحویل</span></div>
            </div>
          </Reveal>
          <Reveal className="card" delay={0.1}>
            <CardHead icon="checklist" title="سایزهای پرفروش" sub={`قطعه‌های فروخته‌شده در ${P.now} بر اساس سایز`} tone="blue" />
            {d.sizes.length
              ? <Bars data={d.sizes.map(s => ({ label: s.size, a: s.pieces }))} height={150} colorA="var(--c2)" nameA="قطعه" format={n => faNum(n)} summary="فروش بر اساس سایز" />
              : <Empty icon="checklist" title="هنوز فروشی در این بازه نیست" small />}
          </Reveal>
        </div>
      </div>

      {/* cities */}
      <Reveal>
        <DataTable label="ارسال بر اساس شهر" rows={cityRows} columns={cityCols} rowKey={c => c.key} pageSize={10} resetKey={q + period}
          initialSort={{ key: 'orders', dir: 'desc' }}
          toolbar={<>
            <div className="row" style={{ gap: 12, flex: '1 1 100%' }}>
              <span className="tile sm blue"><AIcon name="pin" duo /></span>
              <div className="grow"><h2>ارسال بر اساس شهر</h2><p className="xs muted">سفارش‌های {P.now} · مجموعاً {faNum(d.cities.length)} شهر</p></div>
            </div>
            <div className="search-box" style={{ flex: '1 1 260px', maxWidth: 420 }}><SearchInput value={q} onChange={setQ} placeholder="جستجوی شهر…" /></div>
          </>}
          empty={<Empty icon="pin" title={q ? `شهری با «${q}» پیدا نشد` : 'هنوز سفارشی در این بازه نیست'} action={q ? <button type="button" className="btn outline sm" onClick={() => setQ('')}>پاک کردن جستجو</button> : undefined} />} />
      </Reveal>

      {!live && <p className="xs muted" style={{ textAlign: 'center' }}>حالت محلی: داده‌ها از data/store.json خوانده می‌شوند (برای آزمایش با داده‌های نمونه: npm run seed:demo).</p>}
    </>
  );
}
