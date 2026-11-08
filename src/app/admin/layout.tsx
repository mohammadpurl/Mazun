import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './admin.css';

export const metadata: Metadata = { title: { default: 'پنل مدیریت مزون', template: '%s · پنل مزون' }, robots: { index: false, follow: false } };

/* Sets the saved theme and sidebar state on <html> before the panel paints, so neither flashes. */
const BOOT = `try{var d=document.documentElement,t=localStorage.getItem('adm-theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';d.dataset.admTheme=t;if(localStorage.getItem('adm-collapsed')==='1')d.dataset.admCollapsed='1'}catch(e){}`;

export default function AdminRoot({ children }: { children: ReactNode }) {
  return (
    <div className="adm" lang="fa" dir="rtl">
      <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      {children}
    </div>
  );
}
