import type { Garment } from './types';

/* The live AI try-on (Decart Lucy VTON, directly or through fal.ai): every second of generation is billed, so a session is short. */

/** How long one live try-on runs before it stops on its own. */
export const LIVE_SECONDS = 60;
/** Live sessions a visitor may start in an hour (each start, and each reconnect, asks for a token). */
export const LIVE_TOKENS_PER_HOUR = 10;
/** A ceiling for the whole site per day, so a script cannot run up the bill. */
export const LIVE_TOKENS_PER_DAY = 300;
/** Decart's live try-on model, pinned so its look and price change only when we choose (the newest on 2026-11-12;
 *  `lucy-vton-latest` would follow Decart's releases without a deploy). Used for the token and the session alike. */
export const LIVE_MODEL = 'lucy-vton-3.6';
/** The live try-on on fal.ai (Decart Lucy 2.1 VTON, an older model): the fallback when there is no DECART_API_KEY or
 *  Decart does not hand out a token. */
export const FAL_APP = 'decart/lucy2-vton/realtime';

/** The model reads English: the piece's own name, type and description, and a reminder to leave the face alone.
 *  Kept under the model's ~750-character limit. */
export function livePrompt(g: Pick<Garment, 'name' | 'type' | 'description'>): string {
  const name = g.name.en.trim(), type = g.type.en.trim(), desc = g.description.en.trim();
  const text = `Substitute the outfit with the ${name}${type ? ` (${type.toLowerCase()})` : ''}.${desc ? ` ${desc}` : ''} Keep the face, hair and any headscarf unchanged.`;
  return text.length > 700 ? `${text.slice(0, 697)}...` : text;
}
