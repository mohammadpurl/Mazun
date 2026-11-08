'use client';
/* Customer and address forms (dialogs). Cities come from the known Omani list, with "another city" for anything else. */
import { useEffect, useRef, useState } from 'react';
import { OMAN_CITIES, findCity } from '@/lib/places';
import type { Address, Customer, CustomerInput } from '@/lib/types';
import { Dialog, useUi } from '../ui/Dialog';
import { Dropdown } from '../ui/Dropdown';
import { Field, Switch } from '../ui/controls';
import { AIcon } from '../ui/Icon';
import { api } from '../api';

const OTHER = '__other';
const LABELS = ['خانه', 'محل کار', 'منزل مادر', 'نشانی دیگر'];
export const emptyAddress = (): Address => ({ id: 'a' + Math.random().toString(36).slice(2, 10), label: 'خانه', city: '', area: '', line: '', isDefault: false });

export function CityPicker({ value, onChange, id, describedBy, invalid }: { value: string; onChange: (v: string) => void; id: string; describedBy?: string; invalid?: boolean }) {
  const known = findCity(value);
  const [other, setOther] = useState(!!value && !known);
  // Follows changes from outside (another address loaded), not typing in the field: "صحار الجديدة" passes through
  // "صحار" on the way and the field must not disappear.
  const typed = useRef<string | null>(null);
  useEffect(() => { if (value && value !== typed.current) setOther(!findCity(value)); }, [value]);
  return (
    <div className="stack-sm">
      <Dropdown id={id} describedBy={describedBy} invalid={invalid} searchable placeholder="انتخاب شهر" value={other ? OTHER : known?.key ?? ''}
        onChange={v => { if (v === OTHER) { setOther(true); onChange(''); } else { setOther(false); onChange(OMAN_CITIES.find(c => c.key === v)!.fa); } }}
        options={[...OMAN_CITIES.map(c => ({ value: c.key, label: c.fa, hint: c.en })), { value: OTHER, label: 'شهر دیگر…', icon: 'edit' as const }]} />
      {other && <input className="input" value={value} placeholder="نام شهر" aria-label="نام شهر" maxLength={60} onChange={e => { typed.current = e.target.value; onChange(e.target.value); }} autoFocus />}
    </div>
  );
}

export function AddressFields({ a, onChange, errors }: { a: Address; onChange: (a: Address) => void; errors?: Record<string, string> }) {
  const presets = LABELS.includes(a.label) ? a.label : '__custom';
  return (
    <div className="form-grid">
      <Field label="عنوان نشانی">{(id, d) => (
        <div className="stack-sm">
          <Dropdown id={id} describedBy={d} value={presets} onChange={v => onChange({ ...a, label: v === '__custom' ? '' : v })}
            options={[...LABELS.map(l => ({ value: l, label: l, icon: l === 'محل کار' ? 'work' as const : 'home' as const })), { value: '__custom', label: 'عنوان دلخواه…', icon: 'edit' as const }]} />
          {presets === '__custom' && <input className="input" value={a.label} maxLength={30} placeholder="مثلاً خانهٔ ییلاقی" aria-label="عنوان دلخواه" onChange={e => onChange({ ...a, label: e.target.value })} />}
        </div>
      )}</Field>
      <Field label="شهر" error={errors?.city}>{(id, d, bad) => <CityPicker id={id} describedBy={d} invalid={bad} value={a.city} onChange={city => onChange({ ...a, city })} />}</Field>
      <Field label="منطقه / محله" help="مثلاً الخوير، القرم">{(id, d) => <input id={id} className="input" aria-describedby={d} value={a.area} maxLength={60} onChange={e => onChange({ ...a, area: e.target.value })} />}</Field>
      <div className="field" style={{ justifyContent: 'flex-end' }}><Switch label="نشانی پیش‌فرض" hint="برای سفارش‌های بعدی" checked={a.isDefault} onChange={isDefault => onChange({ ...a, isDefault })} /></div>
      <Field label="نشانی کامل" className="full" help="خیابان یا سکه، شمارهٔ ساختمان یا منزل، نشانه‌ها" error={errors?.line}>{(id, d, bad) => (
        <textarea id={id} className="textarea" aria-describedby={d} aria-invalid={bad || undefined} value={a.line} maxLength={300} onChange={e => onChange({ ...a, line: e.target.value })} style={{ minHeight: 80 }} />
      )}</Field>
    </div>
  );
}

const toInput = (c: Customer | null): CustomerInput => c
  ? { name: c.name, phone: c.phone, email: c.email, tags: c.tags, addresses: c.addresses, notes: c.notes }
  : { name: '', phone: '968', email: '', tags: [], addresses: [], notes: [] };

/** Add or edit a customer: contact details and tags; a new customer can get her first address here too. */
export function CustomerDialog({ open, onClose, customer, onSaved }: { open: boolean; onClose: () => void; customer: Customer | null; onSaved: (c: Customer) => void }) {
  const { toast } = useUi();
  const [v, setV] = useState<CustomerInput>(toInput(customer));
  const [addr, setAddr] = useState<Address>({ ...emptyAddress(), isDefault: true });
  const [tag, setTag] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setV(toInput(customer)); setAddr({ ...emptyAddress(), isDefault: true }); setErrors({}); setTag(''); } }, [open, customer]);
  const addTag = () => { const t = tag.trim().slice(0, 24); if (t && !v.tags.includes(t)) setV(x => ({ ...x, tags: [...x.tags, t] })); setTag(''); };

  async function save() {
    setBusy(true); setErrors({});
    const body = { ...v, addresses: !customer && (addr.city || addr.line) ? [addr] : v.addresses };
    try {
      const saved = customer ? await api<Customer>(`/api/admin/customers/${customer.id}`, 'PUT', body) : await api<Customer>('/api/admin/customers', 'POST', body);
      toast('ok', customer ? 'اطلاعات مشتری ذخیره شد' : 'مشتری اضافه شد', saved.name);
      onSaved(saved);
    } catch (e) {
      const er = (e as Error & { errors?: Record<string, string> }).errors;
      if (er) setErrors(er); else toast('err', 'ذخیره نشد', (e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} title={customer ? 'ویرایش مشتری' : 'مشتری جدید'} icon={customer ? 'edit' : 'userPlus'} wide busy={busy}
      footer={<>
        <button type="button" className="btn outline" onClick={onClose} disabled={busy}>انصراف</button>
        <button type="button" className="btn" onClick={save} disabled={busy}>{busy ? 'در حال ذخیره…' : customer ? 'ذخیرهٔ تغییرات' : 'افزودن مشتری'}</button>
      </>}>
      <div className="form-grid">
        <Field label="نام و نام خانوادگی" error={errors.name}>{(id, d, bad) => <input id={id} className="input" data-autofocus aria-describedby={d} aria-invalid={bad || undefined} value={v.name} maxLength={80} onChange={e => setV(x => ({ ...x, name: e.target.value }))} />}</Field>
        <Field label="شمارهٔ موبایل" help="با کد کشور، مثل 96891234567" error={errors.phone}>{(id, d, bad) => <input id={id} className="input ltr" inputMode="tel" aria-describedby={d} aria-invalid={bad || undefined} value={v.phone} maxLength={20} onChange={e => setV(x => ({ ...x, phone: e.target.value }))} />}</Field>
        <Field label="ایمیل (اختیاری)" error={errors.email}>{(id, d, bad) => <input id={id} className="input ltr" type="email" aria-describedby={d} aria-invalid={bad || undefined} value={v.email} maxLength={120} onChange={e => setV(x => ({ ...x, email: e.target.value }))} />}</Field>
        <Field label="برچسب‌ها" help="Enter برای افزودن؛ مثل VIP یا سفارشی‌دوز">{(id, d) => (
          <div className="stack-sm">
            <div className="input-wrap">
              <input id={id} className="input" aria-describedby={d} value={tag} maxLength={24} onChange={e => setTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} style={{ paddingInlineEnd: 44 }} />
              <button type="button" className="icon-btn sm clear" aria-label="افزودن برچسب" onClick={addTag}><AIcon name="plus" /></button>
            </div>
            {v.tags.length > 0 && (
              <div className="row" style={{ gap: 6 }}>
                {v.tags.map(t => (
                  <span key={t} className={`tag${t === 'VIP' ? ' vip' : ''}`} style={{ gap: 4, paddingInlineEnd: 2 }}>{t}
                    <button type="button" className="icon-btn sm" style={{ width: 22, height: 22 }} aria-label={`حذف برچسب ${t}`} onClick={() => setV(x => ({ ...x, tags: x.tags.filter(y => y !== t) }))}><AIcon name="close" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}</Field>
      </div>
      {!customer && (
        <fieldset className="fieldset">
          <legend>نشانی (اختیاری)</legend>
          <AddressFields a={addr} onChange={setAddr} errors={errors.address0 ? { line: errors.address0 } : undefined} />
        </fieldset>
      )}
    </Dialog>
  );
}

/** Add or edit one address of a customer; saves the whole customer. */
export function AddressDialog({ open, onClose, customer, address, onSaved }: { open: boolean; onClose: () => void; customer: Customer; address: Address | null; onSaved: (c: Customer) => void }) {
  const { toast } = useUi();
  const [a, setA] = useState<Address>(address ?? emptyAddress());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  useEffect(() => { if (open) { setA(address ?? { ...emptyAddress(), isDefault: !customer.addresses.length }); setErr({}); } }, [open, address, customer.addresses.length]);
  async function save() {
    if (!a.city.trim() && !a.line.trim()) { setErr({ city: 'شهر یا نشانی را وارد کنید' }); return; }
    setBusy(true);
    let addresses = address ? customer.addresses.map(x => (x.id === a.id ? a : x)) : [...customer.addresses, a];
    if (a.isDefault) addresses = addresses.map(x => ({ ...x, isDefault: x.id === a.id }));
    try {
      const saved = await api<Customer>(`/api/admin/customers/${customer.id}`, 'PUT', { ...customer, addresses });
      toast('ok', address ? 'نشانی ویرایش شد' : 'نشانی اضافه شد');
      onSaved(saved);
    } catch (e) { toast('err', 'ذخیره نشد', (e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onClose={onClose} title={address ? 'ویرایش نشانی' : 'نشانی جدید'} icon="pin" wide busy={busy}
      footer={<>
        <button type="button" className="btn outline" onClick={onClose} disabled={busy}>انصراف</button>
        <button type="button" className="btn" onClick={save} disabled={busy}>{busy ? 'در حال ذخیره…' : 'ذخیرهٔ نشانی'}</button>
      </>}>
      <AddressFields a={a} onChange={setA} errors={err} />
    </Dialog>
  );
}
