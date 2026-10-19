import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './admin.css';

export const metadata: Metadata = { title: 'پنل مدیریت', robots: { index: false, follow: false } };

export default function AdminRoot({ children }: { children: ReactNode }) {
  return <div className="adm" lang="fa" dir="rtl">{children}</div>;
}
