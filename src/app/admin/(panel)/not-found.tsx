import Link from 'next/link';
import { AIcon } from '@/components/admin/ui/Icon';

export default function AdminNotFound() {
  return (
    <div className="card">
      <div className="empty">
        <span className="art"><AIcon name="search" duo /></span>
        <b>این صفحه پیدا نشد</b>
        <span>نشانی اشتباه است یا این مورد دیگر وجود ندارد.</span>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link href="/admin" className="btn"><AIcon name="dashboard" />بازگشت به داشبورد</Link>
          <Link href="/admin/orders" className="btn outline">سفارش‌ها</Link>
        </div>
      </div>
    </div>
  );
}
