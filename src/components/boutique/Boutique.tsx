'use client';
/* Shared shop state: language, catalogue, bag and wishlist (kept in this browser), and which drawer is open.
   Every boutique screen reads it through useBoutique(). */
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { effectivePrice } from '@/lib/fit';
import { formatPrice } from '@/lib/order-message';
import { LANGS, type Category, type Garment, type L10n, type Lang, type Settings } from '@/lib/types';
import { lockScroll, trapTab } from '../shop/focus';
import { STRINGS, type Strings } from './i18n';

export interface BagLine { id: string; c: number; s: string; q: number }
export interface AiFlags { text: boolean; image: boolean; /** Who the live AI try-on sends the camera to: Decart, fal.ai, or Decart with fal.ai as its fallback; null when off. */ live: 'decart' | 'fal' | 'both' | null; /** The free public try-on model (Hugging Face) is allowed. */ free: boolean }
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
  /** `list` is what the viewer steps through (the filtered rack); `size` preselects a recommended size. */
  openProduct: (id: string | null, opts?: { list?: string[]; size?: string; leaving?: boolean }) => void;
  viewList: string[] | null;
  initialSize: string | null;
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
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [bag, setBag] = useState<BagLine[]>([]);
  const [wish, setWish] = useState<string[]>([]);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [viewList, setViewList] = useState<string[] | null>(null);
  const [initialSize, setInitialSize] = useState<string | null>(null);
  const pushed = useRef(false);
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
    if (p && map.get(p)?.kind === 'garment') router.replace(`/abaya/${encodeURIComponent(p)}`);
    else if (p && map.has(p)) setProductId(p);
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
    router.refresh(); // the server renders the tab title and metadata in the new language
  }, [router]);

  const toast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2600);
  }, []);

  // Keep ?p=<id> in the address bar so a product can be shared; the first open adds a history entry so the
  // phone's Back closes the viewer and returns to the rack. Stepping between pieces replaces it.
  const openProduct = useCallback((id: string | null, opts?: { list?: string[]; size?: string; leaving?: boolean }) => {
    // Garments have their own page; the drawer stays for accessories.
    if (id && map.get(id)?.kind === 'garment') {
      setInitialSize(opts?.size ?? null);
      setSheet(null);
      router.push(`/abaya/${encodeURIComponent(id)}`);
      return;
    }
    setInitialSize(opts?.size ?? null);
    setViewList(opts?.list ?? null);
    setProductId(id);
    try {
      if (!id && opts?.leaving) { pushed.current = false; return; } // a page change follows; going back here would cancel it
      if (!id && pushed.current) { pushed.current = false; history.back(); return; }
      const u = new URL(location.href);
      if (id) u.searchParams.set('p', id); else u.searchParams.delete('p');
      if (id && !pushed.current && !new URLSearchParams(location.search).get('p')) { pushed.current = true; history.pushState(history.state, '', u); }
      else history.replaceState(history.state, '', u);
    } catch { /* ignore */ }
  }, [map, router]); // the catalogue can change under it: a language switch refreshes it from the server
  useEffect(() => {
    const on = () => { pushed.current = false; setProductId(new URLSearchParams(location.search).get('p')); };
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
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
    sheet, openSheet: setSheet, productId, openProduct, viewList, initialSize, sizeReq, openSize: setSizeReq,
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
  // Callers pass a new onClose each render; reading it from a ref means a re-render (a toast, a bag change) does not
  // re-run the effect below and pull focus back to the sheet.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

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
    const unlock = lockScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return; // already handled inside, e.g. Escape closing the checkout's date picker
      const at = document.activeElement;
      if (at && at !== document.body && !panel.current?.contains(at)) return; // focus is in another layer
      if (e.key === 'Escape') onCloseRef.current();
      trapTab(e, panel.current);
    };
    document.addEventListener('keydown', onKey);
    panel.current?.focus({ preventScroll: true });
    return () => { unlock(); document.removeEventListener('keydown', onKey); };
  }, [mounted, open]);

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
  // The last message stays in the box while it fades out, so it never empties before it disappears.
  const [text, setText] = useState(toastMsg);
  if (toastMsg && toastMsg !== text) setText(toastMsg);
  // Emptied once it has faded, so the same message twice in a row is announced again and nothing stale stays readable.
  return <div className={`toast${toastMsg ? ' show' : ''}`} role="status" aria-live="polite" onTransitionEnd={() => { if (!toastMsg) setText(''); }}>{text}</div>;
}
