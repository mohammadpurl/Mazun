import Link from 'next/link';

export default function AdminNotFound() {
  return (
    <div className="stack">
      <div className="top"><h1>این صفحه پیدا نشد</h1></div>
      <div className="card stack">
        <p className="muted" style={{ margin: 0 }}>نشانی اشتباه است یا این صفحه دیگر وجود ندارد.</p>
        <div><Link href="/admin" className="btn">بازگشت به داشبورد</Link></div>
      </div>
    </div>
  );
}
