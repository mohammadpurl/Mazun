import type { Lang } from '@/lib/types';

const fa = {
  hint: 'روی هر عبایا بروید یا ضربه بزنید؛ برای دیدن همه، رگال را بکشید', all: 'همه', empty: 'فعلاً لباسی برای نمایش نیست.',
  flip: 'دیدن پشت و روی لباس', sizes: 'سایز', order: 'سفارش', pick: 'لطفاً یک سایز انتخاب کنید', of: 'از', soldout: 'همه سایزها تمام شده',
  sale: 'تخفیف', prev: 'قبلی', next: 'بعدی', close: 'بستن',
  formTitle: 'مشخصات برای ثبت سفارش', name: 'نام و نام خانوادگی', phone: 'شماره موبایل (با کد کشور)', city: 'شهر', address: 'آدرس', note: 'توضیحات (اختیاری)',
  eventDate: 'تاریخ مناسبت (اختیاری)', submit: 'ثبت سفارش', sending: 'در حال ثبت…', cancel: 'انصراف',
  eName: 'نام را وارد کنید', ePhone: 'شماره موبایل معتبر وارد کنید', eSold: 'این سایز همین حالا تمام شد؛ سایز دیگری انتخاب کنید',
  eGone: 'این لباس دیگر موجود نیست', eRate: 'تعداد سفارش‌ها زیاد بود؛ چند دقیقه بعد دوباره امتحان کنید', eNet: 'ثبت سفارش انجام نشد؛ دوباره تلاش کنید',
  doneTitle: (n: string) => `سفارش شمارهٔ ${n} ثبت شد`, doneText: 'برای نهایی کردن، پیام آماده را برای ما بفرستید.',
  sendWa: 'ارسال در واتس‌اپ', sendTg: 'ارسال در تلگرام', sendIg: 'کپی پیام و باز کردن اینستاگرام', noChannel: 'به‌زودی با شما تماس می‌گیریم.',
  copied: 'پیام کپی شد؛ در دایرکت پیست کنید', newOrder: 'سفارش دیگر',
  tools: {
    size: 'راهنمای سایز', tryon: 'پرو مجازی', style: 'راهنمای استایل', arrive: 'زمان رسیدن',
    bust: 'دور سینه', waist: 'دور کمر', hips: 'دور باسن', length: 'قد لباس', cm: 'سانتی‌متر', sz: 'سایز',
    h: 'قد شما (cm)', w: 'وزن شما (kg)', photoOpt: 'عکس قدی (اختیاری، برای دقت بیشتر)', find: 'سایز مناسب من چیست؟',
    your: 'سایز پیشنهادی', fillHW: 'قد و وزن را وارد کنید', soldOut: 'این سایز فعلاً موجود نیست؛ نزدیک‌ترین موجود:', noneLeft: 'هیچ سایزی موجود نیست.',
    long: 'طول لباس برای قد شما کمی بلند است و ممکن است نیاز به کوتاه کردن داشته باشد.', short: 'طول لباس برای قد شما کمی کوتاه است.', okLen: 'طول لباس برای قد شما مناسب است.',
    basis: 'بر پایهٔ قد و وزن شما', thinking: 'در حال بررسی…', err: 'خطا در ارتباط با هوش مصنوعی؛ دوباره تلاش کنید.',
    upl: 'یک عکس قدی و روبه‌رو از خودتان انتخاب کنید', see: 'لباس را روی من نشان بده',
    tryNote: 'پیش‌نمایش ساده است؛ با اتصال هوش مصنوعی، لباس واقعی روی بدن شما قرار می‌گیرد. عکس شما ذخیره نمی‌شود.', tryNoteAi: 'عکس شما فقط برای ساخت همین تصویر فرستاده می‌شود و ذخیره نمی‌شود.',
    occ: 'مناسبت', daily: 'روزمره', work: 'محل کار', party: 'مهمانی', travel: 'سفر', getStyle: 'راهنمایی استایل بگیر',
    evDate: 'تاریخ مناسبت (مهمانی، سفر…)', calc: 'بهترین زمان سفارش را حساب کن', orderBy: 'حداکثر تا این تاریخ سفارش دهید',
    ifToday: 'اگر امروز سفارش دهید، حدود این تاریخ می‌رسد', tooLate: 'تا آن تاریخ نمی‌رسد؛ زودترین رسیدن:', tight: 'زمان کم است؛ همین امروز سفارش دهید.', good: 'زمان کافی دارید.', pickDate: 'یک تاریخ انتخاب کنید',
    tips: {
      daily: ['رنگ شال را هم‌خانوادهٔ رنگ عبا انتخاب کنید تا ظاهر یکدست شود.', 'کفش و کیف ساده و هم‌رنگ، جلوه‌ای مرتب می‌دهد.', 'یک اکسسوری کوچک (ساعت یا گردنبند ظریف) کافی است.'],
      work: ['شال ساده و مات بپوشید.', 'کیف دستی ساختارمند و کفش بسته انتخاب کنید.', 'از اکسسوری درشت پرهیز کنید.'],
      party: ['شال ابریشمی یا ساتن با رنگ متضاد جلوه می‌دهد.', 'کیف دستی کوچک و جواهر طلایی یا نقره‌ای اضافه کنید.', 'کمربند ظریف روی عبای ساده فرم بدن را زیبا می‌کند.'],
      travel: ['پارچه‌های ضدچروک و رنگ‌های تیره عملی‌ترند.', 'کفش راحت و کیف ضدسرقت همراه ببرید.', 'یک شال اضافه برای هوای متغیر داشته باشید.'],
    },
  },
};

export type Strings = typeof fa;

const ar: Strings = {
  hint: 'مرّر أو المس أي عباية؛ اسحب الشماعة لرؤية الجميع', all: 'الكل', empty: 'لا توجد قطع للعرض حالياً.',
  flip: 'عرض الوجه الآخر', sizes: 'المقاس', order: 'اطلب الآن', pick: 'يرجى اختيار مقاس', of: 'من', soldout: 'جميع المقاسات نفدت',
  sale: 'خصم', prev: 'السابق', next: 'التالي', close: 'إغلاق',
  formTitle: 'بيانات الطلب', name: 'الاسم الكامل', phone: 'رقم الجوال (مع رمز الدولة)', city: 'المدينة', address: 'العنوان', note: 'ملاحظات (اختياري)',
  eventDate: 'تاريخ المناسبة (اختياري)', submit: 'تأكيد الطلب', sending: 'جارٍ الإرسال…', cancel: 'إلغاء',
  eName: 'يرجى إدخال الاسم', ePhone: 'يرجى إدخال رقم جوال صحيح', eSold: 'نفد هذا المقاس للتو؛ اختر مقاساً آخر',
  eGone: 'هذه القطعة لم تعد متوفرة', eRate: 'طلبات كثيرة؛ حاول بعد دقائق', eNet: 'تعذّر إرسال الطلب؛ حاول مجدداً',
  doneTitle: (n: string) => `تم تسجيل الطلب رقم ${n}`, doneText: 'لإتمام الطلب أرسل لنا الرسالة الجاهزة.',
  sendWa: 'إرسال عبر واتساب', sendTg: 'إرسال عبر تيليجرام', sendIg: 'نسخ الرسالة وفتح إنستغرام', noChannel: 'سنتواصل معك قريباً.',
  copied: 'تم نسخ الرسالة، الصقها في المحادثة', newOrder: 'طلب آخر',
  tools: {
    size: 'دليل المقاسات', tryon: 'قياس افتراضي', style: 'دليل الأناقة', arrive: 'موعد الوصول',
    bust: 'محيط الصدر', waist: 'محيط الخصر', hips: 'محيط الورك', length: 'طول العباءة', cm: 'سم', sz: 'المقاس',
    h: 'طولك (سم)', w: 'وزنك (كغ)', photoOpt: 'صورة كاملة (اختياري لدقة أعلى)', find: 'ما مقاسي المناسب؟',
    your: 'المقاس المقترح', fillHW: 'أدخل الطول والوزن', soldOut: 'هذا المقاس غير متوفر؛ أقرب مقاس متوفر:', noneLeft: 'لا يوجد مقاس متوفر.',
    long: 'الطول أطول قليلاً من طولك وقد يحتاج إلى تقصير.', short: 'الطول أقصر قليلاً من المناسب لطولك.', okLen: 'الطول مناسب لطولك.',
    basis: 'بناءً على طولك ووزنك', thinking: 'جارٍ التحليل…', err: 'تعذّر الاتصال بالذكاء الاصطناعي، حاول مجدداً.',
    upl: 'اختر صورة كاملة من الأمام', see: 'أرني العباءة عليّ',
    tryNote: 'معاينة مبسطة؛ عند ربط الذكاء الاصطناعي تظهر العباءة الحقيقية على جسمك. لا نحفظ صورتك.', tryNoteAi: 'تُرسل صورتك لإنشاء هذه الصورة فقط ولا نحفظها.',
    occ: 'المناسبة', daily: 'يومي', work: 'العمل', party: 'حفلة', travel: 'سفر', getStyle: 'اقتراحات التنسيق',
    evDate: 'تاريخ المناسبة', calc: 'احسب أفضل موعد للطلب', orderBy: 'اطلب قبل هذا التاريخ',
    ifToday: 'إذا طلبت اليوم فسيصل تقريباً في', tooLate: 'لن يصل في الوقت؛ أقرب وصول:', tight: 'الوقت ضيق؛ اطلب اليوم.', good: 'لديك وقت كافٍ.', pickDate: 'اختر تاريخاً',
    tips: {
      daily: ['اختاري وشاحاً من درجة لون العباءة لمظهر متناسق.', 'حذاء وحقيبة بسيطان بلون موحّد.', 'قطعة إكسسوار صغيرة تكفي.'],
      work: ['وشاح سادة غير لامع.', 'حقيبة يد منظمة وحذاء مغلق.', 'تجنبي الإكسسوارات الكبيرة.'],
      party: ['وشاح حرير أو ساتان بلون متباين.', 'حقيبة صغيرة ومجوهرات ذهبية أو فضية.', 'حزام رفيع على عباءة سادة يبرز القوام.'],
      travel: ['الأقمشة المقاومة للتجعد والألوان الداكنة أنسب.', 'حذاء مريح وحقيبة آمنة.', 'وشاح إضافي للطقس المتغير.'],
    },
  },
};

const en: Strings = {
  hint: 'Hover or tap an abaya — slide the rail to see them all', all: 'All', empty: 'Nothing to show yet.',
  flip: 'See the other side', sizes: 'Size', order: 'Order now', pick: 'Please choose a size', of: 'of', soldout: 'All sizes sold out',
  sale: 'Sale', prev: 'Previous', next: 'Next', close: 'Close',
  formTitle: 'Your details', name: 'Full name', phone: 'Mobile number (with country code)', city: 'City', address: 'Address', note: 'Notes (optional)',
  eventDate: 'Event date (optional)', submit: 'Place order', sending: 'Placing order…', cancel: 'Cancel',
  eName: 'Please enter your name', ePhone: 'Please enter a valid mobile number', eSold: 'That size just sold out — please pick another',
  eGone: 'This item is no longer available', eRate: 'Too many orders — try again in a few minutes', eNet: 'Could not place the order, please try again',
  doneTitle: (n: string) => `Order #${n} placed`, doneText: 'Send us the ready-made message to confirm it.',
  sendWa: 'Send on WhatsApp', sendTg: 'Send on Telegram', sendIg: 'Copy message & open Instagram', noChannel: 'We will contact you shortly.',
  copied: 'Message copied — paste it in the chat', newOrder: 'Another order',
  tools: {
    size: 'Size guide', tryon: 'Virtual try-on', style: 'Style guide', arrive: 'Arrival time',
    bust: 'Bust', waist: 'Waist', hips: 'Hips', length: 'Length', cm: 'cm', sz: 'Size',
    h: 'Your height (cm)', w: 'Your weight (kg)', photoOpt: 'Full-body photo (optional, for better accuracy)', find: 'Find my size',
    your: 'Suggested size', fillHW: 'Enter height and weight', soldOut: 'That size is sold out; closest available:', noneLeft: 'No size is in stock.',
    long: 'This length is a little long for your height; it may need hemming.', short: 'This length is a little short for your height.', okLen: 'The length suits your height.',
    basis: 'Based on your height and weight', thinking: 'Working on it…', err: 'Could not reach the AI, please try again.',
    upl: 'Choose a full-length, front-facing photo of yourself', see: 'Show it on me',
    tryNote: 'Simple preview. With the AI connected, the real garment is fitted to your body. Your photo is not stored.', tryNoteAi: 'Your photo is sent only to create this image and is not stored.',
    occ: 'Occasion', daily: 'Everyday', work: 'Work', party: 'Party', travel: 'Travel', getStyle: 'Get styling advice',
    evDate: 'Event date (party, trip…)', calc: 'Find the best time to order', orderBy: 'Order by',
    ifToday: 'If you order today it arrives around', tooLate: "It won't arrive in time; earliest arrival:", tight: 'Tight timing — order today.', good: 'You have enough time.', pickDate: 'Pick a date',
    tips: {
      daily: ['Match the scarf to the abaya colour family for a calm, unified look.', 'Simple shoes and bag in one tone look polished.', 'One small accessory is enough.'],
      work: ['Go for a plain, matte scarf.', 'A structured handbag and closed shoes.', 'Skip oversized accessories.'],
      party: ['A silk or satin scarf in a contrasting colour pops.', 'Add a small clutch and gold or silver jewellery.', 'A slim belt over a plain abaya shapes the silhouette.'],
      travel: ['Wrinkle-resistant fabric in dark tones is the most practical.', 'Comfortable shoes and a secure bag.', 'Carry an extra scarf for changing weather.'],
    },
  },
};

export const STRINGS: Record<Lang, Strings> = { fa, ar, en };
export const LOCALE: Record<Lang, string> = { fa: 'fa-IR', ar: 'ar-OM', en: 'en-US' };
