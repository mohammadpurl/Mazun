// Builds src/components/shop/glyphs.ts from the Phosphor SVG sources (@phosphor-icons/core, a dev dependency), so the
// site ships only the icons and weights it uses: light for all, duotone where marked. Run: npm run icons
// With --check it only compares, and exits 1 when glyphs.ts is out of date (part of npm run check).
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** name in the site → [Phosphor file name, also ship duotone] */
const ICONS = {
  again: ['arrows-counter-clockwise'],
  alert: ['warning-circle'],
  back: ['arrow-left'],
  bag: ['shopping-bag'],
  bookmark: ['bookmark-simple', true],
  calendar: ['calendar-blank'],
  camera: ['camera'],
  caret: ['caret-right'],
  chat: ['chats-circle'],
  check: ['check', true],
  close: ['x'],
  compare: ['square-split-horizontal', true],
  done: ['check-circle', true],
  dot: ['circle', true],
  down: ['caret-down'],
  external: ['arrow-up-right'],
  frame: ['frame-corners', true],
  front: ['image-square'],
  grip: ['dots-six-vertical'],
  handbag: ['handbag', true],
  hanger: ['coat-hanger', true],
  heart: ['heart', true],
  info: ['info'],
  jewel: ['diamond', true],
  library: ['images'],
  light: ['sun', true],
  lock: ['lock-simple'],
  menu: ['list'],
  minus: ['minus'],
  model: ['person-simple'],
  next: ['arrow-right'],
  noCamera: ['camera-slash'],
  pause: ['pause'],
  person: ['person'],
  play: ['play'],
  plus: ['plus'],
  pose: ['person-arms-spread', true],
  ruler: ['ruler'],
  save: ['download-simple'],
  search: ['magnifying-glass'],
  send: ['paper-plane-tilt'],
  share: ['export'],
  shirt: ['t-shirt', true],
  shoes: ['high-heel', true],
  swap: ['arrows-left-right', true],
  swipe: ['hand-swipe-left'],
  telegram: ['telegram-logo'],
  turn: ['arrows-clockwise'],
  up: ['caret-up'],
  upload: ['upload-simple'],
  view: ['eye'],
  whatsapp: ['whatsapp-logo'],
  yourPhoto: ['user-focus', true],
};

/** Drawn by hand in Icon.tsx, so a generated icon may not take these names. */
const RESERVED = ['form', 'scarf'];
const clash = Object.keys(ICONS).filter(n => RESERVED.includes(n));
if (clash.length) throw new Error(`reserved for hand-drawn icons in Icon.tsx: ${clash.join(', ')}`);

const here = path.dirname(fileURLToPath(import.meta.url));
// The package exports no package.json, so find its folder from the entry point.
let root = path.dirname(createRequire(import.meta.url).resolve('@phosphor-icons/core'));
while (!fs.existsSync(path.join(root, 'assets'))) {
  if (path.dirname(root) === root) throw new Error('@phosphor-icons/core assets not found; run npm install');
  root = path.dirname(root);
}
const read = (file, weight) => {
  const svg = fs.readFileSync(path.join(root, 'assets', weight, weight === 'regular' ? `${file}.svg` : `${file}-${weight}.svg`), 'utf8');
  const body = svg.replace(/^<svg[^>]*>|<\/svg>\s*$/g, '');
  const paths = [...body.matchAll(/<path d="([^"]+)"(?: opacity="([\d.]+)")?\/>/g)];
  if (paths.map(m => m[0]).join('') !== body) throw new Error(`${file}-${weight}: only <path> elements are supported`);
  return paths.map(([, d, o]) => (o ? [d, +o] : [d]));
};

/** The admin panel's set: regular weight for controls, duotone (the faint fill) for navigation and tiles. Shipped in a
 *  file of its own, so the shop never loads it. name → [Phosphor file name, also ship duotone] */
const ADMIN_ICONS = {
  dashboard: ['squares-four', true], orders: ['receipt', true], shipments: ['truck', true], customers: ['users-three', true],
  products: ['coat-hanger', true], collections: ['stack', true], settings: ['gear-six', true], store: ['storefront', true],
  search: ['magnifying-glass'], bell: ['bell', true], moon: ['moon', true], sun: ['sun', true], menu: ['list'], sidebar: ['sidebar-simple'],
  close: ['x'], plus: ['plus'], minus: ['minus'], check: ['check'], done: ['check-circle', true], down: ['caret-down'], up: ['caret-up'],
  left: ['caret-left'], right: ['caret-right'], trendUp: ['trend-up'], trendDown: ['trend-down'], back: ['arrow-left'], next: ['arrow-right'],
  external: ['arrow-square-out'], download: ['download-simple'], upload: ['upload-simple'], image: ['image', true], images: ['images', true],
  trash: ['trash'], edit: ['pencil-simple'], copy: ['copy'], eye: ['eye'], eyeOff: ['eye-slash'], grip: ['dots-six-vertical'], more: ['dots-three'],
  filter: ['funnel', true], sort: ['arrows-down-up'], columns: ['columns'], calendar: ['calendar-blank', true], clock: ['clock', true],
  phone: ['phone'], whatsapp: ['whatsapp-logo'], mail: ['envelope-simple'], pin: ['map-pin', true], money: ['money', true], wallet: ['wallet', true],
  coins: ['coins', true], card: ['credit-card'], package: ['package', true], tag: ['tag', true], star: ['star', true], crown: ['crown', true],
  sparkle: ['sparkle', true], warning: ['warning', true], info: ['info'], user: ['user', true], userPlus: ['user-plus', true], logout: ['sign-out'],
  command: ['command'], printer: ['printer'], note: ['note-pencil', true], target: ['target', true], chartUp: ['chart-line-up', true],
  pie: ['chart-pie-slice', true], repeat: ['repeat', true], timer: ['timer', true], route: ['path', true], home: ['house', true],
  work: ['briefcase', true], hourglass: ['hourglass', true], lock: ['lock-simple'], rows: ['rows'], grid: ['squares-four'], refresh: ['arrow-clockwise'],
  dress: ['dress', true], handbag: ['handbag', true], jewel: ['diamond', true], shoes: ['high-heel', true], gift: ['gift', true],
  fullscreen: ['corners-out'], checklist: ['list-checks', true], send: ['paper-plane-tilt', true], handCoins: ['hand-coins', true],
  sealCheck: ['seal-check', true], undo: ['arrow-u-up-left'], xCircle: ['x-circle', true], spinner: ['circle-notch'], bag: ['shopping-bag', true],
  rocket: ['rocket-launch', true], percent: ['percent'],
};

const build = (set, regular, comment, exportName) => {
  const lines = Object.entries(set).map(([name, [file, duo]]) => {
    const glyph = { light: read(file, regular), ...(duo ? { duotone: read(file, 'duotone') } : {}) };
    return `  ${name}: ${JSON.stringify(glyph)},`;
  });
  return `// Generated by scripts/icons.mjs from @phosphor-icons/core (MIT). Do not edit; ${comment} and run npm run icons.
export type Shape = readonly (readonly [d: string, opacity?: number])[];
export type Glyph = { readonly light: Shape; readonly duotone?: Shape };

export const ${exportName} = {
${lines.join('\n')}
} satisfies Record<string, Glyph>;
`;
};

const outputs = [
  [path.join(here, '..', 'src', 'components', 'shop', 'glyphs.ts'), build(ICONS, 'light', 'add icons there', 'GLYPHS'), ICONS],
  // The admin's "light" slot holds Phosphor's regular weight: thin strokes read poorly at control sizes on a panel.
  [path.join(here, '..', 'src', 'components', 'admin', 'glyphs.ts'), build(ADMIN_ICONS, 'regular', 'add icons to ADMIN_ICONS there', 'ADMIN_GLYPHS'), ADMIN_ICONS],
];
let stale = false;
for (const [dest, out, set] of outputs) {
  const name = path.relative(path.join(here, '..'), dest);
  if (process.argv.includes('--check')) {
    const now = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8').replace(/\r\n/g, '\n') : '';
    if (now !== out) { console.error(`${name} is out of date: run npm run icons`); stale = true; }
    else console.log(`${name} is up to date`);
  } else {
    fs.writeFileSync(dest, out);
    console.log(`${name}: ${Object.keys(set).length} icons, ${(out.length / 1024).toFixed(1)} KB`);
  }
}
if (stale) process.exit(1);
