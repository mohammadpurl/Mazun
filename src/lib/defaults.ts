import type { Category, Colour, Garment, L10n, ProductKind, Settings, Shape, Size } from './types';

const l = (en: string, ar: string, fa: string): L10n => ({ en, ar, fa });
const empty = (): L10n => l('', '', '');

export const DEFAULT_SETTINGS: Settings = {
  brand: l('MAZUN ATELIER', 'مزون أتيليه', 'آتلیه مزون'),
  tagline: l('Abaya boutique · Oman', 'بوتيك عباءات · عُمان', 'بوتیک عبا · عمان'),
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
  monthlyGoal: 0,
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
  silver: { name: l('Silver', 'فضي', 'نقره‌ای'), hex: '#C9CCD1' },
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

const sizes = (list: string[], out: string[] = []): Size[] => list.map(n => ({ n, ok: !out.includes(n) }));

interface SeedSpec {
  id: string; kind?: ProductKind; cat?: string | null; isNew?: boolean; shape?: Shape; price: number;
  name: L10n; type: L10n; colors: Colour[]; sizes: Size[]; d?: L10n; f?: L10n; note?: L10n;
}

const SPECS: SeedSpec[] = [
  // The garments follow what Omani women wear: talli braid, Dhofari velvet, kandoura and sirwal, silver-jewellery motifs.
  { id: 'zayna', cat: 'abayas', shape: 'abaya', price: 168, name: l('Olive Belted Abaya', 'عباءة زيتونية بحزام', 'عبای زیتونی کمربنددار'),
    type: l('Belted abaya', 'عباءة بحزام', 'عبای کمربنددار'), colors: [{ name: l('Olive', 'زيتوني', 'زیتونی'), hex: '#5F6336' }], sizes: sizes(['S', 'M', 'L', 'XL']),
    d: l('A wrap abaya closed with a soft self belt. The belt ends are tipped in hand-engraved brass, and the cuffs carry a small tonal motif.',
      'عباءة ملفوفة تُغلق بحزام من القماش نفسه، وطرفا الحزام من النحاس الأصفر المنقوش يدوياً، وعلى الأكمام نقش صغير بلون القماش.',
      'عبایی جلوبسته که با کمربندی از همان پارچه بسته می‌شود. سرهای کمربند از برنج قلم‌زنی‌شده‌اند و روی سرآستین‌ها نقشی کوچک و هم‌رنگ دوخته شده.'),
    f: l('Satin-back crepe', 'كريب بظهر ساتان', 'کرپ ساتن‌پشت') },
  { id: 'layal', cat: 'evening', shape: 'gown', price: 240, name: l('Garnet Dhofari Velvet Gown', 'ثوب ظفاري مخملي عقيقي', 'پیراهن مخمل ظفاری یاقوتی'),
    type: l('Velvet gown', 'ثوب مخملي', 'پیراهن مخمل'), colors: [{ name: l('Garnet', 'عقيقي', 'یاقوتی'), hex: '#7A1420' }], sizes: sizes(['S', 'M', 'L', 'XL']),
    d: l('Our reading of the Dhofari abu thail: ankle length at the front, a long train at the back, fine gold zari at the neck, the front and the cuffs.',
      'قراءتنا لثوب أبو ذيل الظفاري: يصل إلى الكاحل من الأمام وينسدل بذيل طويل من الخلف، مع زري ذهبي ناعم على الرقبة والصدر والأكمام.',
      'برداشت ما از لباس «ابوذیل» ظفار: جلو تا مچ پا و پشت با دنباله‌ای بلند، با زری‌دوزی طلایی ظریف دور یقه، جلوی لباس و سرآستین‌ها.'),
    f: l('Silk velvet', 'مخمل حريري', 'مخمل ابریشمی') },
  { id: 'noor', cat: 'abayas', shape: 'abaya', price: 145, name: l('Ivory Silver-Thread Abaya', 'عباءة عاجية بتطريز فضي', 'عبای عاجی با دوخت نقره‌ای'),
    type: l('Embroidered abaya', 'عباءة مطرزة', 'عبای گلدوزی‌شده'), colors: [{ name: l('Ivory', 'عاجي', 'عاجی'), hex: '#E8DEC9' }], sizes: sizes(['S', 'M', 'L', 'XL']),
    d: l('A closed abaya with one band of silver-thread embroidery down the front. The small triangles and dots come from Omani silver jewellery.',
      'عباءة مغلقة يزيّنها شريط واحد من التطريز بالخيط الفضي على الأمام، ومثلثاتها ونقاطها الصغيرة مأخوذة من الحليّ الفضية العُمانية.',
      'عبایی جلوبسته با یک نوار گلدوزی نخ نقره‌ای در جلو. مثلث‌ها و نقطه‌های ریزش از جواهرات نقرهٔ عمانی آمده‌اند.'),
    f: l('Silk crepe', 'كريب حريري', 'کرپ ابریشم') },
  { id: 'reem', cat: 'evening', isNew: true, shape: 'kaftan', price: 210, name: l('Rose Talli Kaftan', 'قفطان وردي بالتلي', 'کفتان گلبهی با تلی'),
    type: l('Kaftan', 'قفطان', 'کفتان'), colors: [{ name: l('Dusty rose', 'وردي مغبر', 'گلبهی'), hex: '#BF857B' }], sizes: sizes(['S', 'M', 'L', 'XL']),
    d: l('A flowing kaftan with a soft self belt, edged in hand-woven talli, silver and soft gold, at the neck, down the front and at the sleeves: the braid Omani women wear for celebrations.',
      'قفطان منساب بحزام من القماش نفسه، بحواف من التلي المنسوج يدوياً بالفضي والذهبي الناعم عند الرقبة وعلى طول الأمام والأكمام، وهو التلي الذي تتزيّن به المرأة العُمانية في المناسبات.',
      'کفتانی روان با کمربندی از همان پارچه که دور یقه، جلوی لباس و سرآستین‌هایش با «تلی» دست‌باف نقره‌ای و طلایی ملایم تمام شده؛ همان نواری که زنان عمانی در جشن‌ها می‌پوشند.'),
    f: l('Silk crepe', 'كريب حريري', 'کرپ ابریشم') },
  { id: 'salma', cat: 'atelier', shape: 'abaya', price: 285, name: l('Black Talli Bisht Abaya', 'عباءة بشت سوداء بالتلي', 'عبای بشتی مشکی با تلی'),
    type: l('Bisht abaya', 'عباءة بشت', 'عبای بشتی'), colors: [{ name: l('Black', 'أسود', 'مشکی'), hex: '#151313' }], sizes: sizes(['S', 'M', 'L', 'XL']),
    d: l('A bisht-cut open abaya over its own slip, edged in gold talli, with one line of talli down the back.',
      'عباءة مفتوحة بقصّة البشت فوق فستان داخلي، بحواف من التلي الذهبي وخطّ واحد من التلي على الظهر.',
      'عبای جلوباز با برش بِشت روی پیراهن زیرِ خودش، با حاشیهٔ تلی طلایی و یک خط تلی در پشت.'),
    f: l('Matte crepe', 'كريب مطفي', 'کرپ مات') },
  { id: 'dana', cat: 'abayas', isNew: true, shape: 'abaya', price: 175, name: l('Midnight Cape-Sleeve Abaya', 'عباءة كحلية بأكمام منسدلة', 'عبای سرمه‌ای با آستین شنلی'),
    type: l('Cape-sleeve abaya', 'عباءة بأكمام منسدلة', 'عبای آستین‌شنلی'), colors: [{ name: l('Midnight navy', 'كحلي داكن', 'سرمه‌ای تیره'), hex: '#20243F' }], sizes: sizes(['S', 'M', 'L', 'XL']),
    d: l('Cape sleeves fall from the shoulder to the hip. Tone-on-tone embroidery runs across the shoulders and down the front.',
      'أكمام على هيئة كاب تنسدل من الكتف إلى الورك، وتطريز بلون القماش نفسه على الكتفين وعلى طول الأمام.',
      'آستین‌های شنلی از شانه تا باسن می‌افتند. گلدوزی هم‌رنگ روی شانه‌ها و لبه‌های جلو کار شده.'),
    f: l('Fluid matte crepe', 'كريب مطفي منساب', 'کرپ مات روان') },
  { id: 'hessa', cat: 'modest', isNew: true, shape: 'dress', price: 135, name: l('Sage Kandoura & Sirwal Set', 'طقم كندورة وسروال أخضر مريمي', 'ست کندوره و سروال سبز مریم‌گلی'),
    type: l('Kandoura and sirwal', 'كندورة وسروال', 'کندوره و سروال'), colors: [{ name: l('Sage', 'أخضر مريمي', 'سبز مریم‌گلی'), hex: '#8E9479' }], sizes: sizes(['S', 'M', 'L', 'XL']),
    d: l('The Omani kandoura and sirwal, cut for today: a knee-length tunic over wide trousers, with talli at the neck, the cuffs and the ankles.',
      'الكندورة والسروال العُمانيان بقصّة اليوم: ثوب يصل إلى الركبة فوق سروال واسع، مع التلي عند الرقبة والأكمام والكاحلين.',
      'کندوره و سروال عمانی با برش امروزی: پیراهنی تا زانو روی شلوار گشاد، با تلی دور یقه، سرآستین‌ها و مچ پا.'),
    f: l('Crepe', 'كريب', 'کرپ') },
  { id: 'mazun', cat: 'modest', shape: 'abaya', price: 128, name: l('Champagne Diamond-Band Abaya', 'عباءة شامبانيا بشريط معيّنات', 'عبای شامپاینی با نوار لوزی'),
    type: l('Kimono-sleeve abaya', 'عباءة بأكمام كيمونو', 'عبای آستین‌کیمونویی'), colors: [{ name: l('Champagne', 'شامبانيا', 'شامپاینی'), hex: '#C9B18E' }], sizes: sizes(['S', 'M', 'L', 'XL']),
    d: l('A light open abaya with kimono sleeves. A band of diamond motifs in ivory and gold runs round the hem and the sleeves, with a fine trim down the front.',
      'عباءة مفتوحة خفيفة بأكمام كيمونو، يدور حول حاشيتها وأكمامها شريط من نقوش المعيّنات بالعاجي والذهبي، مع حافة رفيعة على طول الأمام.',
      'عبای جلوباز و سبک با آستین کیمونویی. نواری از نقش لوزی به رنگ عاجی و طلایی دور دامن و سرآستین‌ها می‌چرخد و لبهٔ جلو حاشیه‌ای ظریف دارد.'),
    f: l('Brushed linen and silk', 'كتان وحرير مصقول', 'کتان و ابریشم برس‌خورده') },
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
  // Omani silver, after the jewellery women here have worn for generations.
  { id: 'hirz-silver', kind: 'jewel', price: 120, name: l('Omani silver hirz necklace', 'قلادة حرز فضية عُمانية', 'گردنبند حرز نقرهٔ عمانی'), type: l('Jewellery', 'مجوهرات', 'جواهر'), colors: [CO.silver], sizes: sizes(['ONE']),
    note: l('A hand-engraved silver amulet case with little bells, the hirz Omani women have worn for generations.', 'علبة حرز فضية منقوشة يدوياً بأجراس صغيرة، كما ترتديها المرأة العُمانية منذ أجيال.', 'جعبهٔ حرز نقره‌ای قلم‌زنی‌شده با زنگوله‌های کوچک؛ همان حرزی که زنان عمانی نسل‌ها پوشیده‌اند.') },
  { id: 'bangles-silver', kind: 'jewel', price: 85, name: l('Engraved silver bangles, set of three', 'أساور فضية منقوشة، طقم من ثلاث', 'النگوهای نقرهٔ منقوش، ست سه‌تایی'), type: l('Jewellery', 'مجوهرات', 'جواهر'), colors: [CO.silver], sizes: sizes(['ONE']),
    note: l('Three stacked bangles with diamond and flower engraving, in the manner of traditional Omani silverwork.', 'ثلاث أساور متراصّة بنقوش المعيّنات والزهور على طراز الفضيات العُمانية التقليدية.', 'سه النگوی روی هم با نقش لوزی و گل، به سبک نقره‌کاری سنتی عمان.') },
];

/** Seeded garments with a front and back cut-out in public/images/garments/<id>-front.webp and -back.webp. */
export const SEED_PHOTOS = new Set(['noor', 'reem', 'dana', 'salma', 'hessa', 'zayna', 'layal', 'mazun']);
/** Seeded accessories with a cut-out in public/images/accessories/<id>.webp. */
export const SEED_ACCESSORY_PHOTOS = new Set(['shayla-silk', 'shayla-jersey', 'bag-top', 'bag-clutch', 'hoops-gold', 'pearl-drops', 'mule-block', 'pump-satin', 'hirz-silver', 'bangles-silver']);

/** The design's catalogue, used to seed an empty store. */
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
  front: SEED_PHOTOS.has(s.id) ? `/images/garments/${s.id}-front.webp` : SEED_ACCESSORY_PHOTOS.has(s.id) ? `/images/accessories/${s.id}.webp` : '',
  back: SEED_PHOTOS.has(s.id) ? `/images/garments/${s.id}-back.webp` : '',
  detail: '',
  wornFront: SEED_PHOTOS.has(s.id) ? `/images/worn/${s.id}-front.webp` : '',
  wornBack: SEED_PHOTOS.has(s.id) ? `/images/worn/${s.id}-back.webp` : '',
  images: [],
  chart: null,
  leadDays: 0,
  isNew: !!s.isNew,
  sort: i + 1,
  visible: true,
  createdAt: '2026-10-25T00:00:00.000Z',
}));
