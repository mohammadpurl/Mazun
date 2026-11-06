import type { Lang } from '@/lib/types';
import ar from './ar.json';
import en from './en.json';
import fa from './fa.json';

export type Copy = typeof en;
export const COPY: Record<Lang, Copy> = { en, ar, fa };

/** The 404 heading for a missing product or any other missing page, also used as the tab title. */
export const notFoundTitle = (lang: Lang, what: 'piece' | 'page') => (what === 'piece' ? COPY[lang].notFoundTitle : COPY[lang].pageNotFoundTitle);
