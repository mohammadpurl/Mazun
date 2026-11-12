/* Written by scripts/rack-renders.mjs: the rack's photoreal renders, per garment id. turn is the three-quarter
   view the piece hangs at, back is the view it turns to; w and h are the image size, neck where the collar sits
   across the width (0..1), so the hook meets it. A garment without an entry hangs its catalogue cut-outs instead. */
export type RackView = { w: number; h: number; neck: number };
export const RACK_RENDERS: Record<string, { turn: RackView; back: RackView }> = {
  "dana": {
    "turn": {
      "w": 615,
      "h": 1120,
      "neck": 0.479
    },
    "back": {
      "w": 603,
      "h": 1120,
      "neck": 0.471
    }
  },
  "mazun": {
    "turn": {
      "w": 567,
      "h": 1120,
      "neck": 0.463
    },
    "back": {
      "w": 572,
      "h": 1120,
      "neck": 0.489
    }
  }
};
