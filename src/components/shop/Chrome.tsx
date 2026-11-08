'use client';
/* eslint-disable @next/next/no-img-element -- transparent garment cut-outs from the catalogue */
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { shopChatLink } from '@/lib/order-message';
import { LANGS, type Lang } from '@/lib/types';
import { useBoutique } from '../boutique/Boutique';
import { Ornament } from './fx';
import { trapTab } from './focus';
import { Icon } from './Icon';
import { useShop } from './Shop';
import { EASE, SPRING, THEME_KEYS, THEMES, num } from './tokens';

const LANG_LABEL: Record<Lang, string> = { en: 'EN', ar: 'عربي', fa: 'فارسی' };

export const productHref = (id: string) => `/abaya/${encodeURIComponent(id)}`;

function LangSwitch({ compact }: { compact?: boolean }) {
  const b = useBoutique();
  const { c } = useShop();
  return (
    <div role="group" aria-label={c.langLabel} className={`mz-langs${compact ? ' is-compact' : ''}`}>
      {LANGS.map(l => (
        <button key={l} type="button" className="mz-reset" lang={l} aria-pressed={b.lang === l} onClick={() => b.setLang(l)}>{LANG_LABEL[l]}</button>
      ))}
    </div>
  );
}

function ThemeSwitch({ compact }: { compact?: boolean }) {
  const b = useBoutique();
  const { c, theme, setTheme } = useShop();
  return (
    <div role="group" aria-label={c.themeLabel} className={`mz-themes${compact ? ' is-compact' : ''}`}>
      {THEME_KEYS.map(k => (
        <button key={k} type="button" className="mz-reset" aria-pressed={theme === k} aria-label={THEMES[k].label[b.lang]} title={THEMES[k].label[b.lang]} onClick={() => setTheme(k)}>
          <span className="mz-swatch" style={{ background: `linear-gradient(135deg, ${THEMES[k].swatch[0]} 50%, ${THEMES[k].swatch[1]} 50%)` }} />
        </button>
      ))}
    </div>
  );
}

/** A small dialog for a note: the size guide and the delivery policy until the atelier supplies them. */
export function InfoDialog({ open, onClose, title, body }: { open: boolean; onClose: () => void; title: string; body: string }) {
  const { c } = useShop();
  const close = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  // Callers pass a new onClose each render; reading it from a ref keeps the effect tied to opening and closing only.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return; // already handled by something inside, such as a date picker
      if (e.key === 'Escape') onCloseRef.current();
      trapTab(e, box.current);
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); back?.focus?.(); };
  }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="mz-dialog" role="dialog" aria-modal="true" aria-label={title} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} onClick={onClose}>
          <motion.div ref={box} tabIndex={-1} className="mz-dialog__box" onClick={e => e.stopPropagation()} initial={{ y: 24, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 12 }} transition={SPRING.soft}>
            <div className="mz-dialog__head"><h2>{title}</h2><button ref={close} type="button" className="mz-reset mz-icon-btn" aria-label={c.close} onClick={onClose}><Icon name="close" /></button></div>
            <p>{body}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Wordmark({ small }: { small?: boolean }) {
  return (
    <Link href="/" aria-label="Mazun Atelier" dir="ltr" className={`mz-wordmark${small ? ' is-small' : ''}`}>
      <span>MAZUN</span>
      <span>ATELIER</span>
    </Link>
  );
}

/** Header: the full bar from 1100px; below it, the coloured top bar (language and theme) and a compact header. */
export function Header() {
  const b = useBoutique();
  const { c } = useShop();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  useEffect(() => { setMenu(false); setSearch(false); }, [path]);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const on = () => setStuck(window.scrollY > 12);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  const home = path === '/' ? '' : '/';
  const nav = [
    { href: `${home}#collection`, label: c.navNew },
    { href: `${home}#collection`, label: c.navAbayas },
    { href: `${home}#rack`, label: c.navRack },
  ];
  const bag = (
    <button type="button" className="mz-reset mz-icon-btn mz-bag" aria-label={`${c.bag} ${num(b.bagCount, b.lang)}`} onClick={() => b.openSheet('bag')}>
      <Icon name="bag" />{b.bagCount > 0 && <span className="mz-bag__n">{num(b.bagCount, b.lang)}</span>}
    </button>
  );
  // The menu sheet: Escape closes it, the page behind does not scroll, and focus returns to the menu button, unless
  // the menu closed to open search, whose field takes the focus.
  const menuBtn = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(true);
  const menuBox = useRef<HTMLDivElement>(null);
  const searchBtn = useRef<HTMLButtonElement>(null);
  // Closing search hands focus back to whichever search button is on screen.
  const closeSearch = () => {
    setSearch(false);
    (searchBtn.current?.offsetParent ? searchBtn.current : menuBtn.current)?.focus();
  };
  useEffect(() => {
    if (!menu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (e: KeyboardEvent) => { if (e.defaultPrevented) return; if (e.key === 'Escape') setMenu(false); trapTab(e, menuBox.current); };
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', key); if (restoreFocus.current) menuBtn.current?.focus(); restoreFocus.current = true; };
  }, [menu]);

  return (
    <>
      <div className="mz-topbar">
        <LangSwitch compact />
        <ThemeSwitch compact />
      </div>
      <header className={`mz-header${stuck ? ' is-stuck' : ''}`}>
        <button ref={menuBtn} type="button" className="mz-reset mz-icon-btn mz-only-compact" aria-label={c.menu} aria-expanded={menu} onClick={() => setMenu(true)}><Icon name="menu" /></button>
        <nav aria-label={c.menu} className="mz-nav mz-only-wide">
          {nav.map(n => <Link key={n.label} href={n.href} className="mz-link">{n.label}</Link>)}
          <Link href="/fitting-room" className="mz-link mz-nav__try"><Icon name="hanger" size={18} />{c.navTry}</Link>
        </nav>
        <Wordmark />
        <div className="mz-tools">
          <div className="mz-only-wide mz-tools__set">
            <LangSwitch />
            <span className="mz-sep" aria-hidden="true" />
            <ThemeSwitch />
            <span className="mz-sep" aria-hidden="true" />
            <button ref={searchBtn} type="button" className="mz-reset mz-icon-btn" aria-label={c.search} aria-expanded={search} onClick={() => (search ? closeSearch() : setSearch(true))}><Icon name="search" /></button>
          </div>
          {bag}
        </div>
      </header>
      <AnimatePresence>{search && <SearchPanel onClose={closeSearch} />}</AnimatePresence>
      <AnimatePresence>
        {menu && (
          <motion.div ref={menuBox} className="mz-menu" role="dialog" aria-modal="true" aria-label={c.menu}
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.4, ease: EASE }}>
            <div className="mz-menu__head">
              <Wordmark small />
              <button type="button" className="mz-reset mz-icon-btn" aria-label={c.close} autoFocus onClick={() => setMenu(false)}><Icon name="close" /></button>
            </div>
            <nav aria-label={c.menu} className="mz-menu__nav">
              {[...nav, { href: '/fitting-room', label: c.navTry }].map((n, i) => (
                <motion.div key={n.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay: 0.05 * i }}>
                  <Link href={n.href} onClick={() => setMenu(false)}>{n.label}</Link>
                </motion.div>
              ))}
            </nav>
            <div className="mz-menu__prefs"><LangSwitch /><ThemeSwitch /></div>
            <button type="button" className="mz-reset mz-menu__search" onClick={() => { restoreFocus.current = false; setMenu(false); setSearch(true); }}><Icon name="search" />{c.search}</button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Search: live results by name and colour in the current language. */
function SearchPanel({ onClose }: { onClose: () => void }) {
  const b = useBoutique();
  const { c } = useShop();
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return b.garments.filter(g => [g.name, g.type, g.colors[0]?.name].flatMap(v => (v ? [v.en, v.ar, v.fa] : [])).join(' ').toLowerCase().includes(s)).slice(0, 8);
  }, [q, b.garments]);
  return (
    <motion.div className="mz-search" onKeyDown={e => { if (e.key === 'Escape') onClose(); }} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: EASE }}>
      <div className="mz-search__bar">
        <Icon name="search" />
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} aria-label={c.search} placeholder={c.search} />
        <button type="button" className="mz-reset mz-icon-btn" aria-label={c.close} onClick={onClose}><Icon name="close" /></button>
      </div>
      {q.trim().length >= 2 && results.length === 0 && <p className="mz-search__empty">{c.noResults}</p>}
      {results.length > 0 && (
        <div className="mz-search__results">
          {results.map(g => (
            <Link key={g.id} href={productHref(g.id)} onClick={onClose} className="mz-search__item">
              <span className="mz-search__pic">{g.front && <img src={g.front} alt="" />}</span>
              <span>{b.tx(g.name)}</span>
            </Link>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export function Footer() {
  const b = useBoutique();
  const { c } = useShop();
  const path = usePathname();
  const home = path === '/' ? '' : '/';
  const chat = shopChatLink(b.settings, '');
  const insta = b.settings.instagram ? `https://instagram.com/${b.settings.instagram.replace(/^@/, '')}` : null;
  const [note, setNote] = useState<'size' | 'delivery' | null>(null);
  return (
    <footer className="mz-footer">
      <div className="mz-footer__in">
        <Ornament className="is-footer" />
        <div className="mz-footer__grid">
          <div className="mz-footer__brand">
            <span dir="ltr">MAZUN</span>
            <span>{c.tagline}</span>
          </div>
          <nav aria-label={c.footShop}>
            <span className="mz-footer__head">{c.footShop}</span>
            <Link href={`${home}#collection`} className="mz-link">{c.navAbayas}</Link>
            <Link href={`${home}#rack`} className="mz-link">{c.navRack}</Link>
            <Link href="/fitting-room" className="mz-link">{c.navTry}</Link>
          </nav>
          <nav aria-label={c.footHelp}>
            <span className="mz-footer__head">{c.footHelp}</span>
            <button type="button" className="mz-reset mz-link" onClick={() => setNote('size')}>{c.sizeGuide}</button>
            <button type="button" className="mz-reset mz-link" onClick={() => setNote('delivery')}>{c.delivery}</button>
            {chat && <a href={chat} target="_blank" rel="noopener noreferrer" className="mz-link">{c.contact}</a>}
          </nav>
          {insta && (
            <nav aria-label={c.footFollow}>
              <span className="mz-footer__head">{c.footFollow}</span>
              <a href={insta} target="_blank" rel="noopener noreferrer" className="mz-link">{c.instagram}</a>
            </nav>
          )}
        </div>
        <div className="mz-footer__legal">{c.copy}</div>
      </div>
      <InfoDialog open={!!note} onClose={() => setNote(null)} title={note === 'delivery' ? c.delivery : c.sizeGuide} body={note === 'delivery' ? c.deliveryBody : c.sizeGuideBody} />
    </footer>
  );
}
