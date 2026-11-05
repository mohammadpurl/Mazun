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
  rose: { name: l('Dusty rose', 'وردي مغبر', 'گلبهی'), hex: '#B98A82' },
  navy: { name: l('Navy', 'كحلي', 'سرمه‌ای'), hex: '#1F2A4D' },
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
    type: l('Olive satin abaya', 'عباءة ساتان زيتونية', 'عبای ساتن زیتونی'), colors: [CO.olive], sizes: sizes(S5),
    d: l('An olive satin abaya with a tie waist and gold-edged cuffs.', 'عباءة ساتان زيتونية بحزام وأكمام بحواف ذهبية.', 'عبای ساتن زیتونی با کمربند و سرآستین لبه‌طلایی.'),
    f: l('Fabric and care to be confirmed by the atelier.', 'يؤكد الأتيليه القماش وطريقة العناية.', 'پارچه و نگهداری را آتلیه تأیید می‌کند.') },
  { id: 'layal', cat: 'evening', shape: 'gown', price: 240, name: l('Layal', 'ليال', 'لیال'),
    type: l('Espresso pleated gown', 'فستان بني داكن مطوي', 'پیراهن پلیسه قهوه‌ای تیره'), colors: [CO.espresso], sizes: sizes(S5),
    d: l('A long-sleeved espresso gown with a fitted waist and a fully pleated skirt.', 'فستان بني داكن بأكمام طويلة وخصر محدد وتنورة مطوية بالكامل.', 'پیراهن قهوه‌ای تیره با آستین بلند، کمر فرم‌دار و دامن پلیسه.'),
    f: l('Fabric and care to be confirmed by the atelier.', 'يؤكد الأتيليه القماش وطريقة العناية.', 'پارچه و نگهداری را آتلیه تأیید می‌کند.') },
  { id: 'noor', cat: 'abayas', shape: 'abaya', price: 145, name: l('Noor', 'نور', 'نور'),
    type: l('Ivory embroidered abaya', 'عباءة عاجية مطرزة', 'عبای عاجی گلدوزی‌شده'), colors: [CO.ivory], sizes: sizes(S5),
    d: l('A soft, textured ivory abaya with a gold embroidered front panel, cuffs and back yoke.', 'عباءة ناعمة بملمس الكتان، بلوحة أمامية وأكمام وظهر مطرزة بالذهبي.', 'عبایی نرم و بافت‌دار با گلدوزی طلایی روی جلو، سرآستین و پشت.'),
    f: l('Fabric and care to be confirmed by the atelier.', 'يؤكد الأتيليه القماش وطريقة العناية.', 'پارچه و نگهداری را آتلیه تأیید می‌کند.') },
  { id: 'reem', cat: 'evening', isNew: true, shape: 'gown', price: 210, name: l('Reem', 'ريم', 'ریم'),
    type: l('Rose lace abaya', 'عباءة وردية بدانتيل', 'عبای گلبهی توری'), colors: [CO.rose], sizes: sizes(S5, ['XL']),
    d: l('A flowing rose abaya with bell sleeves, a tie neck and a lace-edged hem.', 'عباءة وردية منسدلة بأكمام واسعة وربطة عند العنق وحاشية من الدانتيل.', 'عبای گلبهی روان با آستین‌های گشاد، پاپیون یقه و لبهٔ توری.'),
    f: l('Fabric and care to be confirmed by the atelier.', 'يؤكد الأتيليه القماش وطريقة العناية.', 'پارچه و نگهداری را آتلیه تأیید می‌کند.') },
  { id: 'salma', cat: 'atelier', shape: 'abaya', price: 285, name: l('Salma', 'سلمى', 'سلمی'),
    type: l('Black abaya with ivory trim', 'عباءة سوداء بحواف عاجية', 'عبای مشکی با لبهٔ عاجی'), colors: [CO.black], sizes: sizes(['XS', 'S', 'M', 'L']),
    d: l('A black open abaya with wide sleeves, edged in a fine ivory trim.', 'عباءة سوداء مفتوحة بأكمام واسعة وحواف عاجية رفيعة.', 'عبای مشکی جلوباز با آستین‌های گشاد و لبهٔ باریک عاجی.'),
    f: l('Fabric and care to be confirmed by the atelier.', 'يؤكد الأتيليه القماش وطريقة العناية.', 'پارچه و نگهداری را آتلیه تأیید می‌کند.') },
  { id: 'dana', cat: 'abayas', isNew: true, shape: 'abaya', price: 175, name: l('Dana', 'دانة', 'دانه'),
    type: l('Navy kimono abaya', 'عباءة كيمونو كحلية', 'عبای کیمونویی سرمه‌ای'), colors: [CO.navy], sizes: sizes(S5, ['XS']),
    d: l('A navy abaya with deep kimono sleeves and a clean open front.', 'عباءة كحلية بأكمام كيمونو عريضة وواجهة مفتوحة نظيفة.', 'عبای سرمه‌ای با آستین‌های عریض کیمونویی و جلوی باز ساده.'),
    f: l('Fabric and care to be confirmed by the atelier.', 'يؤكد الأتيليه القماش وطريقة العناية.', 'پارچه و نگهداری را آتلیه تأیید می‌کند.') },
  { id: 'hessa', cat: 'modest', isNew: true, shape: 'dress', price: 135, name: l('Hessa', 'حصة', 'حصه'),
    type: l('Navy abaya with gold trim', 'عباءة كحلية بحواف ذهبية', 'عبای سرمه‌ای با لبهٔ طلایی'), colors: [CO.navy], sizes: sizes(S5),
    d: l('A navy open abaya with wide sleeves and a fine gold trim.', 'عباءة كحلية مفتوحة بأكمام واسعة وحواف ذهبية رفيعة.', 'عبای سرمه‌ای جلوباز با آستین‌های گشاد و لبهٔ باریک طلایی.'),
    f: l('Fabric and care to be confirmed by the atelier.', 'يؤكد الأتيليه القماش وطريقة العناية.', 'پارچه و نگهداری را آتلیه تأیید می‌کند.') },
  { id: 'mazun', cat: 'modest', shape: 'kaftan', price: 128, name: l('Mazun', 'مزون', 'مزون'),
    type: l('Ivory embroidered kaftan', 'قفطان عاجي مطرز', 'کافتان عاجی گلدوزی‌شده'), colors: [CO.ivory], sizes: sizes(S5),
    d: l('An ivory kaftan with a gold embroidered front panel and matching cuffs.', 'قفطان عاجي بلوحة أمامية مطرزة بالذهبي وأكمام متناسقة.', 'کافتان عاجی با گلدوزی طلایی روی جلو و سرآستین‌های هماهنگ.'),
    f: l('Fabric and care to be confirmed by the atelier.', 'يؤكد الأتيليه القماش وطريقة العناية.', 'پارچه و نگهداری را آتلیه تأیید می‌کند.') },
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

/** Which photo in public/images/transparent belongs to which seeded garment. */
export const SEED_PHOTOS: Record<string, number> = { noor: 1, reem: 2, dana: 3, salma: 4, hessa: 5, zayna: 6, layal: 7, mazun: 8 };

/** The design's catalogue, used to seed an empty store. Accessories have no photos yet and draw a soft tile. */
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
  front: SEED_PHOTOS[s.id] ? `/images/transparent/abaya-${SEED_PHOTOS[s.id]}-front.png` : '',
  back: SEED_PHOTOS[s.id] ? `/images/transparent/abaya-${SEED_PHOTOS[s.id]}-back.png` : '',
  detail: '',
  chart: null,
  leadDays: 0,
  isNew: !!s.isNew,
  sort: i + 1,
  visible: true,
  createdAt: '2026-10-25T00:00:00.000Z',
}));
