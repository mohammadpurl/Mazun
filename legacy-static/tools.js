/* Shopper tools shown under each garment: size guide + AI size, virtual try-on, style guide, arrival planner.
   Works with no setup (built-in demo answers). Set APP_CONFIG.aiEndpoint to use the real AI. */
(function () {
  const C = window.APP_CONFIG || {};
  const LOCALE = { fa: 'fa-IR', ar: 'ar-OM', en: 'en-US' };
  const DEF = {
    S: { bust: 92, waist: 80, hips: 98, length: 140 }, M: { bust: 98, waist: 86, hips: 104, length: 142 },
    L: { bust: 104, waist: 92, hips: 110, length: 144 }, XL: { bust: 110, waist: 98, hips: 116, length: 146 }
  };
  const T = {
    fa: {
      size: 'راهنمای سایز', tryon: 'پرو مجازی', style: 'راهنمای استایل', arrive: 'زمان رسیدن',
      bust: 'دور سینه', waist: 'دور کمر', hips: 'دور باسن', length: 'قد لباس', cm: 'سانتی‌متر', sz: 'سایز',
      h: 'قد شما (cm)', w: 'وزن شما (kg)', photoOpt: 'عکس قدی (اختیاری، برای دقت بیشتر)', find: 'سایز مناسب من چیست؟',
      your: 'سایز پیشنهادی', fillHW: 'قد و وزن را وارد کنید', soldOut: 'این سایز فعلاً موجود نیست؛ نزدیک‌ترین موجود:',
      long: 'طول لباس برای قد شما کمی بلند است و ممکن است نیاز به کوتاه کردن داشته باشد.',
      short: 'طول لباس برای قد شما کمی کوتاه است.', okLen: 'طول لباس برای قد شما مناسب است.',
      basis: 'بر پایهٔ قد و وزن شما', thinking: 'در حال بررسی…', err: 'خطا در ارتباط با AI، دوباره تلاش کنید.',
      upl: 'یک عکس قدی و روبه‌رو از خودتان انتخاب کنید', see: 'لباس را روی من نشان بده', tryNote: 'پیش‌نمایش ساده است؛ با اتصال AI، لباس واقعی روی بدن شما قرار می‌گیرد. عکس شما ذخیره نمی‌شود.',
      occ: 'مناسبت', daily: 'روزمره', work: 'محل کار', party: 'مهمانی', travel: 'سفر', getStyle: 'راهنمایی استایل بگیر',
      evDate: 'تاریخ مناسبت (مهمانی، سفر…)', calc: 'بهترین زمان سفارش را حساب کن', orderBy: 'حداکثر تا این تاریخ سفارش دهید',
      ifToday: 'اگر امروز سفارش دهید، حدود این تاریخ می‌رسد', tooLate: 'تا آن تاریخ نمی‌رسد؛ زودترین رسیدن:', tight: 'زمان کم است؛ همین امروز سفارش دهید.',
      good: 'زمان کافی دارید.', pickDate: 'یک تاریخ انتخاب کنید',
      tips: {
        daily: ['رنگ شال را هم‌خانوادهٔ رنگ عبا انتخاب کنید تا ظاهر یکدست شود.', 'کفش و کیف ساده و هم‌رنگ، جلوه‌ای مرتب می‌دهد.', 'یک اکسسوری کوچک (ساعت یا گردنبند ظریف) کافی است.'],
        work: ['شال ساده و مات بپوشید.', 'کیف دستی ساختارمند و کفش بسته انتخاب کنید.', 'از اکسسوری درشت پرهیز کنید.'],
        party: ['شال ابریشمی یا ساتن با رنگ متضاد جلوه می‌دهد.', 'کیف دستی کوچک و جواهر طلایی یا نقره‌ای اضافه کنید.', 'کمربند ظریف روی عبای ساده فرم بدن را زیبا می‌کند.'],
        travel: ['پارچه‌های ضدچروک و رنگ‌های تیره عملی‌ترند.', 'کفش راحت و کیف ضدسرقت همراه ببرید.', 'یک شال اضافه برای هوای متغیر داشته باشید.']
      }
    },
    ar: {
      size: 'دليل المقاسات', tryon: 'قياس افتراضي', style: 'دليل الأناقة', arrive: 'موعد الوصول',
      bust: 'محيط الصدر', waist: 'محيط الخصر', hips: 'محيط الورك', length: 'طول العباءة', cm: 'سم', sz: 'المقاس',
      h: 'طولك (سم)', w: 'وزنك (كغ)', photoOpt: 'صورة كاملة (اختياري لدقة أعلى)', find: 'ما مقاسي المناسب؟',
      your: 'المقاس المقترح', fillHW: 'أدخل الطول والوزن', soldOut: 'هذا المقاس غير متوفر؛ أقرب مقاس متوفر:',
      long: 'الطول أطول قليلاً من طولك وقد يحتاج إلى تقصير.', short: 'الطول أقصر قليلاً من المناسب لطولك.', okLen: 'الطول مناسب لطولك.',
      basis: 'بناءً على طولك ووزنك', thinking: 'جارٍ التحليل…', err: 'تعذّر الاتصال بالذكاء الاصطناعي، حاول مجدداً.',
      upl: 'اختر صورة كاملة من الأمام', see: 'أرني العباءة عليّ', tryNote: 'معاينة مبسطة؛ عند ربط الذكاء الاصطناعي تظهر العباءة الحقيقية على جسمك. لا نحفظ صورتك.',
      occ: 'المناسبة', daily: 'يومي', work: 'العمل', party: 'حفلة', travel: 'سفر', getStyle: 'اقتراحات التنسيق',
      evDate: 'تاريخ المناسبة', calc: 'احسب أفضل موعد للطلب', orderBy: 'اطلب قبل هذا التاريخ',
      ifToday: 'إذا طلبت اليوم فسيصل تقريباً في', tooLate: 'لن يصل في الوقت؛ أقرب وصول:', tight: 'الوقت ضيق؛ اطلب اليوم.', good: 'لديك وقت كافٍ.', pickDate: 'اختر تاريخاً',
      tips: {
        daily: ['اختاري وشاحاً من درجة لون العباءة لمظهر متناسق.', 'حذاء وحقيبة بسيطان بلون موحّد.', 'قطعة إكسسوار صغيرة تكفي.'],
        work: ['وشاح سادة غير لامع.', 'حقيبة يد منظمة وحذاء مغلق.', 'تجنبي الإكسسوارات الكبيرة.'],
        party: ['وشاح حرير أو ساتان بلون متباين.', 'حقيبة صغيرة ومجوهرات ذهبية أو فضية.', 'حزام رفيع على عباءة سادة يبرز القوام.'],
        travel: ['الأقمشة المقاومة للتجعد والألوان الداكنة أنسب.', 'حذاء مريح وحقيبة آمنة.', 'وشاح إضافي للطقس المتغير.']
      }
    },
    en: {
      size: 'Size guide', tryon: 'Virtual try-on', style: 'Style guide', arrive: 'Arrival time',
      bust: 'Bust', waist: 'Waist', hips: 'Hips', length: 'Length', cm: 'cm', sz: 'Size',
      h: 'Your height (cm)', w: 'Your weight (kg)', photoOpt: 'Full-body photo (optional, for better accuracy)', find: 'Find my size',
      your: 'Suggested size', fillHW: 'Enter height and weight', soldOut: 'That size is sold out; closest available:',
      long: 'This length is a little long for your height; it may need hemming.', short: 'This length is a little short for your height.', okLen: 'The length suits your height.',
      basis: 'Based on your height and weight', thinking: 'Working on it…', err: 'Could not reach the AI, please try again.',
      upl: 'Choose a full-length, front-facing photo of yourself', see: 'Show it on me', tryNote: 'Simple preview. With the AI connected, the real garment is fitted to your body. Your photo is not stored.',
      occ: 'Occasion', daily: 'Everyday', work: 'Work', party: 'Party', travel: 'Travel', getStyle: 'Get styling advice',
      evDate: 'Event date (party, trip…)', calc: 'Find the best time to order', orderBy: 'Order by',
      ifToday: 'If you order today it arrives around', tooLate: "It won't arrive in time; earliest arrival:", tight: 'Tight timing — order today.', good: 'You have enough time.', pickDate: 'Pick a date',
      tips: {
        daily: ['Match the scarf to the abaya colour family for a calm, unified look.', 'Simple shoes and bag in one tone look polished.', 'One small accessory is enough.'],
        work: ['Go for a plain, matte scarf.', 'A structured handbag and closed shoes.', 'Skip oversized accessories.'],
        party: ['A silk or satin scarf in a contrasting colour pops.', 'Add a small clutch and gold or silver jewellery.', 'A slim belt over a plain abaya shapes the silhouette.'],
        travel: ['Wrinkle-resistant fabric in dark tones is the most practical.', 'Comfortable shoes and a secure bag.', 'Carry an extra scarf for changing weather.']
      }
    }
  };

  const css = document.createElement('style');
  css.textContent = `
.tl{display:flex;flex-direction:column;gap:10px}
.tl-chips{display:flex;gap:6px;flex-wrap:wrap}
.tl-chips button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 13px;font-size:13px;transition:all .2s}
.tl-chips button[aria-pressed=true],.tl-chips button:hover{background:var(--ink);color:#fff;border-color:var(--ink)}
.tl-body{background:rgba(255,255,255,.7);border:1px solid var(--line);border-radius:16px;padding:12px;font-size:13px;display:none;flex-direction:column;gap:10px}
.tl-body.on{display:flex}
.tl-body table{width:100%;border-collapse:collapse;font-size:12px;text-align:center}
.tl-body th,.tl-body td{padding:5px 3px;border-bottom:1px solid var(--line)}
.tl-body th{color:var(--muted);font-weight:400}
.tl-body tr.hl td{background:var(--ink);color:#fff}
.tl-body label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--muted);flex:1;min-width:110px}
.tl-body input,.tl-body select{font:inherit;color:var(--ink);padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:#fff;min-width:0}
.tl-row{display:flex;gap:8px;flex-wrap:wrap}
.tl-go{border:0;background:var(--accent);color:#fff;border-radius:12px;padding:10px 14px;font-size:13px}
.tl-go:disabled{opacity:.5}
.tl-out{line-height:1.8}
.tl-out b{color:var(--accent)}
.tl-note{font-size:11px;color:var(--muted)}
.tl-img{max-width:100%;max-height:340px;border-radius:12px;align-self:center;border:1px solid var(--line)}
.tl-body ul{margin:0;padding-inline-start:18px;line-height:1.9}`;
  document.head.appendChild(css);

  const fileToDataURL = (file, max = 768) => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .85));
    };
    img.onerror = rej; img.src = URL.createObjectURL(file);
  });
  const abs = u => new URL(u, location.href).href;
  async function ai(action, payload) {
    if (!C.aiEndpoint) return null;
    const h = { 'Content-Type': 'application/json' };
    if (C.supabaseKey) { h.apikey = C.supabaseKey; h.Authorization = 'Bearer ' + C.supabaseKey; }
    const r = await fetch(C.aiEndpoint, { method: 'POST', headers: h, body: JSON.stringify({ action, ...payload }) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }
  const day = d => { d = new Date(d); d.setHours(0, 0, 0, 0); return d; };
  const addDays = (d, n) => { d = new Date(d); d.setDate(d.getDate() + n); return d; };
  const fmt = (d, l) => d.toLocaleDateString(LOCALE[l], { weekday: 'long', day: 'numeric', month: 'long' });

  function chartOf(item) {
    const out = {};
    item.sizes.forEach(s => { const c = (item.chart && item.chart[s.n]) || DEF[s.n]; if (c) out[s.n] = c; });
    return out;
  }
  function localSize(item, h, w) {
    const bmi = w / Math.pow(h / 100, 2);
    const names = item.sizes.map(s => s.n);
    const f = Math.max(0, Math.min(1, (bmi - 18) / 12));
    let idx = Math.round(f * (names.length - 1));
    let pick = idx, soldOut = false;
    if (!item.sizes[idx].ok) {
      soldOut = true; let best = -1, d = 99;
      item.sizes.forEach((s, i) => { if (s.ok && Math.abs(i - idx) < d) { d = Math.abs(i - idx); best = i; } });
      pick = best;
    }
    const ch = chartOf(item)[names[pick]];
    let len = null;
    if (ch && ch.length) { const diff = ch.length - h * 0.85; len = diff > 6 ? 'long' : diff < -6 ? 'short' : 'ok'; }
    return { size: names[idx], pick: pick < 0 ? null : names[pick], soldOut: soldOut && pick >= 0, len };
  }

  function sizeSection(box, item, l) {
    const t = T[l], ch = chartOf(item), names = Object.keys(ch);
    const rows = names.map(n => `<tr data-s="${n}"><td>${n}</td><td>${ch[n].bust ?? '–'}</td><td>${ch[n].waist ?? '–'}</td><td>${ch[n].hips ?? '–'}</td><td>${ch[n].length ?? '–'}</td></tr>`).join('');
    box.innerHTML = `<table><tr><th>${t.sz}</th><th>${t.bust}</th><th>${t.waist}</th><th>${t.hips}</th><th>${t.length}</th></tr>${rows}</table>
      <div class="tl-note">${t.cm}</div>
      <div class="tl-row"><label>${t.h}<input type="number" min="120" max="210" inputmode="numeric" id="tlH"></label><label>${t.w}<input type="number" min="30" max="200" inputmode="numeric" id="tlW"></label></div>
      <label>${t.photoOpt}<input type="file" accept="image/*" id="tlP"></label>
      <button class="tl-go" id="tlGo">${t.find}</button><div class="tl-out" id="tlOut"></div>`;
    box.querySelector('#tlGo').onclick = async () => {
      const h = +box.querySelector('#tlH').value, w = +box.querySelector('#tlW').value, out = box.querySelector('#tlOut');
      if (!h || !w) { out.textContent = t.fillHW; return; }
      box.querySelectorAll('tr.hl').forEach(r => r.classList.remove('hl'));
      const mark = n => { const r = box.querySelector(`tr[data-s="${n}"]`); if (r) r.classList.add('hl'); };
      const loc = localSize(item, h, w);
      if (!C.aiEndpoint) {
        const show = loc.pick || loc.size;
        mark(show);
        out.innerHTML = `${t.your}: <b>${loc.size}</b> <span class="tl-note">(${t.basis})</span>` +
          (loc.soldOut ? `<br>${t.soldOut} <b>${loc.pick}</b>` : '') +
          (loc.len ? `<br>${loc.len === 'long' ? t.long : loc.len === 'short' ? t.short : t.okLen}` : '');
        return;
      }
      out.textContent = t.thinking;
      try {
        const file = box.querySelector('#tlP').files[0];
        const r = await ai('size', { lang: l, height: h, weight: w, chart: ch, sizes: item.sizes, photo: file ? await fileToDataURL(file) : null });
        mark(r.size);
        const safe = s => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
        out.innerHTML = `${t.your}: <b>${safe(r.size)}</b><br>${safe(r.reason || '')}`;
      } catch (e) { out.textContent = t.err; }
    };
  }

  function tryonSection(box, item, l) {
    const t = T[l];
    box.innerHTML = `<label>${t.upl}<input type="file" accept="image/*" id="trP"></label>
      <button class="tl-go" id="trGo">${t.see}</button><div id="trOut" class="tl-out"></div><div class="tl-note">${t.tryNote}</div>`;
    box.querySelector('#trGo').onclick = async () => {
      const f = box.querySelector('#trP').files[0], out = box.querySelector('#trOut');
      if (!f) { out.textContent = t.upl; return; }
      out.textContent = t.thinking;
      try {
        const person = await fileToDataURL(f, 1024);
        let src;
        if (C.aiEndpoint) { src = (await ai('tryon', { person, garment: abs(item.front), lang: l })).image; }
        else src = await demoComposite(person, item.front);
        out.innerHTML = ''; const im = new Image(); im.className = 'tl-img'; im.src = src; out.appendChild(im);
      } catch (e) { out.textContent = t.err; }
    };
  }
  function demoComposite(personUrl, garmentUrl) {
    const load = u => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = u; });
    return Promise.all([load(personUrl), load(garmentUrl)]).then(([p, g]) => {
      const W = 480, H = 640, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
      const s = Math.max(W / p.width, H / p.height); x.drawImage(p, (W - p.width * s) / 2, (H - p.height * s) / 2, p.width * s, p.height * s);
      const gh = H * 0.78, gw = gh * g.width / g.height; x.save(); x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 18; x.globalAlpha = .93;
      x.drawImage(g, (W - gw) / 2, H * 0.17, gw, gh); x.restore(); return c.toDataURL('image/jpeg', .9);
    });
  }

  function styleSection(box, item, l) {
    const t = T[l];
    box.innerHTML = `<div class="tl-row"><label>${t.occ}<select id="stO"><option value="daily">${t.daily}</option><option value="work">${t.work}</option><option value="party">${t.party}</option><option value="travel">${t.travel}</option></select></label></div>
      <button class="tl-go" id="stGo">${t.getStyle}</button><div class="tl-out" id="stOut"></div>`;
    box.querySelector('#stGo').onclick = async () => {
      const o = box.querySelector('#stO').value, out = box.querySelector('#stOut');
      if (!C.aiEndpoint) { out.innerHTML = '<ul>' + t.tips[o].map(x => `<li>${x}</li>`).join('') + '</ul>'; return; }
      out.textContent = t.thinking;
      try {
        const r = await ai('style', { lang: l, occasion: o, garment: item.name[l], image: abs(item.front) });
        out.textContent = r.text;
      } catch (e) { out.textContent = t.err; }
    };
  }

  function arriveSection(box, item, l) {
    const t = T[l];
    box.innerHTML = `<label>${t.evDate}<input type="date" id="arD"></label><button class="tl-go" id="arGo">${t.calc}</button><div class="tl-out" id="arOut"></div>`;
    box.querySelector('#arGo').onclick = async () => {
      const v = box.querySelector('#arD').value, out = box.querySelector('#arOut');
      if (!v) { out.textContent = t.pickDate; return; }
      const ev = day(v), today = day(new Date()), total = (C.prepDays || 0) + (item.lead || 0) + (C.shipDays || 0), buf = C.bufferDays || 0;
      const earliest = addDays(today, total), latest = addDays(ev, -(total + buf));
      let html;
      if (earliest > ev) html = `${t.tooLate} <b>${fmt(earliest, l)}</b>`;
      else if (latest >= today) html = `${t.good}<br>${t.orderBy}: <b>${fmt(latest, l)}</b><br>${t.ifToday}: <b>${fmt(earliest, l)}</b>`;
      else html = `${t.tight}<br>${t.ifToday}: <b>${fmt(earliest, l)}</b>`;
      out.innerHTML = html;
      if (C.aiEndpoint) {
        try {
          const r = await ai('arrive', { lang: l, garment: item.name[l], event: v, today: today.toISOString().slice(0, 10), earliest: earliest.toISOString().slice(0, 10), latest: latest.toISOString().slice(0, 10), total, buffer: buf });
          const p = document.createElement('div'); p.className = 'tl-note'; p.textContent = r.text; out.appendChild(p);
        } catch (e) { /* the computed dates above are still correct */ }
      }
    };
  }

  window.Tools = {
    mount(el, item, l) {
      const t = T[l] || T.en;
      el.innerHTML = `<div class="tl"><div class="tl-chips">
        <button data-k="size" aria-pressed="false">${t.size}</button><button data-k="tryon" aria-pressed="false">${t.tryon}</button>
        <button data-k="style" aria-pressed="false">${t.style}</button><button data-k="arrive" aria-pressed="false">${t.arrive}</button></div>
        <div class="tl-body"></div></div>`;
      const body = el.querySelector('.tl-body'), secs = { size: sizeSection, tryon: tryonSection, style: styleSection, arrive: arriveSection };
      el.querySelectorAll('.tl-chips button').forEach(b => b.onclick = () => {
        const on = b.getAttribute('aria-pressed') === 'true';
        el.querySelectorAll('.tl-chips button').forEach(x => x.setAttribute('aria-pressed', 'false'));
        if (on) { body.classList.remove('on'); return; }
        b.setAttribute('aria-pressed', 'true'); body.classList.add('on'); secs[b.dataset.k](body, item, l);
      });
    }
  };
})();
