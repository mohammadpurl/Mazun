/* The conversation kept for the browser session, so a full reload does not lose it. It is read back into a provider that
   wraps every shop page, so anything malformed is refused here rather than crashing the shop. */
import type { SizeInputs } from '@/lib/fit';
import { OCCASION_COUNT, type Picks } from '@/lib/stylist';
import type { SizeResult, Turn } from './useConcierge';

export const SAVE_KEY = 'mazun_concierge';
export interface Saved { lang: string; turns: Turn[]; gid: string; occasion: number; named: boolean; picks: Picks; sized: SizeResult | null; reached: number; seen: string[]; known: Partial<SizeInputs> | null; scanned: boolean; nextId: number }

export function readSaved(): Saved | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(SAVE_KEY) ?? 'null') as Saved | null;
    return v
      && Array.isArray(v.turns) && v.turns.every(t => typeof t.id === 'number' && typeof t.text === 'string')
      && typeof v.gid === 'string' && typeof v.lang === 'string' && Number.isInteger(v.occasion) && v.occasion >= 0 && v.occasion < OCCASION_COUNT && typeof v.reached === 'number' && typeof v.nextId === 'number'
      && typeof v.named === 'boolean' && typeof v.scanned === 'boolean' && Array.isArray(v.seen)
      && !!v.picks && typeof v.picks === 'object'
      && (v.known === null || typeof v.known === 'object')
      && (v.sized === null || (typeof v.sized?.garmentId === 'string' && typeof v.sized.rec?.size === 'string' && !!v.sized.inputs))
      ? v : null;
  } catch { return null; }
}

/** The size the stylist gave her for this garment, if any. */
export function savedSize(garmentId: string): string | null {
  const s = readSaved()?.sized;
  return s?.garmentId === garmentId ? s.rec.size : null;
}
