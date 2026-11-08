/* Numbers, money and dates for the panel: Persian digits, the Persian calendar, the shop's time zone. */
const nf = new Map<string, Intl.NumberFormat>();
const numFmt = (o: Intl.NumberFormatOptions) => { const k = JSON.stringify(o); let f = nf.get(k); if (!f) { f = new Intl.NumberFormat('fa-IR', o); nf.set(k, f); } return f; };

export const TZ = 'Asia/Muscat';
/** ۱۲٬۳۴۵ — up to three decimals (Omani rial has baisa). */
export const faNum = (n: number, digits = 3) => numFmt({ maximumFractionDigits: digits }).format(n);
/** Order numbers without grouping: #۱۰۰۱. */
export const faId = (n: number) => numFmt({ useGrouping: false }).format(n);
/** ۱۲٫۵ هزار for chart axes and tight spots. */
export function faCompact(n: number) {
  const a = Math.abs(n);
  if (a >= 1_000_000) return faNum(Math.round(n / 100_000) / 10, 1) + ' میلیون';
  if (a >= 10_000) return faNum(Math.round(n / 1000), 0) + ' هزار';
  if (a >= 1000) return faNum(Math.round(n / 100) / 10, 1) + ' هزار';
  return faNum(n, 1);
}
export const faPct = (n: number, digits = 0) => numFmt({ maximumFractionDigits: digits }).format(n) + '٪';

const df = new Map<string, Intl.DateTimeFormat>();
const dateFmt = (o: Intl.DateTimeFormatOptions) => { const k = JSON.stringify(o); let f = df.get(k); if (!f) { f = new Intl.DateTimeFormat('fa-IR', { timeZone: TZ, ...o }); df.set(k, f); } return f; };
/** ۱۶ آبان ۱۴۰۵ */
export const faDate = (iso: string | number) => dateFmt({ day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
/** ۱۶ آبان */
export const faDay = (iso: string | number) => dateFmt({ day: 'numeric', month: 'long' }).format(new Date(iso));
/** ۱۶ آبان، ۱۴:۳۰ */
export const faDateTime = (iso: string | number) => dateFmt({ day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
export const faMonth = (iso: string | number = Date.now()) => dateFmt({ month: 'long', year: 'numeric' }).format(new Date(iso));
/** A yyyy-mm-dd day (no time zone) in words. */
export const faIsoDay = (day: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('fa-IR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })
    .formatToParts(Date.parse(day + 'T00:00:00Z')).map(x => [x.type, x.value]));
  return [p.weekday, p.day, p.month, p.year].filter(Boolean).join(' ');
};
/** A whole amount with Persian digits and thousands separators while typing ("9000" → "۹٬۰۰۰"); numInput reads it back. */
export const faGrouped = (v: string) => {
  const [int, dec] = v.split('.');
  return faDigits(int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (dec !== undefined ? '.' + dec : '')).replace(/,/g, '٬');
};

const rtf = new Intl.RelativeTimeFormat('fa-IR', { numeric: 'auto' });
/** «۲ ساعت پیش», «دیروز», «۳ روز پیش» */
export function faAgo(iso: string, now = Date.now()) {
  const s = (Date.parse(iso) - now) / 1000;
  const a = Math.abs(s);
  if (a < 60) return 'همین حالا';
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (a < 86400 * 30) return rtf.format(Math.round(s / 86400), 'day');
  if (a < 86400 * 365) return rtf.format(Math.round(s / (86400 * 30)), 'month');
  return rtf.format(Math.round(s / (86400 * 365)), 'year');
}
/** Days between two instants, rounded. */
export const daysBetween = (a: string, b: string | number = Date.now()) => Math.round(((typeof b === 'number' ? b : Date.parse(b)) - Date.parse(a)) / 86_400_000);
/** "+968 9123 4567" for display; dialling and wa.me links use the raw digits. */
export function phoneOut(p: string) {
  if (p.startsWith('968') && p.length === 11) return `+968 ${p.slice(3, 7)} ${p.slice(7)}`;
  return p ? '+' + p : '';
}
/** Persian / Arabic digits to Latin, for search across numbers typed either way. */
export const latinDigits = (s: string) => s.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
/** Lower-case, Latin digits, Arabic letter variants folded: for matching a search query. */
export const searchable = (s: string) => latinDigits(s).toLowerCase().replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
/** Today's date (yyyy-mm-dd) in the shop's time zone, so a date picked at 01:00 in Muscat is not yesterday. */
export const todayMuscat = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
/** A yyyy-mm-dd day in the Gregorian calendar, as Omani customers state their event dates: "۲۰ نوامبر ۲۰۲۶". */
export const faGregorian = (day: string) => new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(Date.parse(day.slice(0, 10) + 'T00:00:00Z'));
/** What a money field keeps while typing: Persian and Arabic digits become Latin, the Arabic decimal mark a dot,
 *  thousands separators ("1,500", "١٬٥٠٠") are dropped with anything else, the Persian slash decimal ("۱۲/۵۰۰") is a dot,
 *  and only the first dot stays ("۱٫۵" → "1.5").
 *  Parsed to a number on save. */
export const numInput = (v: string) => latinDigits(v).replace(/[,٬]/g, '').replace(/[٫/]/g, '.').replace(/[^\d.]/g, '').replace(/^(\d*\.?\d*).*$/, '$1');
/** Whole numbers only (days, counts), in any digits. */
export const intInput = (v: string) => latinDigits(v).replace(/\D/g, '');
/** Latin digits shown as Persian ones (for number fields; typing either kind works, see numInput). */
export const faDigits = (v: string) => v.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]).replace(/\./g, '٫');
