// Turns the photoreal rack renders (made in ChatGPT, transparent PNG) into the rack's images.
//   node scripts/rack-renders.mjs [folder]      default folder: ~/Downloads
// Reads <folder>/mezon-<id>-34.png (three-quarter view) and <folder>/mezon-<id>-back.png (back view), trims the
// empty margins, writes public/images/rack/<id>-34.webp and <id>-back.webp at 1120px high, and records in
// src/components/shop/rackRenders.ts each image's aspect and where its collar sits, so the brass hook meets the neck.
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const src = process.argv[2] || join(homedir(), 'Downloads');
const out = join(process.cwd(), 'public/images/rack');
const HEIGHT = 1120;
mkdirSync(out, { recursive: true });

/** The middle of the cloth in the top rows, as a share of the width: where the hook goes. */
async function neckOf(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rows = Math.max(4, Math.round(info.height * 0.025));
  let sum = 0, n = 0;
  for (let y = 0; y < rows; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 128) { sum += x; n++; }
  return n ? sum / n / info.width : 0.5;
}

const found = readdirSync(src).map(f => /^mezon-([a-z0-9-]+)-(34|back)\.png$/i.exec(f)).filter(Boolean);
const manifest = {};
for (const [file, id, view] of found) {
  const trimmed = await sharp(join(src, file)).ensureAlpha().trim({ threshold: 8 }).png().toBuffer();
  const sized = await sharp(trimmed).resize({ height: HEIGHT }).png().toBuffer();
  const meta = await sharp(sized).metadata();
  await sharp(sized).webp({ quality: 84, alphaQuality: 90, effort: 6 }).toFile(join(out, `${id}-${view}.webp`));
  (manifest[id] ??= {})[view === '34' ? 'turn' : 'back'] = { w: meta.width, h: meta.height, neck: +(await neckOf(sized)).toFixed(3) };
  console.log(`${id}-${view}`, meta.width, 'x', meta.height);
}
// keep pieces only when both views exist, so a piece never turns to an empty back
const ready = Object.fromEntries(Object.entries(manifest).filter(([, v]) => v.turn && v.back));
const ts = `/* Written by scripts/rack-renders.mjs: the rack's photoreal renders, per garment id. turn is the three-quarter
   view the piece hangs at, back is the view it turns to; w and h are the image size, neck where the collar sits
   across the width (0..1), so the hook meets it. A garment without an entry hangs its catalogue cut-outs instead. */
export type RackView = { w: number; h: number; neck: number };
export const RACK_RENDERS: Record<string, { turn: RackView; back: RackView }> = ${JSON.stringify(ready, null, 2)};
`;
const file = join(process.cwd(), 'src/components/shop/rackRenders.ts');
if (Object.keys(ready).length || !existsSync(file)) writeFileSync(file, ts);
console.log('rack renders:', Object.keys(ready).join(', ') || 'none');
