/* Omani cities the boutique delivers to: names in the shop's three languages plus common spellings, and where they
   are (for the dashboard map). A city typed by a customer is matched to one of these when it can be; anything else
   is kept as typed and grouped under its own name. */

export interface City {
  key: string;
  fa: string;
  ar: string;
  en: string;
  lat: number;
  lon: number;
  /** Other spellings customers type. Compared after `simplify`. */
  aliases: string[];
}

export const OMAN_CITIES: City[] = [
  { key: 'muscat', fa: 'مسقط', ar: 'مسقط', en: 'Muscat', lat: 23.588, lon: 58.383, aliases: ['masqat', 'muscat city', 'مطرح', 'muttrah', 'al khuwair', 'الخوير', 'bawshar', 'بوشر', 'seeb', 'السيب', 'سیب', 'qurum', 'القرم', 'al amerat', 'العامرات'] },
  { key: 'salalah', fa: 'صلاله', ar: 'صلالة', en: 'Salalah', lat: 17.019, lon: 54.089, aliases: ['salala', 'صلالہ', 'ظفار', 'dhofar'] },
  { key: 'sohar', fa: 'صحار', ar: 'صحار', en: 'Sohar', lat: 24.347, lon: 56.709, aliases: ['suhar', 'sohar city'] },
  { key: 'nizwa', fa: 'نزوا', ar: 'نزوى', en: 'Nizwa', lat: 22.933, lon: 57.533, aliases: ['nazwa', 'نزوی', 'نزوة'] },
  { key: 'sur', fa: 'صور', ar: 'صور', en: 'Sur', lat: 22.567, lon: 59.529, aliases: ['soor', 'sur city'] },
  { key: 'ibri', fa: 'عبری', ar: 'عبري', en: 'Ibri', lat: 23.226, lon: 56.516, aliases: ['ebri'] },
  { key: 'buraimi', fa: 'بریمی', ar: 'البريمي', en: 'Al Buraimi', lat: 24.251, lon: 55.793, aliases: ['buraimi', 'al-buraimi', 'بريمي'] },
  { key: 'rustaq', fa: 'رستاق', ar: 'الرستاق', en: 'Rustaq', lat: 23.391, lon: 57.424, aliases: ['ar rustaq', 'al rustaq', 'rostaq'] },
  { key: 'barka', fa: 'برکاء', ar: 'بركاء', en: 'Barka', lat: 23.679, lon: 57.886, aliases: ['barkaa', 'برکا', 'بركا'] },
  { key: 'ibra', fa: 'ابراء', ar: 'إبراء', en: 'Ibra', lat: 22.691, lon: 58.533, aliases: ['ابرا', 'ابراء'] },
  { key: 'khasab', fa: 'خصب', ar: 'خصب', en: 'Khasab', lat: 26.18, lon: 56.248, aliases: ['musandam', 'مسندم'] },
  { key: 'duqm', fa: 'دقم', ar: 'الدقم', en: 'Duqm', lat: 19.662, lon: 57.704, aliases: ['ad duqm', 'al duqm'] },
  { key: 'bahla', fa: 'بهلا', ar: 'بهلاء', en: 'Bahla', lat: 22.964, lon: 57.297, aliases: ['bahlaa'] },
  { key: 'samail', fa: 'سمائل', ar: 'سمائل', en: 'Samail', lat: 23.304, lon: 57.978, aliases: ['sumail', 'سمایل'] },
];

/** Lower-case, no diacritics or tatweel, Arabic letter variants folded to one form, spaces squeezed. */
export function simplify(s: string): string {
  return s.toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ی/g, 'ي').replace(/ك/g, 'ک').replace(/ة/g, 'ه').replace(/ۀ/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

const INDEX = new Map<string, City>();
for (const c of OMAN_CITIES) for (const n of [c.key, c.fa, c.ar, c.en, ...c.aliases]) INDEX.set(simplify(n), c);

/** The known city a typed name refers to, or null. "Muscat - Al Khuwair" and "مسقط، الخوير" both find Muscat. */
export function findCity(text: string): City | null {
  const s = simplify(text);
  if (!s) return null;
  const whole = INDEX.get(s);
  if (whole) return whole;
  const words = s.split(' ');
  for (let n = Math.min(3, words.length); n >= 1; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      const hit = INDEX.get(words.slice(i, i + n).join(' '));
      if (hit) return hit;
    }
  }
  return null;
}

/** A stable grouping key and a Persian display name for a typed city. Empty input groups as "unknown". */
export function cityGroup(text: string): { key: string; name: string; city: City | null } {
  const c = findCity(text);
  if (c) return { key: c.key, name: c.fa, city: c };
  const s = simplify(text);
  return s ? { key: 'x:' + s, name: text.trim(), city: null } : { key: 'unknown', name: 'نامشخص', city: null };
}
