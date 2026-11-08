'use client';
/* The bell: things that need the boutique's attention, worked out on the server for each page load: new orders,
   orders waiting too long, money owed on delivered orders, and sizes that have sold out. */
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { faAgo, faNum } from '../ui/format';
import { AIcon, type AIconName } from '../ui/Icon';

export interface Notice { id: string; icon: AIconName; tone: 'primary' | 'warn' | 'danger' | 'info'; title: string; body: string; href: string; at?: string }
const TONE: Record<Notice['tone'], string> = { primary: 'soft', warn: 'gold', danger: 'soft', info: 'blue' };

export function Notifications({ notices }: { notices: Notice[] }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!pop.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  const n = notices.length;
  return (
    <div className="dd" style={{ display: 'inline-block' }} onKeyDown={e => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); btn.current?.focus(); } }}>
      <button ref={btn} type="button" className="icon-btn bell" aria-label={n ? `اعلان‌ها، ${faNum(n)} مورد` : 'اعلان‌ها'} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(o => !o)}>
        <AIcon name="bell" duo />
        {n > 0 && <motion.span className="pip num" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 20, delay: 0.4 }}>{faNum(n)}</motion.span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div ref={pop} className="pop end notif" role="dialog" aria-label="اعلان‌ها"
            initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: 0.18 }}>
            <div className="notif-head"><b>اعلان‌ها</b><span className="xs muted">{n ? `${faNum(n)} مورد نیاز به توجه` : 'همه چیز مرتب است'}</span></div>
            <div className="notif-list">
              {notices.map((x, i) => (
                <motion.div key={x.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                  <Link href={x.href} className="notif-item" onClick={() => setOpen(false)}>
                    <span className={`tile sm ${TONE[x.tone]}`}><AIcon name={x.icon} duo /></span>
                    <span className="grow"><b>{x.title}</b><span>{x.body}{x.at ? ` · ${faAgo(x.at)}` : ''}</span></span>
                  </Link>
                </motion.div>
              ))}
              {!n && <div className="empty sm"><span className="art"><AIcon name="done" duo /></span><b>اعلان تازه‌ای نیست</b></div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
