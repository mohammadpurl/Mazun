/* Design tokens from the Mazun handoff (design/data/tokens.json). Colours are applied as CSS variables on .mz-root. */
import type { CSSProperties } from 'react';
import type { Lang } from '@/lib/types';

export type ThemeKey = 'wine' | 'green' | 'black';

type Palette = {
  main: string; ground: string; accent: string; surface: string; wall: string; ink: string; muted: string; line: string;
  onMain: string; softOnMain: string; goldOnMain: string; railHi: string; railLo: string; soft: string;
};

export const THEMES: Record<ThemeKey, { colors: Palette; swatch: [string, string]; label: Record<Lang, string> }> = {
  wine: {
    colors: { main: '#5E2329', ground: '#F6EFE7', accent: '#B8926A', surface: '#EFE5D9', wall: '#EEE3D5', ink: '#2B1B1C', muted: '#6E5B57', line: '#E3D6C7', onMain: '#F6EFE7', softOnMain: '#E3CFC6', goldOnMain: '#DCC29C', railHi: '#EFDDB6', railLo: '#7A5C38', soft: '#F1E4DF' },
    swatch: ['#5E2329', '#F6EFE7'],
    label: { en: 'Wine & cream', ar: 'شرابي وكريمي', fa: 'شرابی و کرم' },
  },
  green: {
    colors: { main: '#12332B', ground: '#F4EFE6', accent: '#C2A25F', surface: '#ECE6DA', wall: '#EAE3D6', ink: '#14211D', muted: '#56635D', line: '#DDD5C7', onMain: '#F4EFE6', softOnMain: '#C9D3CC', goldOnMain: '#D9BF84', railHi: '#F0DDA8', railLo: '#7C6230', soft: '#E3E9E4' },
    swatch: ['#12332B', '#C2A25F'],
    label: { en: 'Deep green & gold', ar: 'أخضر داكن وذهبي', fa: 'سبز تیره و طلایی' },
  },
  black: {
    colors: { main: '#1F1A17', ground: '#EFE9E0', accent: '#B08D57', surface: '#E7E0D5', wall: '#E5DDD1', ink: '#1F1A17', muted: '#5F574F', line: '#D8CFC2', onMain: '#EFE9E0', softOnMain: '#CFC6BB', goldOnMain: '#D1B07A', railHi: '#E8D4A8', railLo: '#6E5530', soft: '#E4DED6' },
    swatch: ['#1F1A17', '#B08D57'],
    label: { en: 'Warm black & gold', ar: 'أسود دافئ وذهبي', fa: 'سیاه گرم و طلایی' },
  },
};
export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[];
export const isTheme = (v: unknown): v is ThemeKey => typeof v === 'string' && Object.hasOwn(THEMES, v);

/** The theme as CSS variables, plus the language's faces and tracking. */
export function rootVars(theme: ThemeKey, lang: Lang): CSSProperties {
  const c = THEMES[theme].colors, rtl = lang !== 'en';
  return {
    '--main': c.main, '--ground': c.ground, '--accent': c.accent, '--surface': c.surface, '--wall': c.wall, '--ink': c.ink,
    '--muted': c.muted, '--line': c.line, '--on-main': c.onMain, '--soft-on-main': c.softOnMain, '--gold-on-main': c.goldOnMain,
    '--rail-hi': c.railHi, '--rail-lo': c.railLo, '--soft': c.soft,
    '--f-display': rtl ? "'Amiri', 'Noto Naskh Arabic', serif" : "'Bodoni Moda', Didot, Georgia, serif",
    '--f-body': rtl ? "'Vazirmatn', Tahoma, sans-serif" : "'Jost', 'Helvetica Neue', Arial, sans-serif",
    '--ls': rtl ? '0' : '0.04em',
    '--ls-wide': rtl ? '0' : '0.2em',
    '--italic': rtl ? 'normal' : 'italic',
  } as CSSProperties;
}

/** Spring values from tokens.json → motion, as framer-motion transitions. */
export const SPRING = {
  soft: { type: 'spring', stiffness: 120, damping: 22, mass: 1 },
  flip: { type: 'spring', stiffness: 50, damping: 11, mass: 1 },
  rack: { type: 'spring', stiffness: 33, damping: 8.5, mass: 1 },
} as const;
export const EASE = [0.22, 1, 0.36, 1] as const;

/** Rises into place when it scrolls into view (the screens' .mz-reveal). */
export const reveal = {
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: SPRING.soft,
} as const;

export const LOCALE: Record<Lang, string> = { en: 'en-GB', ar: 'ar-OM', fa: 'fa-IR' };
export const num = (n: number, lang: Lang, pad = 0) => n.toLocaleString(LOCALE[lang], { minimumIntegerDigits: pad || 1 });

const luminance = (hex: string | undefined) => {
  const v = parseInt((hex ?? '#000000').slice(1), 16);
  return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
};
/** Pale cloth (ivory, champagne, blush), which needs a warmer ground and reads as the light look. */
export const isPale = (hex: string | undefined) => luminance(hex) > 0.7;

/** The card ground behind a garment: a warmer cream behind pale pieces, as in products.json, and one step deeper
 *  behind the palest (ivory), which would otherwise melt into the cream. */
export function cardBg(hex: string | undefined) {
  const lum = luminance(hex);
  return lum > 0.85 ? '#E2D6C4' : lum > 0.7 ? '#EDE3D4' : '#EDE5DA';
}

/** Three tones of a garment's colour for the illustrated shayla on the hero figure. Pale cloth shades toward a warm
 *  brown rather than black, as the design's ivory look does (#EFE2CC, #D9C4A3, #B69B74). */
export function shaylaTones(hex: string | undefined): [string, string, string] {
  const v = parseInt((hex ?? '#5E2329').slice(1), 16);
  const ch = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  const lum = (0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]) / 255;
  const mix = (t: number, to: number[]) => '#' + ch.map((x, i) => Math.round(x + (to[i] - x) * t).toString(16).padStart(2, '0')).join('');
  return lum > 0.6 ? [mix(0.25, [255, 250, 240]), mix(0.12, [150, 120, 80]), mix(0.42, [107, 78, 46])] : [mix(0.3, [255, 255, 255]), mix(0, [0, 0, 0]), mix(0.45, [0, 0, 0])];
}

/** The rail alternates dark and pale pieces, so neighbours stay apart when they hang side-on. */
export function railOrder<T extends { colors: { hex: string }[] }>(list: T[]): T[] {
  const lum = (g: T) => { const v = parseInt((g.colors[0]?.hex ?? '#000000').slice(1), 16); return 0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255); };
  const sorted = [...list].sort((x, y) => lum(x) - lum(y));
  const dark = sorted.slice(0, Math.ceil(sorted.length / 2)), pale = sorted.slice(Math.ceil(sorted.length / 2)).reverse();
  return dark.flatMap((d, i) => (pale[i] ? [d, pale[i]] : [d]));
}

