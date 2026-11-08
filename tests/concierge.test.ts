import assert from 'node:assert/strict';
import { test } from 'node:test';
import { estimateBust, readFrame, type Landmark } from '../src/lib/body-scan';
import { familyOf, fill, normalise, pickGarment, readMessage, sizeInputs } from '../src/lib/concierge';
import { SEED_GARMENTS } from '../src/lib/defaults';
import { effectivePrice } from '../src/lib/fit';

const garments = SEED_GARMENTS.filter(g => g.kind === 'garment');

test('normalise folds digits, letter variants and joiners', () => {
  assert.equal(normalise('قدم ۱۶۸'), 'قدم 168');
  assert.equal(normalise('طولي ١٦٨'), 'طولی 168');
  assert.equal(normalise('می‌خوام'), 'می خوام');
});

test('occasions are read in all three languages', () => {
  assert.equal(readMessage('برای عروسی خواهرم یه لباس شیک می‌خوام').occasion, 3);
  assert.equal(readMessage('أريد عباءة لحفل زفاف').occasion, 3);
  assert.equal(readMessage('something for a wedding').occasion, 3);
  assert.equal(readMessage('برای مهمانی شب').occasion, 1);
  assert.equal(readMessage('for the office').occasion, 4);
});

test('short stems do not match inside other words', () => {
  assert.equal(readMessage('شبیه این').occasion, null);
  assert.equal(readMessage('birthday party').occasion, 1);
});

test('intents: pick, size, set and try-on', () => {
  assert.equal(readMessage('یه عبای مشکی می‌خوام').intent, 'pick');
  assert.equal(readMessage('سایزم چنده؟').intent, 'size');
  assert.equal(readMessage('ستش رو هم کامل کن').intent, 'set');
  assert.equal(readMessage('می‌خوام روی تنم ببینم').intent, 'tryon');
  assert.equal(readMessage('what size am I').intent, 'size');
  assert.equal(readMessage('سلام').intent, 'chat');
});

test('size facts come from words beside the numbers', () => {
  const r = readMessage('قدم ۱۶۸ و معمولاً M می‌پوشم، گشاد دوست دارم');
  assert.deepEqual(r.size, { height: 168, usual: 'M', fit: 'relaxed', bust: null });
  assert.equal(r.intent, 'size');
  assert.equal(readMessage('I am 172 cm tall').size.height, 172);
  assert.equal(readMessage('دور سینه ۹۲').size.bust, 92);
});

test('a bare number is neither a height nor a budget', () => {
  const r = readMessage('۱۵۰');
  assert.equal(r.size.height, null);
  assert.equal(r.budget, null);
});

test('a budget word makes a number a budget, even in the height range', () => {
  const r = readMessage('یه عبا زیر ۱۵۰ ریال');
  assert.equal(r.budget, 150);
  assert.equal(r.size.height, null);
  assert.equal(r.intent, 'pick');
});

test('colour families from hex', () => {
  assert.equal(familyOf('#151313'), 'black');
  assert.equal(familyOf('#20243F'), 'blue');
  assert.equal(familyOf('#7A1420'), 'red');
  assert.equal(familyOf('#BF857B'), 'pink');
  assert.equal(familyOf('#5F6336'), 'green');
  assert.equal(familyOf('#8E9479'), 'green');
  assert.equal(familyOf('#E8DEC9'), 'white');
  assert.equal(familyOf('#C9B18E'), 'beige');
});

test('the named colour wins', () => {
  const g = pickGarment(garments, readMessage('یک عبای سرمه‌ای'));
  assert.equal(familyOf(g!.colors[0].hex), 'blue');
});

test('a budget filters, and an impossible budget still answers', () => {
  const g = pickGarment(garments, readMessage('abaya under 150'))!;
  assert.ok(effectivePrice(g) <= 150);
  assert.ok(pickGarment(garments, { occasion: null, family: null, budget: 10, another: false }));
});

test('evenings lean rich and every day leans simple', () => {
  const evening = pickGarment(garments, { occasion: 1, family: null, budget: null, another: false })!;
  const daily = pickGarment(garments, { occasion: 0, family: null, budget: null, another: false })!;
  assert.ok(effectivePrice(evening) > effectivePrice(daily));
});

test('"another" skips what she has seen and sold-out pieces are never offered', () => {
  const first = pickGarment(garments, { occasion: 1, family: null, budget: null, another: false })!;
  const next = pickGarment(garments, { occasion: 1, family: null, budget: null, another: true }, [first.id])!;
  assert.notEqual(next.id, first.id);
  const sold = garments.map(g => (g.id === first.id ? { ...g, sizes: g.sizes.map(s => ({ ...s, ok: false })) } : g));
  assert.notEqual(pickGarment(sold, { occasion: 1, family: null, budget: null, another: false })!.id, first.id);
});

test('sizeInputs needs a usual size or a bust', () => {
  assert.equal(sizeInputs({ height: 168, usual: null, fit: null, bust: null }), null);
  assert.deepEqual(sizeInputs({ height: 168, usual: 'L', fit: null, bust: null }), { height: 168, usual: 'L', fit: 'regular', bust: 0, len: 'ankle' });
  assert.equal(sizeInputs({ height: null, usual: null, fit: null, bust: 90 })?.usual, 'M');
});

test('fill replaces known placeholders only', () => {
  assert.equal(fill('{a} and {b}', { a: 1 }), '1 and {b}');
});

/** A standing figure, in shares of a 3:4 frame; `w` is the shoulder width as a share of standing height. */
function pose(w: number, over: Partial<Record<number, Partial<Landmark>>> = {}): Landmark[] {
  const stature = 0.8, cx = 0.5, aspect = 0.75, top = 0.1;
  const half = (w * stature) / aspect / 2, hip = half * 0.55;
  const pts: Landmark[] = Array.from({ length: 33 }, () => ({ x: cx, y: 0.5, visibility: 1 }));
  pts[0] = { x: cx, y: top + stature * 0.07, visibility: 1 };
  pts[11] = { x: cx + half, y: top + stature * 0.18, visibility: 1 };
  pts[12] = { x: cx - half, y: top + stature * 0.18, visibility: 1 };
  pts[23] = { x: cx + hip, y: top + stature * 0.5, visibility: 1 };
  pts[24] = { x: cx - hip, y: top + stature * 0.5, visibility: 1 };
  pts[27] = { x: cx + hip, y: pts[0].y + stature * 0.89, visibility: 1 };
  pts[28] = { x: cx - hip, y: pts[0].y + stature * 0.89, visibility: 1 };
  for (const [k, v] of Object.entries(over)) pts[Number(k)] = { ...pts[Number(k)], ...v };
  return pts;
}

test('readFrame measures widths as shares of height', () => {
  const r = readFrame(pose(0.22), 0.75);
  assert.ok(r.ok);
  if (r.ok) assert.ok(Math.abs(r.shoulder - 0.22) < 0.005);
});

test('readFrame says what to change', () => {
  assert.deepEqual(readFrame(undefined, 0.75), { ok: false, hint: 'noone' });
  assert.deepEqual(readFrame(pose(0.22, { 27: { visibility: 0.1 } }), 0.75), { ok: false, hint: 'back' });
  assert.deepEqual(readFrame(pose(0.08), 0.75), { ok: false, hint: 'face' });
  const far = pose(0.22).map(p => ({ ...p, y: 0.3 + p.y * 0.4 }));
  assert.deepEqual(readFrame(far, 0.75), { ok: false, hint: 'closer' });
});

test('a wider frame gives a larger estimate, and a stray frame cannot move it', () => {
  const slim = estimateBust(Array(9).fill({ shoulder: 0.2, hip: 0.11 }), 165)!;
  const broad = estimateBust(Array(9).fill({ shoulder: 0.25, hip: 0.14 }), 165)!;
  assert.ok(broad > slim);
  const stray = estimateBust([...Array(9).fill({ shoulder: 0.2, hip: 0.11 }), { shoulder: 0.9, hip: 0.9 }], 165)!;
  assert.ok(Math.abs(stray - slim) <= 1);
  assert.equal(estimateBust([], 165), null);
});

test('an impossible budget gets the least expensive piece', () => {
  const g = pickGarment(garments, { occasion: 1, family: null, budget: 10, another: false })!;
  assert.equal(effectivePrice(g), Math.min(...garments.map(effectivePrice)));
});

test('Arabic joined particles are read', () => {
  assert.equal(readMessage('للعمل').occasion, 4);
  assert.equal(readMessage('لزفاف أختي').occasion, 3);
  assert.equal(readMessage('أكملي الطقم').intent, 'set');
  assert.equal(readMessage('حفل عرس').occasion, 3);
});

test('a size letter needs a word about sizes beside it', () => {
  assert.equal(readMessage("What's my size?").size.usual, null);
  assert.equal(readMessage("I'm 170 cm tall").size.usual, null);
  assert.equal(readMessage('I usually wear M').size.usual, 'M');
  assert.equal(readMessage('size L please').size.usual, 'L');
});

test('a height joined to its unit is read', () => {
  assert.equal(readMessage('170cm').size.height, 170);
});

test('whole-word stems do not match longer words', () => {
  assert.equal(readMessage("I'm looking for a black abaya").intent, 'pick');
  assert.equal(readMessage('show me the look').intent, 'set');
});

test('a colloquial word that folds onto mirror is not a try-on', () => {
  assert.notEqual(readMessage('همین اینه که میخوام').intent, 'tryon');
});

test('answering with a usual size is a size message', () => {
  assert.equal(readMessage('I usually wear M').intent, 'size');
  assert.equal(readMessage('I wear a medium').intent, 'size');
});

test('a stated size outranks an earlier measurement', () => {
  const r = sizeInputs({ height: null, usual: 'XL', fit: null, bust: null }, { height: 168, usual: 'M', bust: 91 });
  assert.equal(r?.bust, 0);
  assert.equal(r?.usual, 'XL');
});

test('a short word is not read through its first letter', () => {
  assert.equal(readMessage('بعید').occasion, null);
  assert.equal(readMessage('للعيد').occasion, 2);
});

test('a size-like word about the occasion is not her size', () => {
  const r = readMessage('What should I wear to a small party?');
  assert.equal(r.size.usual, null);
  assert.equal(r.intent, 'pick');
  assert.equal(readMessage('what to wear for a large family dinner').size.usual, null);
});

test('sizes beside wearing words in Persian and Arabic', () => {
  assert.equal(readMessage('معمولاً M می‌پوشم').size.usual, 'M');
  assert.equal(readMessage('L می‌پوشم').size.usual, 'L');
  assert.equal(readMessage('عادةً ألبس M').size.usual, 'M');
  assert.equal(readMessage('ماذا أرتدي لحفل صغير').size.usual, null);
});

test('a stated size with a linking word is still her size', () => {
  assert.equal(readMessage('my size is L').size.usual, 'L');
  assert.equal(readMessage('سایز من M').size.usual, 'M');
});
