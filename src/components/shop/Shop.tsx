'use client';
/* eslint-disable @next/next/no-img-element -- transparent garment PNGs need object-fit and 3D flips, not next/image */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { effectivePrice } from '@/lib/fit';
import { formatNumber, formatPrice, orderMessage, shopChatLink } from '@/lib/order-message';
import { LANGS, type Category, type Garment, type Lang, type Settings } from '@/lib/types';
import { STRINGS } from './i18n';
import { OrderForm } from './OrderForm';
import { Tools, type AiFlags } from './Tools';

interface Props { settings: Settings; categories: Category[]; garments: Garment[]; ai: AiFlags }

const Hanger = () => (
  <svg className="hanger" viewBox="0 0 12 24" aria-hidden="true">
    <path d="M5 24 V9 C5 3 10 1 10.5 5.5 C10.8 8.5 8 9 7 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Chevron = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

export function Shop({ settings, categories, garments, ai }: Props) {
  const [lang, setLang] = useState<Lang>('fa');
  const [cat, setCat] = useState<string | null>(null);
  const [cur, setCur] = useState(-1);
  const [hover, setHover] = useState(-1);
  const [toast, setToast] = useState('');
  const t = STRINGS[lang];
  const dir = lang === 'en' ? 'ltr' : 'rtl';

  const items = useMemo(() => (cat ? garments.filter(g => g.categoryId === cat) : garments), [garments, cat]);
  const it = cur >= 0 ? items[cur] : null;

  useEffect(() => {
    let l: string | null = null;
    try { l = localStorage.getItem('lang'); } catch { /* storage blocked */ }
    if (!l || !(LANGS as readonly string[]).includes(l)) l = (navigator.language || 'fa').slice(0, 2);
    if ((LANGS as readonly string[]).includes(l)) setLang(l as Lang);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    document.title = settings.brand[lang] || settings.brand.en;
    try { localStorage.setItem('lang', lang); } catch { /* storage blocked */ }
  }, [lang, dir, settings.brand]);

  const close = useCallback(() => setCur(-1), []);
  const go = useCallback((d: number) => setCur(c => (c < 0 ? c : (c + d + items.length) % items.length)), [items.length]);

  useEffect(() => {
    document.body.style.overflow = cur >= 0 ? 'hidden' : '';
    if (cur < 0) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') go(dir === 'rtl' ? -1 : 1);
      else if (e.key === 'ArrowLeft') go(dir === 'rtl' ? 1 : -1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [cur, close, go, dir]);

  const showToast = (s: string) => { setToast(s); setTimeout(() => setToast(''), 2600); };
  const price = (g: Garment) => formatPrice(effectivePrice(g), lang, settings);
  const onSale = (g: Garment) => effectivePrice(g) < g.price;

  return (
    <div className="shop" lang={lang} dir={dir}>
      <header>
        <div className="brand">{settings.brand[lang]}<small>{settings.tagline[lang]}</small></div>
        <div className="langs" role="group" aria-label="Language">
          {(['fa', 'ar', 'en'] as const).map(l => (
            <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{{ fa: 'فارسی', ar: 'العربية', en: 'English' }[l]}</button>
          ))}
        </div>
      </header>
      <p className="hint">{t.hint}</p>
      {categories.length > 1 && (
        <nav className="cats" aria-label={t.all}>
          <button type="button" aria-pressed={cat === null} onClick={() => { setCat(null); setCur(-1); }}>{t.all}</button>
          {categories.map(c => (
            <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => { setCat(c.id); setCur(-1); }}>{c.name[lang] || c.name.en}</button>
          ))}
        </nav>
      )}

      <main>
        {items.length === 0 ? <p className="empty">{t.empty}</p> : (
          <div className="rail-scroll">
            <div className="rail" key={cat ?? 'all'}>
              <div className="bar" />
              {items.map((g, i) => {
                const name = g.name[lang] || g.name.en || g.name.fa;
                const d = i - hover;
                const push = 70;
                const shift = hover < 0 || d === 0 ? 0 : (Math.sign(d) * (dir === 'rtl' ? -1 : 1) * push) / Math.abs(d);
                return (
                  <button
                    key={g.id} type="button" className="item" aria-label={name}
                    style={{ ['--i' as string]: i, translate: `${shift}px 0` }}
                    onClick={() => setCur(i)}
                    onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)}
                    onMouseLeave={() => setHover(-1)} onBlur={() => setHover(-1)}
                  >
                    <Hanger />
                    {onSale(g) && <span className="tag">{t.sale}</span>}
                    <span className="card">
                      <img className="f" loading="lazy" src={g.front} alt="" />
                      <img className="k" loading="lazy" src={g.back} alt="" />
                    </span>
                    <span className="label"><b>{name}</b><span>{price(g)}</span></span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <div className={`viewer${it ? ' open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!it} aria-label={it ? it.name[lang] : undefined}
        onClick={e => { if (e.target === e.currentTarget) close(); }}>
        {it && <Viewer key={it.id} g={it} index={cur} total={items.length} lang={lang} settings={settings} ai={ai}
          onClose={close} onGo={go} onToast={showToast} />}
      </div>

      <div className="ticker" aria-hidden="true"><div>{Array(6).fill(settings.ticker[lang]).join('   •   ')}</div></div>
      <div className={`toast${toast ? ' show' : ''}`} role="status">{toast}</div>
    </div>
  );
}

function Viewer({ g, index, total, lang, settings, ai, onClose, onGo, onToast }: {
  g: Garment; index: number; total: number; lang: Lang; settings: Settings; ai: AiFlags;
  onClose: () => void; onGo: (d: number) => void; onToast: (s: string) => void;
}) {
  const t = STRINGS[lang];
  const [back, setBack] = useState(false);
  const [size, setSize] = useState<string | null>(null);
  const [stage, setStage] = useState<'pick' | 'form' | 'done'>('pick');
  const [placed, setPlaced] = useState<{ id: number; garmentName: string; price: number; customerName: string } | null>(null);
  const [err, setErr] = useState('');
  const [shake, setShake] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const name = g.name[lang] || g.name.en || g.name.fa;
  const desc = g.description[lang];
  const soldOut = !g.sizes.some(s => s.ok);
  const price = effectivePrice(g);

  useEffect(() => { closeRef.current?.focus({ preventScroll: true }); }, []);

  function startOrder() {
    if (!size) { setErr(t.pick); setShake(false); requestAnimationFrame(() => setShake(true)); return; }
    setErr(''); setStage('form');
  }

  const message = placed ? orderMessage({ ...placed, size: size ?? '' }, lang, settings) : '';
  const link = placed ? shopChatLink(settings, message) : null;

  return (
    <>
      <button ref={closeRef} type="button" className="close" aria-label={t.close} onClick={onClose}>✕</button>
      <div className="panel"
        onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          if (touchX.current === null || stage !== 'pick') return;
          const dx = e.changedTouches[0].clientX - touchX.current; touchX.current = null;
          if (Math.abs(dx) > 60) onGo(dx < 0 ? 1 : -1);
        }}>
        <div className="stage">
          <button type="button" className="nav" aria-label={t.prev} onClick={() => onGo(-1)}><Chevron d="M15 5l-7 7 7 7" /></button>
          <div className="flip3d">
            <div className={`flipper${back ? ' back' : ''}`} onClick={() => setBack(b => !b)}>
              <img src={g.front} alt={name} />
              <img className="b" src={g.back} alt={name} />
            </div>
          </div>
          <button type="button" className="nav" aria-label={t.next} onClick={() => onGo(1)}><Chevron d="M9 5l7 7-7 7" /></button>
        </div>

        <div className="info">
          <div className="count">{formatNumber(index + 1, lang)} {t.of} {formatNumber(total, lang)}</div>
          <h2>{name}</h2>
          <div className="price">
            {formatPrice(price, lang, settings)}
            {price < g.price && <span className="was">{formatPrice(g.price, lang, settings)}</span>}
          </div>
          {desc && <p className="desc">{desc}</p>}
          <button type="button" className="flipbtn" onClick={() => setBack(b => !b)}>↺ {t.flip}</button>

          {stage !== 'done' && (
            <div>
              <div className="sub">{t.sizes}</div>
              <div className={`sizes${shake ? ' shake' : ''}`} onAnimationEnd={() => setShake(false)}>
                {g.sizes.map(s => (
                  <button key={s.n} type="button" className="size" disabled={!s.ok || stage === 'form'} aria-pressed={size === s.n}
                    onClick={() => { setSize(s.n); setErr(''); }}>{s.n}</button>
                ))}
              </div>
            </div>
          )}
          <div className="msg" role="alert">{soldOut ? t.soldout : err}</div>

          {stage === 'pick' && <button type="button" className="primary" disabled={soldOut} onClick={startOrder}>{t.order}</button>}
          {stage === 'form' && size && (
            <OrderForm garmentId={g.id} size={size} lang={lang}
              onCancel={() => setStage('pick')}
              onSoldOut={() => { setStage('pick'); setSize(null); setErr(t.eSold); }}
              onPlaced={o => { setPlaced(o); setStage('done'); }} />
          )}
          {stage === 'done' && placed && (
            <div className="done" role="status">
              <b>{t.doneTitle(formatNumber(placed.id, lang))}</b>
              <span>{link ? t.doneText : t.noChannel}</span>
              {link && settings.channel !== 'instagram' && (
                <a className="primary wa" href={link} target="_blank" rel="noopener noreferrer">{settings.channel === 'telegram' ? t.sendTg : t.sendWa}</a>
              )}
              {link && settings.channel === 'instagram' && (
                <button type="button" className="primary" onClick={() => {
                  navigator.clipboard?.writeText(message).then(() => onToast(t.copied), () => undefined);
                  window.open(link, '_blank', 'noopener');
                }}>{t.sendIg}</button>
              )}
              <button type="button" className="ghost" onClick={() => { setStage('pick'); setSize(null); setPlaced(null); }}>{t.newOrder}</button>
            </div>
          )}

          {stage === 'pick' && <Tools garment={g} lang={lang} settings={settings} aiOn={ai} />}
        </div>
      </div>
    </>
  );
}
