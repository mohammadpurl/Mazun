'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { shopChatLink } from '@/lib/order-message';
import { LANGS, type Lang } from '@/lib/types';
import { Art } from './Art';
import { useBoutique } from './Boutique';
import { LANG_LABEL } from './i18n';

/** Header: transparent over the home hero, solid once scrolled; collapses to menu + brand + bag below 1200px. */
export function Header() {
  const b = useBoutique();
  const { t, tx, settings } = b;
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => { setMenu(false); setSearch(false); }, [path]);
  useEffect(() => {
    if (!menu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [menu]);

  const clear = path === '/' && !scrolled && !search;
  const nav = [
    { href: '/#collections', label: t.nCol },
    { href: '/#rack', label: t.nRack },
    { href: '/fitting-room', label: t.nTry },
    { href: '/stylist', label: t.nSty },
    { href: '/#atelier', label: t.nAt },
  ];
  const brand = tx(settings.brand);
  const langs = (
    <div className="langs" role="group" aria-label={t.language}>
      {LANGS.map((l: Lang, i) => (
        <span key={l} style={{ display: 'contents' }}>
          {i > 0 && <span aria-hidden="true">/</span>}
          <button type="button" lang={l} aria-pressed={b.lang === l} onClick={() => b.setLang(l)}>{LANG_LABEL[l]}</button>
        </span>
      ))}
    </div>
  );

  return (
    <>
      <header className={`hdr${clear ? ' clear' : ''}`}>
        <div className="hdr-in">
          <div className="compact">
            <button type="button" className="ibtn" aria-label={t.menu} aria-expanded={menu} onClick={() => setMenu(true)} style={{ marginInlineStart: -10 }}>
              <i className="ph-duotone ph-list" />
            </button>
            <Link href="/" className="brand">{brand}</Link>
            <button type="button" className="ibtn" aria-label={t.bag} onClick={() => b.openSheet('bag')} style={{ marginInlineEnd: -10 }}>
              <i className="ph-duotone ph-handbag" />{b.bagCount || ''}
            </button>
          </div>
          <Link href="/" className="brand wide">{brand}</Link>
          <nav className="wide" aria-label={t.menu}>
            {nav.map(n => <Link key={n.href} href={n.href} aria-current={path === n.href ? 'page' : undefined}>{n.label}</Link>)}
          </nav>
          <div className="tools wide">
            <button type="button" className="ibtn" aria-label={t.search} aria-expanded={search} onClick={() => setSearch(s => !s)}><i className="ph-duotone ph-magnifying-glass" /></button>
            <button type="button" className="ibtn" aria-label={t.wish} onClick={() => b.openSheet('wish')}><i className="ph-duotone ph-heart" />{b.wish.length || ''}</button>
            <button type="button" className="ibtn" aria-label={t.bag} onClick={() => b.openSheet('bag')}><i className="ph-duotone ph-handbag" />{b.bagCount || ''}</button>
            {langs}
          </div>
        </div>
        {search && <Search onClose={() => setSearch(false)} />}
      </header>

      {menu && (
        <div className="menu" role="dialog" aria-modal="true" aria-label={t.menu}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 44 }}>
            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '.3em' }}>{brand}</span>
            <button type="button" className="ibtn" aria-label={t.close} onClick={() => setMenu(false)} style={{ marginInlineEnd: -10 }} autoFocus><i className="ph-duotone ph-x" /></button>
          </div>
          <nav aria-label={t.menu}>
            {nav.map(n => <Link key={n.href} href={n.href} onClick={() => setMenu(false)}>{n.label}</Link>)}
          </nav>
          <div className="foot">
            <button type="button" className="tlink" style={{ color: 'var(--ink)', fontWeight: 400, fontSize: 15 }} onClick={() => { setMenu(false); b.openSheet('wish'); }}>
              <i className="ph-duotone ph-heart" style={{ fontSize: 20 }} />{t.wish} {b.wish.length || ''}
            </button>
            <button type="button" className="tlink" style={{ color: 'var(--ink)', fontWeight: 400, fontSize: 15 }} onClick={() => { setMenu(false); setSearch(true); }}>
              <i className="ph-duotone ph-magnifying-glass" style={{ fontSize: 20 }} />{t.search}
            </button>
            <div style={{ marginInlineStart: 'auto' }}>{langs}</div>
          </div>
        </div>
      )}
    </>
  );
}

/** Search panel under the header: live results by name, type and collection; collection names as suggestions. */
function Search({ onClose }: { onClose: () => void }) {
  const b = useBoutique();
  const { t, tx } = b;
  const router = useRouter();
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    const cat = new Map(b.categories.map(c => [c.id, c]));
    return b.products.filter(p => {
      const hay = [p.name, p.type, p.categoryId ? cat.get(p.categoryId)?.name : null]
        .flatMap(v => (v ? [v.en, v.ar, v.fa] : [])).join(' ').toLowerCase();
      return hay.includes(s);
    }).slice(0, 12);
  }, [q, b.products, b.categories]);

  return (
    <div className="search">
      <div className="search-in">
        <div className="search-bar">
          <i className="ph-duotone ph-magnifying-glass" style={{ fontSize: 22 }} />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={t.searchPh} aria-label={t.search}
            onKeyDown={e => { if (e.key === 'Escape') onClose(); }} />
          <button type="button" className="ibtn" aria-label={t.close} onClick={onClose}><i className="ph-duotone ph-x" style={{ fontSize: 20 }} /></button>
        </div>
        {q.trim().length < 2 ? (
          <div className="search-sug">
            {b.categories.map(c => (
              <button key={c.id} type="button" className="tlink u" style={{ fontWeight: 400, fontSize: 15 }}
                onClick={() => { onClose(); router.push(`/?c=${encodeURIComponent(c.id)}#rack`); }}>{tx(c.name)}</button>
            ))}
          </div>
        ) : results.length ? (
          <div className="results">
            {results.map(p => (
              <button key={p.id} type="button" className="result" onClick={() => { onClose(); b.openProduct(p.id); }}>
                <span className="pic"><Art g={p} /></span>
                <span style={{ fontSize: 16 }}>{tx(p.name)}</span>
                <span className="muted" style={{ fontSize: 13 }}>{tx(p.type)}</span>
              </button>
            ))}
          </div>
        ) : <p className="note">{t.noResults}</p>}
      </div>
    </div>
  );
}

export function Footer() {
  const b = useBoutique();
  const { t, tx, settings } = b;
  const chat = shopChatLink(settings, '');
  return (
    <footer>
      <div>
        <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '.32em', color: 'var(--ink)' }}>{tx(settings.brand)}</span>
        <p style={{ margin: 0, maxWidth: '34ch' }}>{tx(settings.tagline)}</p>
      </div>
      <div>
        <span className="label">{t.fCare}</span>
        {chat ? <a href={chat} target="_blank" rel="noopener noreferrer">{t.fContact}</a> : <span>{t.fContact}</span>}
        <span>{t.fDelivery}</span><span>{t.fReturns}</span>
      </div>
      <div>
        <span className="label">{t.fHouse}</span>
        <Link href="/#atelier">{t.fStory}</Link>
        {chat ? <a href={shopChatLink(settings, t.apptMsg)!} target="_blank" rel="noopener noreferrer">{t.fAppt}</a> : <span>{t.fAppt}</span>}
        <span>{t.fJournal}</span>
      </div>
      <div>
        <span className="label">{t.language}</span>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {LANGS.map(l => (
            <button key={l} type="button" className="f" lang={l} onClick={() => b.setLang(l)} style={{ opacity: b.lang === l ? 1 : .55 }}>
              {{ en: 'English', ar: 'العربية', fa: 'فارسی' }[l]}
            </button>
          ))}
        </div>
      </div>
      <div className="rights">{t.rights(new Date().getFullYear(), tx(settings.brand))}</div>
    </footer>
  );
}
