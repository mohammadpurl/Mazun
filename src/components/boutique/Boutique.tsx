'use client';
/* Shared shop state: language, catalogue, bag and wishlist (kept in this browser), and which drawer is open.
   Every boutique screen reads it through useBoutique(). */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { effectivePrice } from '@/lib/fit';
import { formatPrice } from '@/lib/order-message';
import { LANGS, type Category, type Garment, type L10n, type Lang, type Settings } from '@/lib/types';
import { STRINGS, type Strings } from './i18n';

export interface BagLine { id: string; c: number; s: string; q: number }
export interface AiFlags { text: boolean; image: boolean }
type Sheet = 'bag' | 'wish' | null;
interface SizeRequest { garmentId: string; onUse: (size: string) => void }

interface Ctx {
  lang: Lang;
  t: Strings;
  dir: 'ltr' | 'rtl';
  setLang: (l: Lang) => void;
  /** Text of a translated field in the current language, falling back to any other. */
  tx: (v: L10n) => string;
  price: (n: number) => string;
  settings: Settings;
  categories: Category[];
  /** Everything on sale: garments and accessories. */
  products: Garment[];
  garments: Garment[];
  byId: (id: string | null | undefined) => Garment | undefined;
  ai: AiFlags;
  bag: BagLine[];
  addToBag: (id: string, c: number, s: string, q?: number) => void;
  setQty: (i: number, q: number) => void;
  removeLine: (i: number) => void;
  removeProduct: (id: string) => void;
  clearBag: () => void;
  bagCount: number;
  wish: string[];
  toggleWish: (id: string) => void;
  sheet: Sheet;
  openSheet: (s: Sheet) => void;
  productId: string | null;
  openProduct: (id: string | null) => void;
  sizeReq: SizeRequest | null;
  openSize: (req: SizeRequest | null) => void;
  toast: (msg: string) => void;
  toastMsg: string;
}

const BoutiqueCtx = createContext<Ctx | null>(null);
export const useBoutique = () => {
  const c = useContext(BoutiqueCtx);
  if (!c) throw new Error('useBoutique outside <BoutiqueProvider>');
  return c;
};

/** localStorage that never throws (private mode, blocked storage) and ignores malformed data. */
function load<T>(key: string, fallback: T, ok: (v: unknown) => boolean): T {
  try { const v = JSON.parse(localStorage.getItem(key) ?? 'null'); return ok(v) ? (v as T) : fallback; } catch { return fallback; }
}
function save(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage blocked */ } }

const isBag = (v: unknown) => Array.isArray(v) && v.every(x => x && typeof x.id === 'string' && typeof x.s === 'string' && Number.isInteger(x.q) && Number.isInteger(x.c));

export function BoutiqueProvider({ initialLang, settings, categories, products, ai, children }: {
  initialLang: Lang; settings: Settings; categories: Category[]; products: Garment[]; ai: AiFlags; children: ReactNode;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [bag, setBag] = useState<BagLine[]>([]);
  const [wish, setWish] = useState<string[]>([]);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [sizeReq, setSizeReq] = useState<SizeRequest | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const loaded = useRef(false);

  const map = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const byId = useCallback((id: string | null | undefined) => (id ? map.get(id) : undefined), [map]);
  const garments = useMemo(() => products.filter(p => p.kind === 'garment'), [products]);

  // Restore bag and wishlist, dropping pieces that are no longer on sale.
  useEffect(() => {
    setBag(load<BagLine[]>('mazun_bag', [], isBag).filter(l => map.has(l.id)));
    setWish(load<string[]>('mazun_wish', [], v => Array.isArray(v) && v.every(x => typeof x === 'string')).filter(id => map.has(id)));
    const p = new URLSearchParams(location.search).get('p');
    if (p && map.has(p)) setProductId(p);
    loaded.current = true;
  }, [map]);
  useEffect(() => { if (loaded.current) save('mazun_bag', bag); }, [bag]);
  useEffect(() => { if (loaded.current) save('mazun_wish', wish); }, [wish]);

  const dir = lang === 'en' ? 'ltr' : 'rtl';
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const setLang = useCallback((l: Lang) => {
    if (!(LANGS as readonly string[]).includes(l)) return;
    setLangState(l);
    document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const toast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2600);
  }, []);

  // Keep ?p=<id> in the address bar so a product can be shared; no navigation, no scroll jump.
  const openProduct = useCallback((id: string | null) => {
    setProductId(id);
    try {
      const u = new URL(location.href);
      if (id) u.searchParams.set('p', id); else u.searchParams.delete('p');
      history.replaceState(history.state, '', u);
    } catch { /* ignore */ }
  }, []);

  const value: Ctx = {
    lang, t: STRINGS[lang], dir, setLang,
    tx: v => v[lang] || v.en || v.ar || v.fa,
    price: n => formatPrice(n, lang, settings),
    settings, categories, products, garments, byId, ai,
    bag,
    addToBag: (id, c, s, q = 1) => setBag(b => {
      const i = b.findIndex(x => x.id === id && x.c === c && x.s === s);
      if (i >= 0) return b.map((x, j) => (j === i ? { ...x, q: Math.min(10, x.q + q) } : x));
      return [...b, { id, c, s, q }].slice(-20);
    }),
    setQty: (i, q) => setBag(b => b.map((x, j) => (j === i ? { ...x, q: Math.max(1, Math.min(10, q)) } : x))),
    removeLine: i => setBag(b => b.filter((_, j) => j !== i)),
    removeProduct: id => setBag(b => b.filter(x => x.id !== id)),
    clearBag: () => setBag([]),
    bagCount: bag.reduce((a, l) => a + l.q, 0),
    wish,
    toggleWish: id => setWish(w => (w.includes(id) ? w.filter(x => x !== id) : [...w, id])),
    sheet, openSheet: setSheet, productId, openProduct, sizeReq, openSize: setSizeReq,
    toast, toastMsg,
  };
  return <BoutiqueCtx.Provider value={value}>{children}</BoutiqueCtx.Provider>;
}

/** Bag subtotal at current prices. */
export const bagTotal = (bag: BagLine[], byId: Ctx['byId']) =>
  bag.reduce((a, l) => { const g = byId(l.id); return a + (g ? effectivePrice(g) * l.q : 0); }, 0);

/** Drawer shell: slides in from the inline end (bottom on phones), traps Escape, locks page scroll,
 *  returns focus to where it was. Stays mounted for the slide-out, then unmounts. */
export function Sheet({ open, onClose, label, width, z = 60, children }: {
  open: boolean; onClose: () => void; label: string; width?: number; z?: number; children: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [inView, setIn] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const back = useRef<Element | null>(null);

  useEffect(() => {
    if (open) {
      back.current = document.activeElement;
      setMounted(true);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setIn(true)));
      return () => cancelAnimationFrame(r);
    }
    setIn(false);
    const tm = setTimeout(() => setMounted(false), 480);
    (back.current as HTMLElement | null)?.focus?.({ preventScroll: true });
    return () => clearTimeout(tm);
  }, [open]);

  useEffect(() => {
    if (!mounted || !open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    panel.current?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [mounted, open, onClose]);

  if (!mounted) return null;
  return (
    <div className={`sheet-wrap${inView ? ' in' : ''}`} style={{ zIndex: z }}>
      <div className="sheet-scrim" onClick={onClose} />
      <div ref={panel} className="sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
        style={width ? ({ '--sheet-w': `${width}px` } as React.CSSProperties) : undefined}>
        {children}
      </div>
    </div>
  );
}

export function Toast() {
  const { toastMsg } = useBoutique();
  return <div className={`toast${toastMsg ? ' show' : ''}`} role="status" aria-live="polite">{toastMsg}</div>;
}
