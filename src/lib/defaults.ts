import type { Category, Colour, Garment, L10n, ProductKind, Settings, Shape, Size } from './types';

const l = (en: string, ar: string, fa: string): L10n => ({ en, ar, fa });
const empty = (): L10n => l('', '', '');

export const DEFAULT_SETTINGS: Settings = {
  brand: l('MAZUN ATELIER', 'مزون أتيليه', 'آتلیه مزون'),
  tagline: l('Contemporary abayas and evening wear, made in Oman.', 'عباءات وأزياء سهرة معاصرة، صُنعت في عُمان.', 'عبا و لباس مجلسی معاصر، ساخت عمان.'),
  ticker: l('New arrivals every week', 'وصول قطع جديدة كل أسبوع', 'هر هفته طرح‌های تازه'),
  currency: l('OMR', 'ر.ع.', 'ریال عمانی'),
  channel: 'whatsapp',
  whatsapp: '',
  telegram: '',
  instagram: '',
  originCity: l('Muscat', 'مسقط', 'مسقط'),
  prepDays: 1,
  shipDays: 2,
  bufferDays: 2,
  home: { hero: '', fabric: '', atelier: '', tryBefore: '', tryAfter: '', featuredId: null },
};

/** Fills any field missing from a stored settings object with its default. */
export function withDefaults(stored: Partial<Settings> | null | undefined): Settings {
  const s = stored ?? {};
  const l10n = (k: 'brand' | 'tagline' | 'ticker' | 'currency' | 'originCity'): L10n => ({ ...DEFAULT_SETTINGS[k], ...(s[k] ?? {}) });
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    brand: l10n('brand'),
    tagline: l10n('tagline'),
    ticker: l10n('ticker'),
    currency: l10n('currency'),
    originCity: l10n('originCity'),
    home: { ...DEFAULT_SETTINGS.home, ...(s.home ?? {}) },
  };
}

/** Size order used by the size assistant and the default size guide. */
export const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
export const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL'];
/** One size for accessories. */
export const ONE_SIZE = 'ONE';

/** Size guide used when a garment has no chart of its own (cm): bust, waist = bust − 16, hips = bust + 8, length 140 + 2 per size. */
export const DEFAULT_CHART: Record<string, { bust: number; waist: number; hips: number; length: number }> = Object.fromEntries(
  SIZE_ORDER.map((n, i) => { const bust = [82, 86, 92, 98, 104, 110][i]; return [n, { bust, waist: bust - 16, hips: bust + 8, length: 140 + i * 2 }]; }),
);

const CO: Record<string, Colour> = {
  olive: { name: l('Olive', 'زيتوني', 'زیتونی'), hex: '#6F7258' },
  espresso: { name: l('Espresso', 'بني داكن', 'قهوه‌ای تیره'), hex: '#3A302A' },
  sand: { name: l('Sand', 'رملي', 'شنی'), hex: '#D6C7B1' },
  ivory: { name: l('Ivory', 'عاجي', 'عاجی'), hex: '#ECE4D7' },
  champagne: { name: l('Champagne', 'شامبانيا', 'شامپاینی'), hex: '#C9B18E' },
  black: { name: l('Black', 'أسود', 'مشکی'), hex: '#211C19' },
  sage: { name: l('Sage', 'مريمية', 'مریمی'), hex: '#9A9C82' },
  taupe: { name: l('Taupe', 'بني رمادي', 'طوسی‌قهوه‌ای'), hex: '#8C7A68' },
  gold: { name: l('Gold', 'ذهبي', 'طلایی'), hex: '#C2A15B' },
  pearl: { name: l('Pearl', 'لؤلؤي', 'مرواریدی'), hex: '#EDE8DF' },
};

export const SEED_CATEGORIES: Category[] = [
  { id: 'abayas', sort: 1, visible: true, image: '', name: l('Signature Abayas', 'العباءات المميزة', 'عباهای امضادار'),
    description: l('The house cut, in satin, crepe and fine wool.', 'قصّة الدار، بالساتان والكريب والصوف الناعم.', 'برش خاص آتلیه، در ساتن، کرپ و پشم لطیف.') },
  { id: 'evening', sort: 2, visible: true, image: '', name: l('Evening Wear', 'أزياء السهرة', 'لباس شب'),
    description: l('Gowns and capes for weddings and late dinners.', 'فساتين وكابات للأعراس وسهرات العشاء.', 'پیراهن و شنل برای عروسی و شام‌های شبانه.') },
  { id: 'modest', sort: 3, visible: true, image: '', name: l('Modern Modest', 'الحشمة العصرية', 'پوشیدهٔ امروزی'),
    description: l('Easy layers for the working week.', 'طبقات مريحة لأيام العمل.', 'لایه‌های راحت برای روزهای کاری.') },
  { id: 'atelier', sort: 4, visible: true, image: '', name: l('Atelier Exclusives', 'حصريات الأتيليه', 'انحصاری آتلیه'),
    description: l('Hand-embroidered pieces, made in small numbers in Muscat.', 'قطع مطرزة يدوياً، تُصنع بكميات محدودة في مسقط.', 'قطعه‌های دست‌دوزی‌شده، در تعداد محدود در مسقط.') },
];

const S5 = ['XS', 'S', 'M', 'L', 'XL'];
const sizes = (list: string[], out: string[] = []): Size[] => list.map(n => ({ n, ok: !out.includes(n) }));

interface SeedSpec {
  id: string; kind?: ProductKind; cat?: string | null; isNew?: boolean; shape?: Shape; price: number;
  name: L10n; type: L10n; colors: Colour[]; sizes: Size[]; d?: L10n; f?: L10n; note?: L10n;
}

const SPECS: SeedSpec[] = [
  { id: 'zayna', cat: 'abayas', shape: 'abaya', price: 168, name: l('Zayna', 'زينة', 'زینه'),
    type: l('Olive satin abaya', 'عباءة ساتان زيتونية', 'عبای ساتن زیتونی'), colors: [CO.olive, CO.espresso, CO.sand], sizes: sizes(S5),
    d: l('Fluid duchess satin cut in a clean A-line, with a soft dropped shoulder and hand-finished cuffs. Falls just above the floor.',
      'ساتان دوتشيس منسدل بقصّة A نظيفة، مع كتف منسدل ناعم وأكمام منتهية يدوياً. يصل إلى ما فوق الأرض بقليل.',
      'ساتن دوشس روان با برش A تمیز، شانهٔ افتادهٔ نرم و سرآستین‌های دست‌دوز. کمی بالاتر از زمین می‌ایستد.'),
    f: l('Silk-blend duchess satin, fully lined. Dry clean only.', 'ساتان دوتشيس بمزيج الحرير، مبطّن بالكامل. تنظيف جاف فقط.', 'ساتن دوشس با ترکیب ابریشم، کاملاً آستردار. فقط خشک‌شویی.') },
  { id: 'layal', cat: 'evening', shape: 'gown', price: 240, name: l('Layal', 'ليال', 'لیال'),
    type: l('Espresso evening gown', 'فستان سهرة بني داكن', 'پیراهن شب قهوه‌ای تیره'), colors: [CO.espresso, CO.olive], sizes: sizes(S5),
    d: l('Bias-cut crêpe-back satin with a draped neckline and long fitted sleeves.', 'ساتان بقصّة مائلة مع ياقة منسدلة وأكمام طويلة ضيّقة.', 'ساتن پشت‌کرپ با برش اریب، یقهٔ آبشاری و آستین‌های بلند و جذب.'),
    f: l('Crêpe-back satin, silk lining. Dry clean only.', 'ساتان بظهر كريب وبطانة حرير. تنظيف جاف فقط.', 'ساتن پشت‌کرپ با آستر ابریشم. فقط خشک‌شویی.') },
  { id: 'noor', cat: 'abayas', shape: 'abaya', price: 145, name: l('Noor', 'نور', 'نور'),
    type: l('Ivory crepe abaya', 'عباءة كريب عاجية', 'عبای کرپ عاجی'), colors: [CO.ivory, CO.sand], sizes: sizes(S5),
    d: l('Matte crepe with pleated bishop sleeves and a concealed placket. Light enough for warm evenings.', 'كريب مطفأ بأكمام واسعة مطوية وأزرار مخفية. خفيفة بما يكفي للأمسيات الدافئة.', 'کرپ مات با آستین‌های پفی پلیسه و دکمه‌های مخفی. آن‌قدر سبک که برای عصرهای گرم مناسب است.'),
    f: l('Japanese crepe. Cool hand wash.', 'كريب ياباني. غسيل يدوي بماء بارد.', 'کرپ ژاپنی. شست‌وشوی دستی با آب سرد.') },
  { id: 'reem', cat: 'evening', isNew: true, shape: 'gown', price: 210, name: l('Reem', 'ريم', 'ریم'),
    type: l('Champagne cape dress', 'فستان بكاب شامبانيا', 'پیراهن شنل‌دار شامپاینی'), colors: [CO.champagne, CO.ivory], sizes: sizes(S5, ['XL']),
    d: l('A column dress with a floating chiffon cape that falls from the shoulders.', 'فستان مستقيم مع كاب شيفون ينسدل من الكتفين.', 'پیراهن ستونی با شنل حریر که از شانه‌ها رها می‌شود.'),
    f: l('Satin body, silk chiffon cape. Dry clean only.', 'جسم ساتان وكاب شيفون حرير. تنظيف جاف فقط.', 'بدنهٔ ساتن و شنل شیفون ابریشم. فقط خشک‌شویی.') },
  { id: 'salma', cat: 'atelier', shape: 'abaya', price: 285, name: l('Salma', 'سلمى', 'سلمی'),
    type: l('Embroidered organza abaya', 'عباءة أورجانزا مطرزة', 'عبای ارگانزای گلدوزی‌شده'), colors: [CO.black], sizes: sizes(['XS', 'S', 'M', 'L']),
    d: l('Black silk organza over crepe, with hand-embroidered tone-on-tone sleeves. Made in Muscat in small numbers.', 'أورجانزا حرير سوداء فوق الكريب، بأكمام مطرزة يدوياً بلون واحد. تُصنع في مسقط بكميات محدودة.', 'ارگانزای ابریشم مشکی روی کرپ، با آستین‌های دست‌دوزی هم‌رنگ. در تعداد محدود در مسقط دوخته می‌شود.'),
    f: l('Silk organza over crepe; hand embroidery. Specialist clean.', 'أورجانزا حرير فوق الكريب؛ تطريز يدوي. تنظيف متخصص.', 'ارگانزای ابریشم روی کرپ؛ دوخت دستی. شست‌وشوی تخصصی.') },
  { id: 'dana', cat: 'abayas', isNew: true, shape: 'abaya', price: 175, name: l('Dana', 'دانة', 'دانه'),
    type: l('Taupe trench abaya', 'عباءة ترنش بنية رمادية', 'عبای بارانی طوسی‌قهوه‌ای'), colors: [CO.taupe, CO.espresso], sizes: sizes(S5, ['XS']),
    d: l('Trench-inspired gabardine with a storm flap, belted waist and deep cuffs.', 'عباءة من الجبردين مستوحاة من الترنش، بحزام وأكمام عريضة.', 'گاباردین با الهام از بارانی، با لبهٔ سرشانه، کمربند و سرآستین‌های پهن.'),
    f: l('Cotton gabardine. Dry clean.', 'جبردين قطني. تنظيف جاف.', 'گاباردین نخی. خشک‌شویی.') },
  { id: 'hessa', cat: 'modest', isNew: true, shape: 'dress', price: 135, name: l('Hessa', 'حصة', 'حصه'),
    type: l('Sage wrap dress', 'فستان ملفوف بلون المريمية', 'پیراهن جلوبسته مریمی'), colors: [CO.sage, CO.taupe], sizes: sizes(S5),
    d: l('A long-sleeved wrap in washed crepe with a tie waist and full-length skirt.', 'فستان ملفوف بأكمام طويلة من الكريب المغسول مع حزام وتنورة بطول كامل.', 'پیراهن جلوبسته با آستین بلند از کرپ شسته، با بند کمر و دامن بلند.'),
    f: l('Washed crepe. Machine wash cold.', 'كريب مغسول. غسيل آلي بماء بارد.', 'کرپ شسته. ماشین‌لباسشویی با آب سرد.') },
  { id: 'mazun', cat: 'modest', shape: 'kaftan', price: 128, name: l('Mazun', 'مزون', 'مزون'),
    type: l('Sand linen kaftan', 'قفطان كتان رملي', 'کافتان کتان شنی'), colors: [CO.sand, CO.ivory], sizes: sizes(S5),
    d: l('Breathable Irish linen with wide sleeves and a soft band collar.', 'كتان إيرلندي يسمح بمرور الهواء، بأكمام واسعة وياقة ناعمة.', 'کتان ایرلندی خنک با آستین‌های گشاد و یقهٔ نواری نرم.'),
    f: l('100% linen. Machine wash cold.', 'كتان ١٠٠٪. غسيل آلي بماء بارد.', 'کتان ۱۰۰٪. ماشین‌لباسشویی با آب سرد.') },
  // Accessories the stylist pairs with a garment.
  { id: 'shayla-silk', kind: 'scarf', price: 38, name: l('Silk georgette shayla', 'شيلة جورجيت حرير', 'شال جورجت ابریشم'), type: l('Shayla', 'شيلة', 'شال'), colors: [CO.champagne], sizes: sizes(['ONE']),
    note: l('Champagne lifts the base colour and softens the sheen at the face.', 'الشامبانيا تُضيء اللون الأساسي وتليّن اللمعة قرب الوجه.', 'شامپاینی رنگ پایه را روشن‌تر و درخشش کنار صورت را نرم‌تر می‌کند.') },
  { id: 'shayla-jersey', kind: 'scarf', price: 26, name: l('Modal jersey shayla', 'شيلة جيرسيه مودال', 'شال ژرسه مودال'), type: l('Shayla', 'شيلة', 'شال'), colors: [CO.espresso], sizes: sizes(['ONE']),
    note: l('Espresso jersey grounds the look and stays put through a long day.', 'الجيرسيه البني يُرسّخ الإطلالة ويثبت طوال اليوم.', 'ژرسهٔ قهوه‌ای تیره ظاهر را متعادل می‌کند و تمام روز سر جایش می‌ماند.') },
  { id: 'bag-top', kind: 'bag', price: 145, name: l('Structured top-handle bag', 'حقيبة بمقبض علوي', 'کیف دسته‌دار فرم‌دار'), type: l('Bag', 'حقيبة', 'کیف'), colors: [CO.sand], sizes: sizes(['ONE']),
    note: l('Sand calf leather keeps the silhouette architectural.', 'جلد العجل الرملي يحافظ على القَصّة الهندسية.', 'چرم گوسالهٔ شنی خطوط لباس را منظم و معمارانه نگه می‌دارد.') },
  { id: 'bag-clutch', kind: 'bag', price: 98, name: l('Satin evening clutch', 'حقيبة سهرة ساتان', 'کیف دستی شب ساتن'), type: l('Bag', 'حقيبة', 'کیف'), colors: [CO.champagne], sizes: sizes(['ONE']),
    note: l('A champagne clutch with a brushed-gold clasp — small enough to keep the line clean.', 'حقيبة شامبانيا بمشبك ذهبي مصقول — صغيرة لتبقى الخطوط نظيفة.', 'کیف دستی شامپاینی با قفل طلایی مات؛ آن‌قدر کوچک که خطوط لباس شلوغ نشود.') },
  { id: 'hoops-gold', kind: 'jewel', price: 64, name: l('Fine gold hoops', 'أقراط ذهبية رفيعة', 'گوشوارهٔ حلقه‌ای طلای ظریف'), type: l('Jewellery', 'مجوهرات', 'جواهر'), colors: [CO.gold], sizes: sizes(['ONE']),
    note: l('Quiet gold that shows just beneath the shayla edge.', 'ذهب هادئ يظهر تحت طرف الشيلة.', 'طلای آرامی که درست زیر لبهٔ شال پیداست.') },
  { id: 'pearl-drops', kind: 'jewel', price: 78, name: l('Pearl drop earrings', 'أقراط لؤلؤ متدلية', 'گوشوارهٔ آویز مروارید'), type: l('Jewellery', 'مجوهرات', 'جواهر'), colors: [CO.pearl], sizes: sizes(['ONE']),
    note: l('A single pearl catches the light at evening events.', 'لؤلؤة واحدة تلتقط الضوء في المناسبات المسائية.', 'یک مروارید تنها در مهمانی‌های شب نور را می‌گیرد.') },
  { id: 'mule-block', kind: 'shoes', price: 89, name: l('Leather block-heel mule', 'حذاء ميول بكعب عريض', 'صندل چرمی پاشنه‌پهن'), type: l('Shoes', 'حذاء', 'کفش'), colors: [CO.sand], sizes: sizes(['36', '37', '38', '39', '40', '41']),
    note: l('A low, steady heel that clears the hem without competing with it.', 'كعب منخفض وثابت يتجاوز الحاشية دون أن ينافسها.', 'پاشنهٔ کوتاه و محکمی که از زیر لبهٔ لباس بیرون می‌آید و با آن رقابت نمی‌کند.') },
  { id: 'pump-satin', kind: 'shoes', price: 112, name: l('Satin pointed pump', 'حذاء ساتان مدبب', 'کفش ساتن نوک‌تیز'), type: l('Shoes', 'حذاء', 'کفش'), colors: [CO.champagne], sizes: sizes(['36', '37', '38', '39', '40', '41']),
    note: l('A pointed toe shows past the hem and lengthens the line.', 'مقدمة مدببة تظهر من تحت الحاشية وتُطيل الخط.', 'نوک تیز کفش از زیر لبهٔ لباس پیدا می‌شود و قامت را کشیده‌تر نشان می‌دهد.') },
];

/** The design's catalogue, used to seed an empty store. No photos: the shop draws silhouettes until images are uploaded. */
export const SEED_GARMENTS: Garment[] = SPECS.map((s, i) => ({
  id: s.id,
  kind: s.kind ?? 'garment',
  categoryId: s.kind ? null : s.cat ?? null,
  name: s.name,
  type: s.type,
  description: s.d ?? empty(),
  fabric: s.f ?? empty(),
  note: s.note ?? empty(),
  price: s.price,
  salePrice: null,
  colors: s.colors,
  sizes: s.sizes,
  shape: s.shape ?? 'abaya',
  front: '',
  back: '',
  detail: '',
  chart: null,
  leadDays: 0,
  isNew: !!s.isNew,
  sort: i + 1,
  visible: true,
  createdAt: '2026-10-25T00:00:00.000Z',
}));
