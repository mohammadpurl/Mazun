'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ONE_SIZE } from '@/lib/defaults';
import { effectivePrice } from '@/lib/fit';
import { formatNumber, orderMessage, shopChatLink } from '@/lib/order-message';
import type { OrderItem } from '@/lib/types';
import { DatePicker } from '../shop/DatePicker';
import { Icon } from '../shop/Icon';
import { Art } from './Art';
import { bagTotal, Sheet, useBoutique } from './Boutique';

interface Placed { id: number; items: OrderItem[]; total: number; customerName: string }

/** Shopping bag: lines with quantity, subtotal, then checkout (details form -> order saved -> chat link). */
export function BagSheet() {
  const b = useBoutique();
  const close = useCallback(() => b.openSheet(null), [b]);
  const [stage, setStage] = useState<'bag' | 'details' | 'done'>('bag');
  const [placed, setPlaced] = useState<Placed | null>(null);
  const { t } = b;
  const onClose = () => { close(); if (stage === 'done') { setStage('bag'); setPlaced(null); } };
  // Moving between bag and details unmounts the button that was pressed; focus lands on the new heading rather than
  // falling to the page (unless the new step already took it, as the name field does with a mouse).
  const head = useRef<HTMLHeadingElement>(null);
  const firstStage = useRef(true);
  useEffect(() => {
    if (firstStage.current) { firstStage.current = false; return; }
    if (stage !== 'done' && (!document.activeElement || document.activeElement === document.body)) head.current?.focus({ preventScroll: true });
  }, [stage]);

  return (
    <Sheet open={b.sheet === 'bag'} onClose={onClose} label={t.bagT} width={460} z={75}>
      <div className="bag">
        <div className="bag-head">
          {/* once the order is placed, the confirmation below carries the heading */}
          {stage === 'done' ? <span /> : <h2 ref={head} tabIndex={-1}>{stage === 'details' ? t.coT : t.bagT}</h2>}
          <button type="button" className="ibtn" aria-label={t.close} onClick={onClose} style={{ marginInlineEnd: -10 }}><Icon name="close" size={20} /></button>
        </div>
        {stage === 'bag' && <Lines onCheckout={() => setStage('details')} />}
        {stage === 'details' && <Checkout onBack={() => setStage('bag')} onPlaced={p => { setPlaced(p); setStage('done'); b.clearBag(); }} />}
        {stage === 'done' && placed && <Done placed={placed} onContinue={() => { setStage('bag'); setPlaced(null); close(); }} />}
      </div>
    </Sheet>
  );
}

function Lines({ onCheckout }: { onCheckout: () => void }) {
  const b = useBoutique();
  const { t, tx } = b;
  // After a removal, focus goes to the next line's Remove (or the previous one, or the heading once the bag is empty).
  const removeAt = (i: number) => {
    b.removeLine(i);
    requestAnimationFrame(() => {
      const left = document.querySelectorAll<HTMLElement>('.bag-list [data-remove]');
      (left[Math.min(i, left.length - 1)] ?? document.querySelector<HTMLElement>('.bag-head h2'))?.focus();
    });
  };
  return (
    <>
      <div className="bag-list">
        {b.bag.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 40 }}>
            <p style={{ margin: 0, fontSize: 18, fontStyle: 'italic' }}>{t.empty}</p>
            <a className="tlink u" href="/#rack" onClick={() => b.openSheet(null)} style={{ alignSelf: 'flex-start' }}>{t.browse}</a>
          </div>
        )}
        {b.bag.map((l, i) => {
          const g = b.byId(l.id);
          if (!g) return null;
          const colour = g.colors[l.c] ?? g.colors[0];
          return (
            <div key={`${l.id}-${l.c}-${l.s}`} className="line">
              <button type="button" className="pic" aria-label={tx(g.name)} onClick={() => { b.openSheet(null); b.openProduct(g.id); }}>
                <span style={{ position: 'absolute', inset: 5 }}><Art g={g} color={l.c} /></span>
              </button>
              <div className="txt">
                <div className="top"><span style={{ fontSize: 18, lineHeight: 1.2 }}>{tx(g.name)}</span><span style={{ fontSize: 15, whiteSpace: 'nowrap' }}>{b.price(effectivePrice(g) * l.q)}</span></div>
                <span className="muted" style={{ fontSize: 14 }}>{colour ? `${tx(colour.name)} · ` : ''}{l.s === ONE_SIZE ? t.oneSize : `${t.size} ${l.s}`}</span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                  <div className="qty" role="group" aria-label={t.qty}>
                    <button type="button" aria-label={t.less} onClick={() => b.setQty(i, l.q - 1)} disabled={l.q <= 1}><Icon name="minus" size={18} /></button>
                    <span>{formatNumber(l.q, b.lang)}</span>
                    <button type="button" aria-label={t.more} onClick={() => b.setQty(i, l.q + 1)} disabled={l.q >= 10}><Icon name="plus" size={18} /></button>
                  </div>
                  <button type="button" className="tlink u" style={{ fontWeight: 400, fontSize: 13, color: 'var(--muted)', padding: '6px 8px', marginInline: -8 }} data-remove onClick={() => removeAt(i)}>{t.remove}</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {b.bag.length > 0 && (
        <div className="bag-foot">
          <div className="label-row"><span style={{ fontSize: 15 }}>{t.subtotal}</span><span style={{ fontSize: 24 }}>{b.price(bagTotal(b.bag, b.byId))}</span></div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>{t.delCalc}</p>
          <button type="button" className="btn block" onClick={onCheckout}>{t.checkout}</button>
        </div>
      )}
    </>
  );
}

function Checkout({ onBack, onPlaced }: { onBack: () => void; onPlaced: (p: Placed) => void }) {
  const b = useBoutique();
  const { t } = b;
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = Object.fromEntries(['customerName', 'phone', 'city', 'address', 'note', 'eventDate', 'website'].map(k => [k, String(f.get(k) ?? '')]));
    const local: Record<string, string> = {};
    if (body.customerName.trim().length < 2) local.customerName = t.eName;
    const digits = (body.phone.match(/[0-9۰-۹٠-٩]/g) ?? []).length;
    if (digits < 7 || digits > 15) local.phone = t.ePhone;
    setErrors(local); setMsg('');
    if (Object.keys(local).length) return;

    setBusy(true);
    try {
      const r = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, lang: b.lang, items: b.bag.map(l => ({ garmentId: l.id, size: l.s, color: l.c, qty: l.q })) }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) { onPlaced({ ...data, customerName: body.customerName.trim() }); return; }
      if (r.status === 429) setMsg(t.eRate);
      else if (data.errors?.items === 'soldout') { setMsg(t.eSold); onBack(); b.toast(t.eSold); }
      else if (data.errors?.items === 'unavailable') { if (data.garmentId) b.removeProduct(data.garmentId); setMsg(t.eGone); b.toast(t.eGone); onBack(); }
      else if (data.errors) {
        const shown = { ...(data.errors.customerName && { customerName: t.eName }), ...(data.errors.phone && { phone: t.ePhone }), ...(data.errors.eventDate && { eventDate: t.eDate }) };
        setErrors(shown);
        if (!Object.keys(shown).length) setMsg(t.eNet); // a refusal with no field to point at still gets a message
      }
      else setMsg(t.eNet);
    } catch {
      setMsg(t.eNet);
    } finally {
      setBusy(false);
    }
  }

  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className={`field${errors[name] ? ' bad' : ''}`}>{label}
      <input name={name} aria-invalid={!!errors[name]} {...props} />
      {errors[name] && <span className="e">{errors[name]}</span>}
    </label>
  );

  return (
    <form className="bag-list" onSubmit={submit} noValidate style={{ gap: 16 }}>
      {/* The keyboard opens on its own only where there is a real pointer; on a phone it would cover half the form. */}
      {field('customerName', t.name, { autoComplete: 'name', maxLength: 80, dir: 'auto', autoFocus: typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches })}
      {field('phone', t.phone, { type: 'tel', autoComplete: 'tel', inputMode: 'tel', dir: 'ltr', maxLength: 20 })}
      {field('city', t.city, { autoComplete: 'address-level2', maxLength: 60, dir: 'auto' })}
      {field('address', t.address, { autoComplete: 'street-address', maxLength: 300, dir: 'auto' })}
      <div className={`field${errors.eventDate ? ' bad' : ''}`}><label id="mz-event-date" htmlFor="mz-event-date-field">{t.eventDate}</label>
        <DatePicker id="mz-event-date-field" name="eventDate" lang={b.lang} labelledBy="mz-event-date" min="today" text={{ choose: t.pickDate, clear: t.clearDate, prev: t.prevMonth, next: t.nextMonth }} />
        {errors.eventDate && <span className="e">{errors.eventDate}</span>}
      </div>
      <label className="field">{t.note}<textarea name="note" maxLength={500} /></label>
      <div className="hp" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div role="alert" style={{ color: 'var(--rust)', fontSize: 14, minHeight: 20 }}>{msg}</div>
      <div className="label-row"><span style={{ fontSize: 15 }}>{t.subtotal}</span><span style={{ fontSize: 22 }}>{b.price(bagTotal(b.bag, b.byId))}</span></div>
      <button type="submit" className="btn block" disabled={busy}>{busy ? t.placing : t.placeOrder}</button>
      <button type="button" className="tlink u" style={{ alignSelf: 'flex-start' }} onClick={onBack} disabled={busy}>{t.backToBag}</button>
    </form>
  );
}

function Done({ placed, onContinue }: { placed: Placed; onContinue: () => void }) {
  const b = useBoutique();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const { t, settings } = b;
  const message = orderMessage(placed, b.lang, settings);
  const link = shopChatLink(settings, message);
  return (
    <div className="bag-list">
      <div className="done">
        <Icon name="done" weight="duotone" size={40} style={{ color: 'var(--olive-7)' }} />
        <h2 ref={heading} tabIndex={-1}>{t.doneT(formatNumber(placed.id, b.lang))}</h2>
        <p className="lead">{link ? t.doneText : t.noChannel}</p>
        {link && settings.channel !== 'instagram' && (
          <a className="btn block" href={link} target="_blank" rel="noopener noreferrer">
            <Icon name={settings.channel === 'telegram' ? 'telegram' : 'whatsapp'} size={20} />
            {settings.channel === 'telegram' ? t.sendTg : t.sendWa}
          </a>
        )}
        {link && settings.channel === 'instagram' && (
          <button type="button" className="btn block" onClick={() => {
            navigator.clipboard?.writeText(message).then(() => b.toast(t.copied), () => undefined);
            window.open(link, '_blank', 'noopener');
          }}>{t.sendIg}</button>
        )}
        <button type="button" className="tlink u" style={{ alignSelf: 'flex-start' }} onClick={onContinue}>{t.continueShopping}</button>
      </div>
    </div>
  );
}

export function WishSheet() {
  const b = useBoutique();
  const { t, tx } = b;
  const close = useCallback(() => b.openSheet(null), [b]);
  return (
    <Sheet open={b.sheet === 'wish'} onClose={close} label={t.wishT} width={460} z={75}>
      <div className="bag">
        <div className="bag-head">
          <h2>{t.wishT}</h2>
          <button type="button" className="ibtn" aria-label={t.close} onClick={close} style={{ marginInlineEnd: -10 }}><Icon name="close" size={20} /></button>
        </div>
        <div className="bag-list">
          {b.wish.length === 0 && <p style={{ margin: 0, paddingTop: 40, fontSize: 18, fontStyle: 'italic' }}>{t.wishEmpty}</p>}
          {b.wish.map(id => {
            const g = b.byId(id);
            if (!g) return null;
            return (
              <div key={id} className="line">
                <button type="button" className="pic" aria-label={tx(g.name)} onClick={() => { close(); b.openProduct(id); }}>
                  <span style={{ position: 'absolute', inset: 5 }}><Art g={g} /></span>
                </button>
                <div className="txt">
                  <div className="top"><span style={{ fontSize: 18, lineHeight: 1.2 }}>{tx(g.name)}</span><span style={{ fontSize: 15 }}>{b.price(effectivePrice(g))}</span></div>
                  <div style={{ display: 'flex', gap: 18, marginTop: 'auto' }}>
                    <button type="button" className="tlink u" onClick={() => { close(); b.openProduct(id); }}>{t.open}</button>
                    <button type="button" className="tlink u" style={{ fontWeight: 400, color: 'var(--muted)' }} onClick={() => b.toggleWish(id)}>{t.remove}</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
