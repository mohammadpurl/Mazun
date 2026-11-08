'use client';
import { MotionConfig } from 'motion/react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useBoutique } from '../boutique/Boutique';
import { COPY, type Copy } from './copy';
import { rootVars, type ThemeKey } from './tokens';

export type { Copy };

type ShopCtx = {
  c: Copy;
  theme: ThemeKey;
  setTheme: (t: ThemeKey) => void;
  /** Pieces sent to the fitting room with the hanger button. */
  picks: string[];
  togglePick: (id: string) => void;
};
const Ctx = createContext<ShopCtx | null>(null);

export function useShop() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useShop outside ShopProvider');
  return s;
}

const PICKS_KEY = 'mazun_picks';

/** The redesigned storefront's root: theme, copy, the fitting-room picks and the motion settings. */
export function ShopProvider({ initialTheme, children }: { initialTheme: ThemeKey; children: ReactNode }) {
  const { lang, dir } = useBoutique();
  const [theme, setThemeState] = useState(initialTheme);
  const [picks, setPicks] = useState<string[]>([]);

  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(PICKS_KEY) ?? '[]');
      if (Array.isArray(v)) setPicks(v.filter(x => typeof x === 'string'));
    } catch { /* storage blocked or malformed */ }
  }, []);
  const togglePick = useCallback((id: string) => {
    setPicks(p => {
      const next = p.includes(id) ? p.filter(x => x !== id) : [...p, id];
      try { localStorage.setItem(PICKS_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
      return next;
    });
  }, []);
  const setTheme = useCallback((t: ThemeKey) => {
    setThemeState(t);
    document.cookie = `theme=${t}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const value = useMemo(() => ({ c: COPY[lang], theme, setTheme, picks, togglePick }), [lang, theme, setTheme, picks, togglePick]);
  return (
    <Ctx.Provider value={value}>
      <MotionConfig reducedMotion="user">
        <div className="mz-root" dir={dir} lang={lang} style={rootVars(theme, lang)}>{children}</div>
      </MotionConfig>
    </Ctx.Provider>
  );
}
