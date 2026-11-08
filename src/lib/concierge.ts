/* The concierge's built-in reading of a customer's message: what she asks for, the occasion, a colour, a budget and
   any size details. It answers when the AI is not connected or fails, and scripts the sample conversation on the home
   page, so the chat never dead-ends. Pure: shared by the shop UI and the tests. */
import { effectivePrice, type FitPref, type SizeInputs } from './fit';
import type { Garment } from './types';

export type Intent = 'pick' | 'size' | 'set' | 'tryon' | 'chat';
export const INTENTS: readonly Intent[] = ['pick', 'size', 'set', 'tryon', 'chat'];

/** Colour families a customer names; a garment's family comes from its hex. */
export type Family = 'black' | 'white' | 'red' | 'pink' | 'green' | 'blue' | 'beige';

export interface SizeFacts { height: number | null; usual: string | null; fit: FitPref | null; bust: number | null }
export interface Reading { intent: Intent; occasion: number | null; family: Family | null; budget: number | null; another: boolean; size: SizeFacts }

/** Persian and Arabic digits as Latin ones. */
export const latinDigits = (s: string) => s
  .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

/** Latin digits, one spelling of Arabic-script letters, no joiners, lower case. */
export function normalise(s: string): string {
  return latinDigits(s)
    .replace(/ي/g, 'ی').replace(/ى/g, 'ی').replace(/ك/g, 'ک').replace(/ة/g, 'ه').replace(/[أإآ]/g, 'ا')
    .replace(/[ً-ْ]/g, '')
    .replace(/‌/g, ' ')
    .toLowerCase();
}

/** Words and numbers: "what's" stays one word, so its "s" is never read as a size, and "170cm" splits in two. */
const tokens = (s: string) => s
  .replace(/(\p{L})['’]\p{L}+/gu, '$1')
  .replace(/(\d)(\p{L})/gu, '$1 $2')
  .split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Each word, and each Arabic word without its joined article or particle (للعمل → عمل, الطقم → طقم, لزفاف → زفاف). */
const withBare = (words: string[]) => words.flatMap(w => {
  const article = w.replace(/^(?:لل|ال|[وبل]ال)/, '');
  if (article !== w) return article.length >= 3 ? [w, article] : [w];
  // A lone و، ب or ل only counts before a longer word, so "بعید" (far) is not read as "عید".
  const bare = w.replace(/^[وبل]/, '');
  return bare !== w && bare.length >= 4 ? [w, bare] : [w];
});

/** A word list holds a stem: multi-word stems by phrase, long ones also as a prefix (عروس → عروسی), short ones exactly,
 *  so "شب" never matches "شبیه" and "day" never matches "birthday". */
function holds(words: string[], joined: string, stems: string[]): boolean {
  return stems.some(raw => {
    // A leading "=" asks for the whole word: "look" must not match "looking".
    if (raw.startsWith('=')) return words.includes(normalise(raw.slice(1)));
    const stem = normalise(raw);
    if (stem.includes(' ')) return ` ${joined} `.includes(` ${stem}`);
    return words.some(w => w === stem || (stem.length >= 4 && w.startsWith(stem)));
  });
}

// Index into the stylist's occasions: daytime, evening, Eid, wedding guest, office.
const OCCASIONS: [number, string[]][] = [
  [3, ['wedding', 'bride', 'bridal', 'nikah', 'engagement', 'عروس', 'زفاف', 'عرس', 'زواج','عقد', 'نامزدی', 'خطوبه', 'ملکه']],
  [2, ['eid', 'عید', 'عیدی', 'دیدنی', 'زیارت']],
  [1, ['evening', 'night', 'party', 'gala', 'dinner', 'birthday', 'مهمانی', 'مهمونی', 'شب', 'جشن', 'تولد', 'سهره', 'حفله', 'مساء', 'عشاء']],
  [4, ['office', 'work', 'meeting', 'کار', 'سرکار', 'اداره', 'جلسه', 'شرکت', 'عمل', 'دوام', 'مکتب', 'اجتماع']],
  [0, ['daily', 'everyday', 'every day', 'casual', 'day', 'روزانه', 'هر روز', 'ساده', 'خرید', 'بیرون', 'یومی', 'کاجوال', 'نهار']],
];

const FAMILIES: [Family, string[]][] = [
  ['black', ['black', 'مشکی', 'سیاه', 'اسود', 'سوداء']],
  ['white', ['white', 'ivory', 'cream', 'سفید', 'عاجی', 'شیری', 'کرم', 'ابیض', 'بیضاء', 'کریمی']],
  ['red', ['red', 'garnet', 'wine', 'burgundy', 'maroon', 'قرمز', 'سرخ', 'یاقوتی', 'زرشکی', 'شرابی', 'احمر', 'حمراء', 'عنابی']],
  ['pink', ['pink', 'rose', 'blush', 'صورتی', 'گلبهی', 'رز', 'وردی', 'زهری']],
  ['green', ['green', 'olive', 'sage', 'emerald', 'سبز', 'زیتونی', 'یشمی', 'اخضر', 'خضراء']],
  ['blue', ['blue', 'navy', 'آبی', 'ابی', 'سرمه', 'سرمه ای', 'کحلی', 'ازرق', 'زرقاء']],
  ['beige', ['beige', 'gold', 'champagne', 'sand', 'bej', 'بژ', 'طلایی', 'شامپاینی', 'شنی', 'ذهبی', 'رملی', 'بیج']],
];

const WORDS = {
  size: ['size', 'sizing', 'measure', 'measurement', 'fit me', 'سایز', 'سایزم', 'اندازه', 'اندازم', 'مقاس', 'مقاسی', 'قیاس'],
  set: ['set', '=look', '=looks', 'outfit', 'accessory', 'accessories', 'match', 'ست', 'ستش', 'ستی', 'ستم', 'اکسسوری', 'کیف', 'شال', 'کفش', 'طقم', 'اطلاله', 'اکسسوار', 'حقیبه', 'شیله', 'حذاء', 'نسقی', 'نسق'],
  tryon: ['try', 'wear it', 'on me', 'mirror', 'پرو', 'تنم', 'تن من', 'بپوشم', 'امتحان', 'آینه زنده', 'جربی', 'اجرب', 'تجربه', 'علی جسمی', 'مرآه'],
  another: ['another', 'else', 'different', 'other', 'next', 'یکی دیگه', 'یکی دیگر', 'دیگری', 'بعدی', 'عوض', 'غیر', 'اخری', 'غیرها', 'بدیل'],
  piece: ['abaya', 'dress', 'kaftan', 'caftan', 'outfit', 'something', 'wear', 'عبا', 'عبای', 'لباس', 'پیراهن', 'کفتان', 'مانتو', 'عباءه', 'عبایه', 'فستان', 'قفطان', 'ثوب', 'چیزی', 'شیء', 'پیشنهاد', 'suggest', 'recommend', 'اقترحی', 'ارید', 'میخوام', 'می خواهم', 'می خوام'],
  budget: ['under', 'below', 'less', 'max', 'budget', 'cheaper', 'زیر', 'کمتر', 'بودجه', 'حداکثر', 'اقل', 'تحت', 'میزانیه', 'حدود', 'ارزان'],
  cheap: ['cheap', 'cheaper', 'affordable', 'ارزان', 'ارزون', 'ارخص', 'رخیص'],
  height: ['cm', 'tall', 'height', 'قد', 'قدم', 'سانت', 'سانتی', 'طول', 'طولی', 'سم'],
  wear: ['size', 'wear', 'usually', 'سایز', 'سایزم', 'پوشم', 'معمولا', 'مقاس', 'مقاسی', 'البس', 'ارتدی', 'عاده'],
  fitted: ['fitted', 'tight', 'slim', 'جذب', 'تنگ', 'ضیق', 'ضیقه'],
  relaxed: ['relaxed', 'loose', 'oversize', 'oversized', 'گشاد', 'آزاد', 'راحت', 'واسع', 'فضفاض'],
  bust: ['bust', 'chest', 'سینه', 'دور سینه', 'صدر'],
};

const SIZE_ALIAS: Record<string, string> = {
  xs: 'XS', s: 'S', m: 'M', l: 'L', xl: 'XL', xxl: 'XXL',
  small: 'S', medium: 'M', large: 'L', اسمال: 'S', مدیوم: 'M', لارج: 'L', ایکسلارج: 'XL', صغیر: 'S', متوسط: 'M', کبیر: 'L',
};

/** Reads one message. Numbers need a word beside them to mean anything: "150" alone is neither a height nor a budget. */
export function readMessage(text: string): Reading {
  const joined = normalise(text);
  const words = tokens(joined);
  const bareWords = withBare(words);
  const has = (stems: string[]) => holds(bareWords, words.join(' '), stems);

  const near = (stems: string[], min: number, max: number): number | null => {
    for (let i = 0; i < words.length; i++) {
      const n = /^\d+$/.test(words[i]) ? Number(words[i]) : NaN;
      if (Number.isNaN(n) || n < min || n > max) continue;
      const around = words.slice(Math.max(0, i - 2), i + 3);
      if (holds(around, around.join(' '), stems)) return n;
    }
    return null;
  };
  const height = near(WORDS.height, 130, 210);
  const bust = near(WORDS.bust, 60, 160);
  const budget = height === null || !has(WORDS.height) ? near(WORDS.budget, 10, 5000) : near(['under', 'below', 'زیر', 'کمتر', 'بودجه', 'اقل', 'تحت', 'میزانیه'], 10, 5000);
  // A size word counts only right beside a word about sizes or wearing: "I wear a medium", "M می پوشم". "I am 170" is not
  // size M, and "what to wear to a small party" is not size S.
  const isWear = (w: string | undefined) => !!w && holds([w], w, WORDS.wear);
  const usualWord = words.find((w, i) => {
    if (!SIZE_ALIAS[w]) return false;
    const before = ['a', 'an', 'in', 'is', 'my', 'من', 'هو'].includes(words[i - 1]) ? words[i - 2] : words[i - 1];
    const after = words[i + 1] === 'می' ? words[i + 2] : words[i + 1];
    return isWear(before) || isWear(after);
  });
  const usual = usualWord ? SIZE_ALIAS[usualWord] : joined.includes('ایکس لارج') ? 'XL' : null;
  const fit: FitPref | null = has(WORDS.fitted) ? 'fitted' : has(WORDS.relaxed) ? 'relaxed' : null;

  const occasion = OCCASIONS.find(([, stems]) => has(stems))?.[0] ?? null;
  const family = FAMILIES.find(([, stems]) => has(stems))?.[0] ?? null;
  const another = has(WORDS.another);
  const size: SizeFacts = { height, usual, fit, bust };

  // A set is asked for by name; a word like "شال" alongside "سایز" is still a question about size.
  let intent: Intent = 'chat';
  if (has(WORDS.size) || height !== null || bust !== null || (usual !== null && has(WORDS.wear))) intent = 'size';
  else if (has(WORDS.tryon)) intent = 'tryon';
  else if (has(WORDS.set)) intent = 'set';
  else if (occasion !== null || family !== null || budget !== null || another || has(WORDS.piece) || has(WORDS.cheap)) intent = 'pick';
  return { intent, occasion, family, budget: budget ?? (has(WORDS.cheap) ? 0 : null), another, size };
}

/** The colour family of a hex. */
export function familyOf(hex: string): Family {
  const v = parseInt(hex.slice(1), 16);
  const r = ((v >> 16) & 255) / 255, g = ((v >> 8) & 255) / 255, b = (v & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  if (h < 0) h += 360;
  if (l > 0.82) return 'white';
  if (s > 0.15 && h >= 200 && h <= 270) return 'blue';
  if (l < 0.14) return 'black';
  if (h >= 60 && h < 170) return 'green';
  if (h >= 32 && h < 60) return l < 0.3 ? 'green' : 'beige';
  return l > 0.5 ? 'pink' : 'red';
}

const inStock = (g: Garment) => g.kind === 'garment' && g.sizes.some(s => s.ok);

/** The best garment for what she said. The named colour leads, a budget filters, the occasion leans on price (evenings
 *  and weddings towards the richer pieces, every day towards the simpler ones), and "another" skips what she has seen. */
export function pickGarment(garments: Garment[], r: Pick<Reading, 'occasion' | 'family' | 'budget' | 'another'>, seen: string[] = []): Garment | null {
  let pool = garments.filter(inStock);
  if (!pool.length) return null;
  if (r.budget) {
    const within = pool.filter(g => effectivePrice(g) <= r.budget!);
    // Nothing that cheap: the closest thing to her budget is the least expensive piece.
    if (!within.length) return [...pool].sort((a, b) => effectivePrice(a) - effectivePrice(b))[0];
    pool = within;
  }
  if (r.another || seen.length) {
    const fresh = pool.filter(g => !seen.includes(g.id));
    if (fresh.length) pool = fresh;
  }
  const prices = pool.map(effectivePrice), lo = Math.min(...prices), span = Math.max(1, Math.max(...prices) - lo);
  const rich = r.occasion === 1 || r.occasion === 3 ? 1 : r.occasion === 2 ? 0.4 : r.occasion === 0 || r.occasion === 4 ? -1 : 0;
  const score = (g: Garment) => {
    const hex = g.colors[0]?.hex;
    const rank = (effectivePrice(g) - lo) / span;
    return (r.family && hex && familyOf(hex) === r.family ? 10 : 0)
      + (r.budget === 0 ? -rank * 6 : rich * rank * 4);
  };
  return [...pool].sort((a, b) => score(b) - score(a) || pool.indexOf(a) - pool.indexOf(b))[0];
}

/** Size facts complete enough to recommend from, on top of what is already known. */
export function sizeInputs(f: SizeFacts, known?: Partial<SizeInputs> | null): SizeInputs | null {
  const usual = f.usual ?? known?.usual ?? null;
  const height = f.height ?? known?.height ?? 0;
  // A size she states now outranks a measurement taken earlier.
  const bust = f.bust ?? (f.usual ? 0 : known?.bust ?? 0);
  if (!usual && bust <= 0) return null;
  return { height, usual: usual ?? 'M', fit: f.fit ?? known?.fit ?? 'regular', bust, len: known?.len ?? 'ankle' };
}

/** Text with `{key}` placeholders filled. */
export const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
