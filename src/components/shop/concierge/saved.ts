/* The conversation kept for the browser session, so a trip to the fitting room does not lose it. Its own file so the
   fitting room can read her size without loading the conversation's code. */
import type { SizeInputs } from '@/lib/fit';
import type { Picks } from '@/lib/stylist';
import type { SizeResult, Turn } from './useConcierge';

export const SAVE_KEY = 'mazun_concierge';
export interface Saved { lang: string; turns: Turn[]; gid: string; occasion: number; named: boolean; picks: Picks; sized: SizeResult | null; reached: number; seen: string[]; known: Partial<SizeInputs> | null; scanned: boolean; nextId: number }

export function readSaved(): Saved | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(SAVE_KEY) ?? 'null') as Saved | null;
    return v && Array.isArray(v.turns) && v.turns.every(t => typeof t.id === 'number' && typeof t.text === 'string') && typeof v.gid === 'string' ? v : null;
  } catch { return null; }
}

/** The size the stylist gave her for this garment, if any. */
export function savedSize(garmentId: string): string | null {
  const s = readSaved()?.sized;
  return s?.garmentId === garmentId ? s.rec.size : null;
}
