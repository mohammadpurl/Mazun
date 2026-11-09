'use client';
/* eslint-disable @next/next/no-img-element -- transparent cut-outs from the catalogue */
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { fill, latinDigits } from '@/lib/concierge';
import { SIZE_ORDER } from '@/lib/defaults';
import { effectivePrice, type FitPref, type SizeInputs } from '@/lib/fit';
import { shopChatLink } from '@/lib/order-message';
import { lookTotal } from '@/lib/stylist';
import { ACCESSORY_KINDS } from '@/lib/types';
import { useBoutique } from '../../boutique/Boutique';
import { productHref } from '../Chrome';
import { Icon } from '../Icon';
import { useShop } from '../Shop';
import { SPRING, num } from '../tokens';
import { useConcierge, type Card, type Turn } from './useConcierge';

function PieceCard() {
  const b = useBoutique();
  const { c } = useShop();
  const a = useConcierge();
  const g = a.garment;
  if (!g) return null;
  return (
    <div className="ai-card">
      <Link href={productHref(g.id)} className="ai-piece">
        <span className="ai-piece__pic">{(g.front || g.wornFront) && <img src={g.front || g.wornFront} alt="" loading="lazy" decoding="async" />}</span>
        <span className="ai-piece__txt">
          <span className="ai-piece__name">{b.tx(g.name)}</span>
          <span className="ai-piece__price">{b.price(effectivePrice(g))}</span>
        </span>
        <Icon name="next" size={18} className="ai-piece__go" />
      </Link>
      <div className="ai-acts">
        <Link href={`/fitting-room?g=${encodeURIComponent(g.id)}`} className="ai-act is-main"><Icon name="yourPhoto" size={18} />{c.aiActTry}</Link>
        <button type="button" className="mz-reset ai-act" onClick={a.findSize}><Icon name="ruler" size={18} />{c.aiActSize}</button>
        <button type="button" className="mz-reset ai-act" onClick={a.completeSet}><Icon name="handbag" size={18} />{c.aiActSet}</button>
        <button type="button" className="mz-reset ai-act is-quiet" onClick={a.another}><Icon name="turn" size={18} />{c.aiActOther}</button>
      </div>
    </div>
  );
}

function TryCard() {
  const { c } = useShop();
  const a = useConcierge();
  const id = encodeURIComponent(a.garment?.id ?? '');
  return (
    <div className="ai-card">
      <div className="ai-acts">
        <Link href={`/fitting-room?g=${id}`} className="ai-act is-main"><Icon name="yourPhoto" size={18} />{c.aiWearPhoto}</Link>
        <Link href={`/fitting-room?g=${id}&live=1`} className="ai-act"><Icon name="camera" size={18} />{c.aiWearLive}</Link>
      </div>
    </div>
  );
}

function SizeAsk() {
  const b = useBoutique();
  const { c } = useShop();
  const a = useConcierge();
  const [height, setHeight] = useState(a.knownHeight ? String(a.knownHeight) : '');
  const [usual, setUsual] = useState('M');
  const [fit, setFit] = useState<FitPref>('regular');
  const h = Number(latinDigits(height));
  const bad = height !== '' && (!(h >= 130) || h > 210);
  const sizes = SIZE_ORDER.filter(s => a.garment?.sizes.some(x => x.n === s) ?? true);
  const submit = () => {
    if (bad) return;
    const inputs: SizeInputs = { height: h || 0, usual, fit, bust: 0, len: 'ankle' };
    a.submitSize(inputs);
  };
  return (
    <form className="ai-card ai-form" onSubmit={e => { e.preventDefault(); submit(); }}>
      <label className="ai-field">
        <span>{b.t.height}</span>
        <input inputMode="numeric" autoComplete="off" maxLength={3} value={height} onChange={e => setHeight(e.target.value)} placeholder={num(165, b.lang)} aria-invalid={bad || undefined} aria-describedby={bad ? 'ai-h-err' : undefined} />
      </label>
      {bad && <p className="ai-err" id="ai-h-err">{c.aiScanHeightBad}</p>}
      <div className="ai-field">
        <span id="ai-usual">{b.t.usual}</span>
        <div className="ai-seg" role="group" aria-labelledby="ai-usual">
          {sizes.map(s => <button key={s} type="button" className="mz-reset" aria-pressed={usual === s} onClick={() => setUsual(s)}>{s}</button>)}
        </div>
      </div>
      <div className="ai-field">
        <span id="ai-fit">{b.t.fitPref}</span>
        <div className="ai-seg" role="group" aria-labelledby="ai-fit">
          {([['fitted', b.t.fitted], ['regular', b.t.regular], ['relaxed', b.t.relaxed]] as [FitPref, string][]).map(([k, l]) => (
            <button key={k} type="button" className="mz-reset" aria-pressed={fit === k} onClick={() => setFit(k)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="ai-acts">
        <button type="submit" className="mz-reset ai-act is-main">{c.aiSizeSubmit}</button>
        <button type="button" className="mz-reset ai-act" onClick={() => a.setScanning(true)}><Icon name="camera" size={18} />{c.aiScan}</button>
      </div>
    </form>
  );
}

function SizeCard() {
  const b = useBoutique();
  const { c } = useShop();
  const a = useConcierge();
  const r = a.sized;
  if (!r) return null;
  const { inputs, rec, scanned } = r;
  const from = scanned ? fill(c.aiSizeFromScan, { bust: num(inputs.bust, b.lang) })
    : inputs.height ? fill(c.aiSizeFrom, { height: num(inputs.height, b.lang), usual: inputs.usual })
    : fill(c.aiSizeFromUsual, { usual: inputs.usual });
  return (
    <div className="ai-card ai-size">
      <span className="ai-size__big" dir="ltr">{rec.size}</span>
      <div className="ai-size__txt">
        <p>{from}</p>
        {rec.height !== 'ok' && <p className="is-muted">{rec.height === 'tall' ? c.aiTall : c.aiShort}</p>}
      </div>
      <div className="ai-acts">
        {rec.size !== rec.wanted && <button type="button" className="mz-reset ai-act is-main" onClick={a.another}><Icon name="turn" size={18} />{c.aiActOther}</button>}
        <button type="button" className={`mz-reset ai-act${rec.size === rec.wanted ? ' is-main' : ''}`} onClick={a.addSized}><Icon name="bag" size={18} />{c.aiAddSize}</button>
        <Link href={`/fitting-room?g=${encodeURIComponent(r.garmentId)}`} className="ai-act"><Icon name="yourPhoto" size={18} />{c.aiActTry}</Link>
        <button type="button" className="mz-reset ai-act" onClick={a.completeSet}><Icon name="handbag" size={18} />{c.aiActSet}</button>
        <button type="button" className="mz-reset ai-act is-quiet" onClick={a.editSize}><Icon name="ruler" size={18} />{c.aiActEdit}</button>
      </div>
    </div>
  );
}

/** When the stylist has twice not understood: a person, if the shop has a chat channel. */
function HumanCard() {
  const b = useBoutique();
  const { c } = useShop();
  const link = shopChatLink(b.settings, '');
  if (!link) return null;
  return (
    <div className="ai-card">
      <div className="ai-acts">
        <a href={link} target="_blank" rel="noopener noreferrer" className="ai-act is-main"><Icon name="whatsapp" size={18} />{c.aiHuman}</a>
      </div>
    </div>
  );
}

function SetCard() {
  const b = useBoutique();
  const { c } = useShop();
  const a = useConcierge();
  const g = a.garment;
  if (!g) return null;
  const items = ACCESSORY_KINDS.map(k => (a.picks[k] ? b.byId(a.picks[k]) : undefined)).filter(x => !!x);
  return (
    <div className="ai-card">
      <ul className="ai-tiles">
        {items.map(x => (
          <li key={x.id}>
            <button type="button" className="mz-reset ai-tile" aria-label={b.tx(x.name)} title={b.tx(x.name)} onClick={() => b.openProduct(x.id)}>
              {x.front && <img src={x.front} alt="" loading="lazy" decoding="async" />}
            </button>
          </li>
        ))}
      </ul>
      <p className="ai-total"><span>{c.aiTotal}</span><strong>{b.price(lookTotal(g, a.picks, id => b.byId(id)))}</strong></p>
      <div className="ai-acts">
        <button type="button" className="mz-reset ai-act is-main" onClick={() => a.addLook()}><Icon name="bag" size={18} />{c.aiAddLook}</button>
        <Link href={`/stylist?g=${encodeURIComponent(g.id)}`} className="ai-act">{c.aiLookOpen}</Link>
      </div>
    </div>
  );
}

const CARDS: Record<Card, () => React.ReactNode> = { piece: PieceCard, tryon: TryCard, sizeAsk: SizeAsk, size: SizeCard, set: SetCard, human: HumanCard };

/** Only the latest card of a kind stays live; earlier ones would act on the current garment, not the one they showed. */
const Bubble = memo(function Bubble({ t, showCard, count }: { t: Turn; showCard: boolean; count: number }) {
  const { c } = useShop();
  const CardBody = t.card && showCard ? CARDS[t.card] : null;
  return (
    <motion.li className={`ai-msg${t.me ? ' is-me' : ''}`} layout="position" layoutDependency={count} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.soft}>
      <span className="mz-sr">{t.me ? c.aiYou : c.aiName}: </span>
      <p className="ai-bubble">{t.text}</p>
      {CardBody && <CardBody />}
    </motion.li>
  );
});

/** The message field. It alone follows the text, which the sample types letter by letter. */
function Field() {
  const { c } = useShop();
  const a = useConcierge();
  const text = useSyncExternalStore(a.draft.subscribe, a.draft.get, () => '');
  return (
    <form className="ai-input" onSubmit={e => { e.preventDefault(); if (!a.busy && !a.playing) a.ask(a.draft.get()); }}>
      <input ref={a.inputRef} value={text} maxLength={400} autoComplete="off" aria-label={c.aiPlaceholder} placeholder={c.aiPlaceholder}
        onFocus={() => { if (a.playing || a.sample) a.takeOver(); }} onChange={e => a.draft.set(e.target.value)} />
      <button type="submit" className="mz-reset ai-send" aria-label={c.aiSend} disabled={a.busy || !text.trim()}><Icon name="send" size={20} /></button>
    </form>
  );
}

export function Chat() {
  const { c } = useShop();
  const a = useConcierge();
  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLUListElement>(null);
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  // Newest at the bottom, scrolling only the thread: the page itself never moves under the visitor. The last message
  // is watched, because a card grows into place after the first scroll has already measured it.
  useEffect(() => {
    const el = box.current, last = el?.lastElementChild;
    if (!el || !last) return;
    const down = () => el.scrollTo({ top: el.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
    down();
    const ro = new ResizeObserver(down);
    ro.observe(last);
    return () => ro.disconnect();
  }, [a.turns.length, a.busy, reduce]);
  const lastOf = (card: Card) => a.turns.reduce((n, t) => (t.card === card ? t.id : n), -1);
  // Once the size is answered, the form that asked for it has done its work.
  const showCard = (t: Turn) => !!t.card && lastOf(t.card) === t.id && !(t.card === 'sizeAsk' && lastOf('size') > t.id);
  const touched = a.reached > 0 && !a.sample;
  // On a phone the conversation takes the whole screen once she starts it.
  useEffect(() => {
    // Not when an earlier conversation was restored: she may have come for #size or #wear.
    if (touched && !a.resumed && window.matchMedia('(max-width: 999px)').matches) root.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touched, reduce]);
  return (
    <div ref={root} className={`ai-chat${touched ? ' is-live' : ''}`} onPointerDownCapture={a.halt}>
      <div className="ai-chat__head">
        <span className="ai-avatar" aria-hidden="true"><Icon name="chat" size={18} /></span>
        <span className="ai-chat__who">{c.aiName}</span>
        {a.sample && (
          <span className="ai-chat__sample">
            {c.aiSample}
            <button type="button" className="mz-reset" onClick={a.takeOver}>{c.aiSampleStop}</button>
          </span>
        )}
      </div>
      <ul ref={box} className={`ai-thread${scrolled ? ' is-scrolled' : ''}`} aria-label={c.aiThread} aria-live={a.playing ? 'off' : 'polite'} tabIndex={0}
        onScroll={e => setScrolled(e.currentTarget.scrollTop > 4)}>
        {a.turns.map(t => <Bubble key={t.id} t={t} showCard={showCard(t)} count={a.turns.length} />)}
        <AnimatePresence>
          {a.busy && (
            <motion.li key="typing" className="ai-msg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p className="ai-bubble ai-typing" role="status"><span className="mz-sr">{c.aiThinking}</span><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /></p>
            </motion.li>
          )}
        </AnimatePresence>
      </ul>
      <div className="ai-chips">
        {c.aiChips.map(t => <button key={t} type="button" className="mz-reset ai-chip" disabled={a.busy} onClick={() => a.ask(t)}>{t}</button>)}
      </div>
      <Field />
    </div>
  );
}
