/* Shared data layer for the shop and the admin panel.
   Live mode  -> Supabase (table "garments", storage bucket "garments").
   Demo mode  -> this browser's localStorage (no setup, single browser only). */
(function () {
  const C = window.APP_CONFIG || {};
  const live = !!(C.supabaseUrl && C.supabaseKey && window.supabase);
  const sb = live ? window.supabase.createClient(C.supabaseUrl, C.supabaseKey) : null;
  const LS = 'abaya_garments_v1';

  const fromRow = r => ({
    id: String(r.id),
    name: { fa: r.name_fa || '', ar: r.name_ar || '', en: r.name_en || '' },
    price: +r.price || 0,
    sizes: Array.isArray(r.sizes) ? r.sizes : [],
    front: r.front || '', back: r.back || r.front || '',
    chart: r.chart || null, lead: +r.lead_days || 0
  });
  const toRow = g => ({
    name_fa: g.name.fa, name_ar: g.name.ar, name_en: g.name.en, price: g.price,
    sizes: g.sizes, front: g.front, back: g.back, chart: g.chart, lead_days: g.lead || 0
  });
  const readLocal = () => { try { return JSON.parse(localStorage.getItem(LS)); } catch (e) { return null; } };
  const writeLocal = list => localStorage.setItem(LS, JSON.stringify(list));

  window.Store = {
    live,
    sb,
    /** returns an array of garments, or null when nothing has been saved yet (shop then falls back to clothes.csv) */
    async list() {
      if (live) {
        const { data, error } = await sb.from('garments').select('*').order('sort').order('id');
        if (error) { console.warn(error); return null; }
        return data.length ? data.map(fromRow) : null;
      }
      const l = readLocal();
      return l && l.length ? l : null;
    },
    async save(g) {
      if (live) {
        const row = toRow(g);
        if (g.id && /^\d+$/.test(g.id)) { const { error } = await sb.from('garments').update(row).eq('id', g.id); if (error) throw error; return g; }
        const { data, error } = await sb.from('garments').insert(row).select().single();
        if (error) throw error; return fromRow(data);
      }
      const l = readLocal() || [];
      if (!g.id) g.id = 'l' + Date.now() + Math.random().toString(36).slice(2, 6);
      const i = l.findIndex(x => x.id === g.id);
      i >= 0 ? (l[i] = g) : l.push(g);
      writeLocal(l); return g;
    },
    async remove(id) {
      if (live) { const { error } = await sb.from('garments').delete().eq('id', id); if (error) throw error; return; }
      writeLocal((readLocal() || []).filter(x => x.id !== id));
    },
    /** blob -> url. Live: uploads to storage. Demo: returns a data URL. */
    async uploadImage(blob, path) {
      if (live) {
        const { error } = await sb.storage.from('garments').upload(path, blob, { upsert: true, contentType: blob.type, cacheControl: '3600' });
        if (error) throw error;
        return sb.storage.from('garments').getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
      }
      return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
    },
    /** downscale (keeps transparency) so demo storage stays small */
    async prepImage(file, max = 900) {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return new Promise(res => c.toBlob(res, 'image/webp', 0.86));
    }
  };
})();
