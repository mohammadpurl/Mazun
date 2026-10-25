/* Pure stylist logic: which accessory fills each role of a look. Used directly when the AI is not
   connected, and to check the AI's picks before they reach the page. */
import { effectivePrice } from './fit';
import { ACCESSORY_KINDS, type AccessoryKind, type Garment } from './types';

export type Picks = Partial<Record<AccessoryKind, string>>;
export type ByRole = Record<AccessoryKind, Garment[]>;

export const OCCASION_COUNT = 5; // daytime, evening, Eid, wedding guest, office

/** Index into each role's list (admin order) per occasion, from the design: the first piece of a role is
 *  the day choice, the second the evening one. Lists shorter than that wrap around. */
const PRESETS: Record<AccessoryKind, number>[] = [
  { scarf: 0, bag: 0, jewel: 0, shoes: 0 },
  { scarf: 0, bag: 1, jewel: 1, shoes: 1 },
  { scarf: 0, bag: 1, jewel: 1, shoes: 0 },
  { scarf: 0, bag: 1, jewel: 1, shoes: 1 },
  { scarf: 1, bag: 0, jewel: 0, shoes: 0 },
];

/** Without AI, each suggestion chip maps to a look: an occasion preset or a fixed pick pattern. */
export const CHIP_LOOKS: ({ occasion: number } | { pattern: Record<AccessoryKind, number> })[] = [
  { occasion: 1 },
  { pattern: { scarf: 1, bag: 0, jewel: 0, shoes: 0 } },
  { occasion: 1 },
  { pattern: { scarf: 0, bag: 0, jewel: 0, shoes: 0 } },
  { pattern: { scarf: 1, bag: 1, jewel: 0, shoes: 0 } },
];

export function accessoriesByRole(products: Garment[]): ByRole {
  const out = Object.fromEntries(ACCESSORY_KINDS.map(k => [k, [] as Garment[]])) as ByRole;
  for (const p of products) if (p.kind !== 'garment' && p.sizes.some(s => s.ok)) out[p.kind].push(p);
  return out;
}

function fromPattern(byRole: ByRole, pattern: Record<AccessoryKind, number>): Picks {
  const picks: Picks = {};
  for (const k of ACCESSORY_KINDS) {
    const list = byRole[k];
    if (list.length) picks[k] = list[pattern[k] % list.length].id;
  }
  return picks;
}

export const presetPicks = (byRole: ByRole, occasion: number): Picks =>
  fromPattern(byRole, PRESETS[((occasion % OCCASION_COUNT) + OCCASION_COUNT) % OCCASION_COUNT]);

export const chipPicks = (byRole: ByRole, chip: number): { picks: Picks; occasion?: number } => {
  const c = CHIP_LOOKS[chip % CHIP_LOOKS.length];
  return 'occasion' in c ? { picks: presetPicks(byRole, c.occasion), occasion: c.occasion } : { picks: fromPattern(byRole, c.pattern) };
};

/** The next accessory in that role's list ("Replace"). */
export function replacePick(byRole: ByRole, picks: Picks, role: AccessoryKind): Picks {
  const list = byRole[role];
  if (list.length < 2) return picks;
  const i = list.findIndex(g => g.id === picks[role]);
  return { ...picks, [role]: list[(i + 1) % list.length].id };
}

/** Keeps only picks that name an accessory of the right role; anything else falls back to `fallback`. */
export function sanitizePicks(raw: unknown, byRole: ByRole, fallback: Picks): Picks {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: Picks = {};
  for (const k of ACCESSORY_KINDS) {
    const id = o[k];
    if (typeof id === 'string' && byRole[k].some(g => g.id === id)) out[k] = id;
    else if (fallback[k]) out[k] = fallback[k];
  }
  return out;
}

/** Garment plus picked accessories, at current prices. */
export function lookTotal(base: Garment, picks: Picks, byId: (id: string) => Garment | undefined): number {
  return effectivePrice(base) + ACCESSORY_KINDS.reduce((a, k) => { const g = picks[k] ? byId(picks[k]!) : undefined; return a + (g ? effectivePrice(g) : 0); }, 0);
}
