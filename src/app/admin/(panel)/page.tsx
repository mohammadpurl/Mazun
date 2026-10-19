import Link from 'next/link';
import { faId } from '@/components/admin/api';
import { OrdersChart } from '@/components/admin/OrdersChart';
import { db } from '@/lib/db';
import { STATUS_LABEL } from '@/lib/labels';
import { dashboardStats } from '@/lib/stats';

const n = (v: number) => v.toLocaleString('fa-IR', { maximumFractionDigits: 3 });

export default async function Dashboard() {
  const repo = db();
  const [orders, garments, settings] = await Promise.all([repo.listOrders(), repo.listGarments(), repo.getSettings()]);
  const s = dashboardStats(orders, garments);
  const recent = orders.slice(0, 6);
  const soldOutSizes = s.soldOut.reduce((a, x) => a + x.sizes.length, 0);

  return (
    <div className="stack">
      <div className="top"><h1>داشبورد</h1></div>

      <div className="kpis">
        <Link className="kpi" href="/admin/orders?status=new">
          <span className="k">سفارش‌های جدید (بررسی‌نشده)</span><span className="v">{n(s.newOrders)}</span>
          <span className="s">امروز {n(s.ordersToday)} سفارش ثبت شده</span>
        </Link>
        <Link className="kpi" href="/admin/orders?status=open">
          <span className="k">سفارش‌های باز</span><span className="v">{n(s.openOrders)}</span>
          <span className="s">جدید تا ارسال‌شده</span>
        </Link>
        <div className="kpi">
          <span className="k">فروش این ماه</span><span className="v">{n(s.revenueMonth)}</span>
          <span className="s">{settings.currency.fa} از {n(s.ordersMonth)} سفارش (بدون لغوشده‌ها)</span>
        </div>
        <Link className="kpi" href="/admin/garments">
          <span className="k">سایزهای تمام‌شده</span><span className="v">{n(soldOutSizes)}</span>
          <span className="s">در {n(s.soldOut.length)} لباس</span>
        </Link>
      </div>

      <div className="two">
        <section className="card">
          <h2>سفارش‌ها در ۱۴ روز گذشته</h2>
          <OrdersChart data={s.perDay} />
        </section>
        <section className="card">
          <h2>پرسفارش‌ترین لباس‌ها</h2>
          {s.topGarments.length ? (
            <div className="list">{s.topGarments.map(g => <div key={g.name}><span>{g.name}</span><span className="num">{n(g.count)} سفارش</span></div>)}</div>
          ) : <p className="muted">هنوز سفارشی ثبت نشده.</p>}
        </section>
      </div>

      <div className="two">
        <section className="card">
          <div className="row" style={{ marginBottom: 10 }}><h2 style={{ margin: 0 }}>آخرین سفارش‌ها</h2><span className="spacer" /><Link className="btn alt sm" href="/admin/orders">همه</Link></div>
          {recent.length ? (
            <div className="tbl-wrap"><table className="tbl"><tbody>
              {recent.map(o => (
                <tr key={o.id}>
                  <td className="num">#{faId(o.id)}</td><td>{o.customerName}</td><td className="hide-sm">{o.garmentName} · {o.size}</td>
                  <td><span className={`st st-${o.status}`}>{STATUS_LABEL[o.status]}</span></td>
                </tr>
              ))}
            </tbody></table></div>
          ) : <p className="muted">هنوز سفارشی ثبت نشده.</p>}
        </section>
        <section className="card">
          <h2>سایزهای تمام‌شده</h2>
          {s.soldOut.length ? (
            <div className="list">{s.soldOut.map(x => <div key={x.garment}><span>{x.garment}</span><span dir="ltr">{x.sizes.join(', ')}</span></div>)}</div>
          ) : <p className="muted">همهٔ سایزها موجود است.</p>}
        </section>
      </div>
    </div>
  );
}
