'use client';
/* Product photos. Fixed slots for the pictures the shop uses in particular places (the cut-outs on the rack, the
   piece worn by a model on cards and the product page, a fabric close-up), plus a gallery of any number of extra
   photos (up to 12): drop several at once or pick them, drag to reorder, make one the cover, remove. Every image is
   resized to WebP in the browser before upload. */
import { AnimatePresence, motion, Reorder } from 'motion/react';
import { useRef, useState } from 'react';
import { MAX_GALLERY } from '@/lib/validate';
import { useUi } from '../ui/Dialog';
import { faNum } from '../ui/format';
import { AIcon } from '../ui/Icon';
import { uploadImage } from '../api';

const ACCEPT = 'image/png,image/jpeg,image/webp';

/** One named picture: shows it, or a drop target to add it. */
export function Slot({ label, hint, value, onChange, cover, onBusy }: {
  label: string; hint: string; value: string; onChange: (url: string) => void; cover?: boolean; onBusy: (d: number) => void;
}) {
  const { toast } = useUi();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  async function take(file?: File) {
    if (!file) return;
    if (!ACCEPT.split(',').includes(file.type)) { toast('err', 'فقط تصویر PNG، JPEG یا WebP'); return; }
    setBusy(true); onBusy(1);
    try { onChange(await uploadImage(file, 1800)); toast('ok', `${label}: تصویر بارگذاری شد`); }
    catch (e) { toast('err', 'بارگذاری انجام نشد', (e as Error).message); }
    finally { setBusy(false); onBusy(-1); }
  }
  return (
    <div className={`slot${over ? ' over' : ''}`} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); }}>
      <button type="button" className={`img${cover ? ' cover' : ''}`} onClick={() => input.current?.click()} aria-label={`${value ? 'تعویض' : 'افزودن'} تصویر: ${label}`} style={{ border: 0, padding: 0, cursor: 'pointer' }}>
        {value ? <img src={value} alt="" /> : <span className="ph"><AIcon name="upload" /><span>{hint}</span></span>}
        {busy && <span className="busy"><AIcon name="spinner" className="spin" /></span>}
      </button>
      {value && (
        <span className="tools">
          <button type="button" className="icon-btn sm" aria-label={`حذف تصویر ${label}`} onClick={() => onChange('')}><AIcon name="trash" /></button>
        </span>
      )}
      <span className="cap"><AIcon name="image" /><span>{label}</span></span>
      <input ref={input} type="file" accept={ACCEPT} hidden onChange={e => { take(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}

interface Pending { key: string; name: string; preview: string }

/** The gallery: many photos in an order you choose. The first one is the cover. */
export function Gallery({ images, onChange, onBusy }: { images: string[]; onChange: (v: string[]) => void; onBusy: (d: number) => void }) {
  const { toast } = useUi();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const latest = useRef(images);
  latest.current = images;
  const room = MAX_GALLERY - images.length - pending.length;

  async function add(files: FileList | File[]) {
    const list = [...files].filter(f => ACCEPT.split(',').includes(f.type));
    if (!list.length) { toast('err', 'فقط تصویر PNG، JPEG یا WebP پذیرفته می‌شود'); return; }
    const take = list.slice(0, Math.max(0, room));
    if (take.length < list.length) toast('info', `حداکثر ${faNum(MAX_GALLERY)} تصویر در گالری`, `${faNum(list.length - take.length)} تصویر اضافه نشد`);
    const jobs = take.map(f => ({ key: Math.random().toString(36).slice(2), name: f.name, preview: URL.createObjectURL(f), file: f }));
    setPending(p => [...p, ...jobs.map(({ file: _f, ...j }) => j)]);
    onBusy(jobs.length);
    let ok = 0;
    // One at a time keeps the order the files were picked in and spares a slow connection.
    for (const j of jobs) {
      try { const url = await uploadImage(j.file, 1800); latest.current = [...latest.current, url]; onChange(latest.current); ok++; }
      catch (e) { toast('err', `«${j.name}» بارگذاری نشد`, (e as Error).message); }
      finally { setPending(p => p.filter(x => x.key !== j.key)); URL.revokeObjectURL(j.preview); onBusy(-1); }
    }
    if (ok) toast('ok', `${faNum(ok)} تصویر به گالری اضافه شد`);
  }
  const remove = (url: string) => onChange(images.filter(x => x !== url));
  const cover = (url: string) => onChange([url, ...images.filter(x => x !== url)]);
  const shift = (i: number, d: number) => { const n = images.slice(); const [x] = n.splice(i, 1); n.splice(i + d, 0, x); onChange(n); };

  return (
    <div className="stack">
      <label className={`drop${over ? ' over' : ''}`} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }} aria-disabled={room <= 0 || undefined}>
        <motion.span animate={over ? { y: -4, scale: 1.08 } : { y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}><AIcon name="images" duo /></motion.span>
        <b>{room > 0 ? 'چند تصویر را اینجا رها کنید یا انتخاب کنید' : 'گالری پر است'}</b>
        <span className="xs">PNG، JPEG یا WebP · تا {faNum(MAX_GALLERY)} تصویر · خودکار بهینه می‌شوند{room > 0 && room < MAX_GALLERY ? ` · ${faNum(room)} جای خالی` : ''}</span>
        <input ref={input} type="file" accept={ACCEPT} multiple disabled={room <= 0} onChange={e => { if (e.target.files) add(e.target.files); e.target.value = ''; }} />
      </label>
      {(images.length > 0 || pending.length > 0) && (
        <>
          <Reorder.Group as="div" axis="x" values={images} onReorder={onChange} className="slots" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {images.map((url, i) => (
              <Reorder.Item as="div" key={url} value={url} className="slot" whileDrag={{ scale: 1.04, zIndex: 3, boxShadow: 'var(--shadow-pop)' }} style={{ cursor: 'grab', touchAction: 'pan-y' }}>
                <div className="img cover"><img src={url} alt={`تصویر ${faNum(i + 1)} گالری`} draggable={false} /></div>
                <span className="order">{faNum(i + 1)}</span>
                <span className="tools">
                  {i > 0 && <button type="button" className="icon-btn sm" aria-label="انتقال به اول گالری" title="انتقال به اول گالری" onClick={() => cover(url)}><AIcon name="up" /></button>}
                  <button type="button" className="icon-btn sm" aria-label={`حذف تصویر ${faNum(i + 1)}`} onClick={() => remove(url)}><AIcon name="trash" /></button>
                </span>
                <span className="cap" style={{ justifyContent: 'space-between' }}>
                  <button type="button" className="icon-btn sm" aria-label="جابه‌جایی به راست" disabled={i === 0} onClick={() => shift(i, -1)}><AIcon name="right" /></button>
                  <span className="cap-txt" style={{ textAlign: 'center' }}>تصویر {faNum(i + 1)}</span>
                  <button type="button" className="icon-btn sm" aria-label="جابه‌جایی به چپ" disabled={i === images.length - 1} onClick={() => shift(i, 1)}><AIcon name="left" /></button>
                </span>
              </Reorder.Item>
            ))}
            <AnimatePresence>
              {pending.map(p => (
                <motion.div key={p.key} className="slot" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                  <div className="img cover"><img src={p.preview} alt="" style={{ opacity: 0.5 }} /><span className="busy"><AIcon name="spinner" className="spin" /></span></div>
                  <span className="cap"><span>در حال بارگذاری…</span></span>
                </motion.div>
              ))}
            </AnimatePresence>
          </Reorder.Group>
          <p className="xs muted">برای تغییر ترتیب، تصویرها را بکشید یا با فلش‌ها جابه‌جا کنید.</p>
        </>
      )}
    </div>
  );
}
