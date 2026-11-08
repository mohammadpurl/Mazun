/* Demo data for the LOCAL store only (data/store.json): about fifty customers and fourteen months of orders, so the
   admin dashboard can be seen working before the shop has real sales. It never touches Supabase.
   Run: npm run seed:demo        (refuses to overwrite a store that already has orders)
        npm run seed:demo -- --force */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { newId } from '../src/lib/customers';
import { DEFAULT_SETTINGS, ONE_SIZE, SEED_CATEGORIES, SEED_GARMENTS } from '../src/lib/defaults';
import { LocalRepo } from '../src/lib/db/local';
import { amountDue, settlePayment } from '../src/lib/orders';
import { OMAN_CITIES } from '../src/lib/places';
import type { Address, Carrier, Customer, Garment, Order, OrderEvent, OrderItem, OrderStatus, PaymentMethod } from '../src/lib/types';

const dir = path.join(process.cwd(), 'data');
const file = path.join(dir, 'store.json');
if (existsSync(file) && !process.argv.includes('--force')) {
  const cur = JSON.parse(readFileSync(file, 'utf8')) as { orders?: unknown[] };
  if (cur.orders?.length) {
    console.error(`data/store.json already has ${cur.orders.length} orders. Run with --force to replace them with demo data.`);
    process.exit(1);
  }
}

// Deterministic, so every run gives the same shop.
let seed = 20261107;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
const weighted = <T,>(xs: readonly [T, number][]) => { let r = rnd() * xs.reduce((a, x) => a + x[1], 0); for (const [v, w] of xs) { r -= w; if (r <= 0) return v; } return xs[0][0]; };
const DAY = 86_400_000;
const NOW = Date.now();
const iso = (t: number) => new Date(t).toISOString();

const NAMES = [
  'Noura Al-Said', 'Maryam Al-Balushi', 'Fatma Al-Lawati', 'Aisha Al-Harthy', 'Shaikha Al-Busaidi', 'Huda Al-Rawahi', 'Salma Al-Hinai',
  'Reem Al-Kindi', 'Zainab Al-Mahrouqi', 'Laila Al-Amri', 'Maha Al-Shukaili', 'Asma Al-Riyami', 'Amal Al-Saadi', 'Muna Al-Farsi',
  'Badriya Al-Habsi', 'Khadija Al-Jabri', 'Rahma Al-Mamari', 'Sumaya Al-Ghafri', 'Hind Al-Wahaibi', 'Iman Al-Shidi', 'Thuraya Al-Siyabi',
  'Ghaliya Al-Maskari', 'Wafa Al-Ismaili', 'Najla Al-Rashdi', 'Basma Al-Nabhani', 'Mariam Al-Toqi', 'Jokha Al-Hosni', 'Shamsa Al-Abri',
  'نورة السعيدية', 'مريم البلوشية', 'فاطمة اللواتية', 'عائشة الحارثية', 'شيخة البوسعيدية', 'هدى الرواحية', 'سلمى الهنائية', 'ريم الكندية',
  'زينب المحروقية', 'ليلى العامرية', 'مها الشكيلية', 'أسماء الريامية', 'آمال السعدية', 'منى الفارسية', 'بدرية الحبسية', 'خديجة الجابرية',
  'رحمة المعمرية', 'سمية الغافرية', 'هند الوهيبية', 'إيمان الشيدية', 'ثريا السيابية', 'غالية المسكرية',
];
const AREAS: Record<string, string[]> = {
  muscat: ['الخوير', 'القرم', 'الموج', 'بوشر', 'الغبرة', 'مدينة السلطان قابوس', 'السيب', 'العذيبة', 'المعبيلة'],
  salalah: ['الحافة', 'السعادة', 'عوقد', 'الدهاريز'], sohar: ['الهمبار', 'فلج القبائل', 'الطريف'], nizwa: ['فرق', 'تنوف', 'كرشا'],
  sur: ['العيجة', 'بلاد صور'], ibri: ['العراقي', 'الدريز'], buraimi: ['الخضراء', 'الصعراء'], rustaq: ['الحزم', 'المزاحيط'],
  barka: ['السوادي', 'الرميس'], ibra: ['اليحمدي', 'المنترب'], khasab: ['البصة'], duqm: ['نفون'], bahla: ['جبرين'], samail: ['السرين'],
};
const CITY_WEIGHT: [string, number][] = [['muscat', 46], ['salalah', 10], ['sohar', 9], ['nizwa', 7], ['sur', 5], ['barka', 5], ['ibri', 3], ['buraimi', 3], ['rustaq', 3], ['ibra', 2], ['khasab', 2], ['duqm', 1], ['bahla', 2], ['samail', 2]];
const NOTES = ['لطفاً قبل از ارسال تماس بگیرید', 'برای عروسی خواهرم است', 'اگر ممکن است با جعبهٔ هدیه', 'تحویل بعد از ساعت ۵ عصر', '', '', '', ''];

const garments = SEED_GARMENTS.filter(g => g.kind === 'garment');
const accessories = SEED_GARMENTS.filter(g => g.kind !== 'garment');
const GARMENT_WEIGHT = garments.map((g, i) => [g, [9, 7, 6, 8, 5, 6, 4, 3][i] ?? 3] as [Garment, number]);

// Customers.
const customers: Customer[] = NAMES.map((name, i) => {
  const cityKey = weighted(CITY_WEIGHT);
  const city = OMAN_CITIES.find(c => c.key === cityKey)!;
  const phone = '968' + String(9 + (i % 2) * -2) + String(1000000 + Math.floor(rnd() * 8999999)).slice(0, 7);
  const home: Address = { id: newId('a'), label: 'خانه', city: city.ar, area: pick(AREAS[cityKey]), line: `سكة ${100 + Math.floor(rnd() * 4800)}، منزل ${1 + Math.floor(rnd() * 90)}`, isDefault: true };
  const addresses = [home];
  if (rnd() < 0.25) addresses.push({ id: newId('a'), label: 'محل کار', city: 'مسقط', area: pick(AREAS.muscat), line: `مبنى ${1 + Math.floor(rnd() * 300)}، الطابق ${1 + Math.floor(rnd() * 8)}`, isDefault: false });
  const created = NOW - (40 + Math.floor(rnd() * 380)) * DAY;
  return {
    id: newId('u'), name, phone, email: /^[A-Za-z]/.test(name) && rnd() < 0.5 ? name.toLowerCase().replace(/[^a-z]+/g, '.') + '@mail.om' : '',
    tags: rnd() < 0.18 ? ['VIP'] : rnd() < 0.15 ? ['سفارشی‌دوز'] : [], addresses,
    notes: rnd() < 0.3 ? [{ id: newId('n'), at: iso(created + 5 * DAY), text: pick(['سایز M با آستین بلندتر', 'رنگ‌های روشن را ترجیح می‌دهد', 'مشتری قدیمی؛ تخفیف ۱۰٪ مناسبت‌ها', 'قد ۱۶۵، سایز L']) }] : [],
    createdAt: iso(created), updatedAt: iso(created),
  };
});
// A few customers who joined this week and this month, for the "new customers" numbers.
const fresh = new Set(customers.slice(-6));
fresh.forEach(c => { const i = customers.indexOf(c) - (customers.length - 6); c.createdAt = iso(NOW - (i * 4 + 1) * DAY); c.updatedAt = c.createdAt; });

// Orders: more of them as the shop grows, a burst before Eid and the wedding season.
const orders: Order[] = [];
const loyal = customers.slice(0, 18);
let id = 1001;
const days = 420;
for (let d = days; d >= 0; d--) {
  const t0 = NOW - d * DAY;
  const growth = 0.25 + (1 - d / days) * 0.9;
  const season = [60, 61, 62, 63, 64, 200, 201, 202, 203].includes(d % 365) ? 2.2 : 1;
  let n = 0;
  const lambda = growth * season * 1.25;
  for (let p = Math.exp(-lambda), s = p, u = rnd(); u > s; n++) { p *= lambda / (n + 1); s += p; }
  if (d === 0) n = Math.max(n, 3);
  for (let k = 0; k < n; k++) {
    const createdT = t0 - Math.floor(rnd() * (d === 0 ? 8 : 20)) * 3_600_000;
    if (createdT > NOW) continue;
    const joined = [...fresh].filter(c => Date.parse(c.createdAt) < createdT);
    const customer = joined.length && rnd() < 0.2 ? pick(joined) : rnd() < 0.45 ? pick(loyal) : pick(customers);
    // A new customer orders only after she joined, so she counts as new in the dashboard's window.
    if (Date.parse(customer.createdAt) > createdT) { if (fresh.has(customer)) continue; customer.createdAt = iso(createdT - DAY); }
    const items: OrderItem[] = [];
    const lines = weighted([[1, 68], [2, 24], [3, 6], [4, 2]] as [number, number][]);
    for (let l = 0; l < lines; l++) {
      const g = l > 0 && rnd() < 0.5 ? pick(accessories) : weighted(GARMENT_WEIGHT);
      const size = g.kind === 'garment' ? weighted([['S', 18], ['M', 34], ['L', 30], ['XL', 18]] as [string, number][]) : ONE_SIZE;
      const price = g.salePrice ?? g.price;
      // Names and colours as the customer saw them in the shop, in her language.
      const L = /^[A-Za-z]/.test(customer.name) ? 'en' : 'ar';
      items.push({ garmentId: g.id, name: g.name[L], size, color: g.colors[0]?.name[L] ?? '', qty: rnd() < 0.08 ? 2 : 1, price });
    }
    const total = Math.round(items.reduce((a, i) => a + i.price * i.qty, 0) * 1000) / 1000;
    const address = customer.addresses[rnd() < 0.85 ? 0 : customer.addresses.length - 1];
    const age = (NOW - createdT) / DAY;
    const status: OrderStatus = age < 0.6 ? weighted([['new', 85], ['confirmed', 15]] as [OrderStatus, number][])
      : age < 1.6 ? weighted([['new', 20], ['confirmed', 50], ['preparing', 30]] as [OrderStatus, number][])
      : age < 5 ? weighted([['confirmed', 10], ['preparing', 45], ['shipped', 45]] as [OrderStatus, number][])
      : age < 11 ? weighted([['preparing', 6], ['shipped', 44], ['delivered', 44], ['cancelled', 6]] as [OrderStatus, number][])
      : weighted([['delivered', 93], ['cancelled', 6], ['shipped', 1]] as [OrderStatus, number][]);
    const cityKey = OMAN_CITIES.find(c => c.ar === address.city || c.fa === address.city)?.key ?? 'muscat';
    const carrier: Carrier = cityKey === 'muscat' ? weighted([['courier', 80], ['pickup', 20]] as [Carrier, number][]) : weighted([['omanpost', 50], ['aramex', 35], ['dhl', 15]] as [Carrier, number][]);
    const fee = carrier === 'pickup' ? 0 : cityKey === 'muscat' ? 2 : 3 + Math.floor(rnd() * 3);
    const flow: OrderStatus[] = status === 'cancelled' ? ['new', 'cancelled'] : ['new', 'confirmed', 'preparing', 'shipped', 'delivered'].slice(0, ['new', 'confirmed', 'preparing', 'shipped', 'delivered'].indexOf(status) + 1) as OrderStatus[];
    const steps = [0, 0.15, 0.9, 2.2 + rnd() * 1.5, 4 + rnd() * 2.5];
    const history: OrderEvent[] = flow.map((s, i) => ({ at: iso(Math.min(NOW, createdT + (s === 'cancelled' ? 0.4 : steps[i]) * DAY)), status: s, note: '' }));
    const shippedAt = flow.includes('shipped') ? history.find(h => h.status === 'shipped')!.at : null;
    const deliveredAt = flow.includes('delivered') ? history.find(h => h.status === 'delivered')!.at : null;
    const shipping = { carrier: flow.includes('shipped') || status === 'preparing' ? carrier : '' as const, tracking: flow.includes('shipped') && carrier !== 'courier' && carrier !== 'pickup' ? (carrier === 'omanpost' ? 'OM' : 'AR') + String(Math.floor(rnd() * 1e9)).padStart(9, '0') : '', fee: status === 'new' ? 0 : fee, shippedAt, deliveredAt };
    const method: PaymentMethod = weighted([['link', 40], ['transfer', 30], ['cash', 18], ['card', 12]] as [PaymentMethod, number][]);
    const payStatus = status === 'delivered' ? weighted([['paid', 94], ['partial', 3], ['unpaid', 3]] as const)
      : status === 'shipped' ? weighted([['paid', 75], ['partial', 20], ['unpaid', 5]] as const)
      : status === 'preparing' || status === 'confirmed' ? weighted([['partial', 55], ['paid', 30], ['unpaid', 15]] as const)
      : status === 'cancelled' ? 'unpaid' : weighted([['unpaid', 90], ['partial', 10]] as const);
    const order: Order = {
      id: id++, customerId: customer.id, items, total, customerName: customer.name, phone: customer.phone, city: address.city, address: `${address.area}، ${address.line}`,
      note: pick(NOTES), eventDate: rnd() < 0.35 ? new Date(createdT + (8 + Math.floor(rnd() * 40)) * DAY).toISOString().slice(0, 10) : null,
      lang: /^[A-Za-z]/.test(customer.name) ? 'en' : 'ar', status, adminNote: '',
      payment: { status: payStatus, method: payStatus === 'unpaid' ? '' : method, paid: 0, paidAt: null }, shipping, history,
      createdAt: iso(createdT), updatedAt: history.at(-1)!.at,
    };
    const due = amountDue(order);
    order.payment = settlePayment({ ...order.payment, paid: payStatus === 'partial' ? Math.round(due * 0.4) : 0 }, due, iso(createdT + 0.2 * DAY));
    orders.push(order);
  }
}
orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).forEach((o, i) => { o.id = 1001 + i; });

// A few gallery photos so the product editor shows a filled gallery.
const gallery: Record<string, string[]> = {
  zayna: ['/images/details/embroidery.webp', '/images/details/belt.webp'],
  layal: ['/images/details/lace.webp'],
  reem: ['/images/details/pleats.webp', '/images/details/embroidery.webp'],
};
const catalogue = structuredClone(SEED_GARMENTS).map(g => ({ ...g, images: gallery[g.id] ?? [] }));
// One sold-out size to show the stock warning.
const reem = catalogue.find(g => g.id === 'reem');
if (reem) reem.sizes = reem.sizes.map(s => (s.n === 'XL' ? { ...s, ok: false } : s));

new LocalRepo(dir).replaceAll({
  categories: structuredClone(SEED_CATEGORIES), garments: catalogue, orders, customers,
  settings: { ...structuredClone(DEFAULT_SETTINGS), monthlyGoal: 9000 }, nextOrderId: 1001 + orders.length,
}).then(
  () => console.log(`Demo store written to data/store.json: ${customers.length} customers, ${orders.length} orders.`),
  e => { console.error(e); process.exit(1); },
);
