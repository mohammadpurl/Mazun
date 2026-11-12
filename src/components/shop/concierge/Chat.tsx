'use client';
/* eslint-disable @next/next/no-img-element -- transparent cut-outs from the catalogue */
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { fill, latinDigits } from '@/lib/concierge';
import { SIZE_ORDER } from '@/lib/defaults';
import { effectivePrice, type FitPref, type SizeInputs } from '@/lib/fit';
import { shopChatLink } from '@/lib/order-message';
import { lookTotal } from '@/lib/stylist';
import { ACCESSORY_KINDS, type Garment } from '@/lib/types';
import { useBoutique } from '../../boutique/Boutique';
import { productHref } from '../Chrome';
import { Icon, type IconName } from '../Icon';
import { useShop } from '../Shop';
import { SPRING, num } from '../tokens';
import { usePieceHere } from './usePieceHere';
import { useConcierge, type Card, type Turn } from './useConcierge';

function PieceLink({ g }: { g: Garment }) {
  const b = useBoutique();
  return (
    <Link href={productHref(g.id)} className="ai-piece">
      <span className="ai-piece__pic">{(g.front || g.wornFront) && <img src={g.front || g.wornFront} alt="" loading="lazy" decoding="async" />}</span>
      <span className="ai-piece__txt">
        <span className="ai-piece__name">{b.tx(g.name)}</span>
        <span className="ai-piece__price">{b.price(effectivePrice(g))}</span>
      </span>
      <Icon name="next" size={18} className="ai-piece__go" />
    </Link>
  );
}

/** The piece she did not choose herself, ahead of the size, set or try-on she asked for: all it needs is a way to change it. */
function IntroCard() {
  const { c } = useShop();
  const a = useConcierge();
  if (!a.garment) return null;
  return (
    <div className="ai-card">
      <PieceLink g={a.garment} />
      <div className="ai-acts">
        <button type="button" className="mz-reset ai-act is-quiet" onClick={a.another}><Icon name="turn" size={18} />{c.aiActOther}</button>
      </div>
    </div>
  );
}

function PieceCard() {
  const { c } = useShop();
  const a = useConcierge();
  const g = a.garment;
  if (!g) return null;
  return (
    <div className="ai-card">
      <PieceLink g={g} />
      <div className="ai-acts">
        <Link href={`/fitting-room?g=${encodeURIComponent(g.id)}`} className="ai-act is-main"><Icon name="yourPhoto" size={18} />{c.aiActTry}</Link>
        <button type="button" className="mz-reset ai-act" onClick={a.findSize}><Icon name="ruler" size={18} />{c.aiActSize}</button>
        <button type="button" className="mz-reset ai-act" disabled={a.busy} onClick={a.completeSet}><Icon name="handbag" size={18} />{c.aiActSet}</button>
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
  const [usual, setUsual] = useState('');
  const [fit, setFit] = useState<FitPref>('regular');
  const h = Number(latinDigits(height));
  const bad = height !== '' && (!(h >= 130) || h > 210);
  const sizes = SIZE_ORDER.filter(s => a.garment?.sizes.some(x => x.n === s) ?? true);
  const submit = () => {
    if (bad || !usual) return;
    const inputs: SizeInputs = { height: h || 0, usual, fit, bust: 0, len: 'ankle' };
    a.submitSize(inputs, false, h ? fill(c.aiMeHeight, { height: num(h, b.lang), usual }) : fill(c.aiMeUsual, { usual }));
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
      {!usual && <p className="ai-note" id="ai-usual-note">{c.aiPickUsual}</p>}
      <div className="ai-acts">
        <button type="submit" className="mz-reset ai-act is-main" disabled={bad || !usual} aria-describedby={usual ? undefined : 'ai-usual-note'}>{c.aiSizeSubmit}</button>
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
        <button type="button" className="mz-reset ai-act" disabled={a.busy} onClick={a.completeSet}><Icon name="handbag" size={18} />{c.aiActSet}</button>
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
  const path = usePathname();
  const g = a.garment;
  if (!g) return null;
  const rows = [
    { role: b.t.foundation, p: g },
    ...ACCESSORY_KINDS.flatMap(k => { const p = a.picks[k] ? b.byId(a.picks[k]) : undefined; return p ? [{ role: b.t.roles[k], p }] : []; }),
  ];
  return (
    <div className="ai-card">
      <div className="ai-occ" role="group" aria-label={c.aiSetOccasion}>
        {b.t.occ.map((l, i) => <button key={l} type="button" className="mz-reset" aria-pressed={a.occasion === i} disabled={a.busy} onClick={() => a.changeOccasion(i)}>{l}</button>)}
      </div>
      <ul className="ai-rows">
        {rows.map(({ role, p }) => (
          <li key={p.id}>
            <button type="button" className="mz-reset ai-row" data-leaves={p.kind === 'garment' || undefined} disabled={path === productHref(p.id)} onClick={() => b.openProduct(p.id)}>
              <span className="ai-row__pic">{p.front && <img src={p.front} alt="" loading="lazy" decoding="async" />}</span>
              <span className="ai-row__txt"><span>{role}</span><span>{b.tx(p.name)}</span></span>
              <span className="ai-row__price">{b.price(effectivePrice(p))}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="ai-total"><span>{c.aiTotal}</span><strong>{b.price(lookTotal(g, a.picks, id => b.byId(id)))}</strong></p>
      <div className="ai-acts">
        <button type="button" className="mz-reset ai-act is-main" onClick={() => a.addLook()}><Icon name="bag" size={18} />{c.aiAddLook}</button>
      </div>
    </div>
  );
}

/** Once something is in the bag, the way to it. */
function AddedCard() {
  const b = useBoutique();
  const { c } = useShop();
  const a = useConcierge();
  return (
    <div className="ai-card">
      <div className="ai-acts">
        <button type="button" className="mz-reset ai-act is-main" onClick={() => { a.closeChat(); b.openSheet('bag'); }}><Icon name="bag" size={18} />{c.aiViewBag}</button>
      </div>
    </div>
  );
}

const CARDS: Record<Card, () => React.ReactNode> = { piece: PieceCard, intro: IntroCard, tryon: TryCard, sizeAsk: SizeAsk, size: SizeCard, set: SetCard, human: HumanCard, added: AddedCard };

/** Only the latest card of a kind stays live; earlier ones would act on the current garment, not the one they showed. */
const Bubble = memo(function Bubble({ t, showCard, count }: { t: Turn; showCard: boolean; count: number }) {
  const { c } = useShop();
  const CardBody = t.card && showCard ? CARDS[t.card] : null;
  return (
    <motion.li className={`ai-msg${t.me ? ' is-me' : ''}`} layout="position" layoutDependency={count} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.soft}>
      <span className="mz-sr">{t.me ? c.aiYou : c.aiName}: </span>
      <p className="ai-bubble" dir={t.me ? 'auto' : undefined}>{t.text}</p>
      {CardBody && <CardBody />}
    </motion.li>
  );
});

/** The message field, on its own so typing re-renders nothing else. */
function Field() {
  const { c } = useShop();
  const a = useConcierge();
  const text = useSyncExternalStore(a.draft.subscribe, a.draft.get, () => '');
  return (
    <form className="ai-input" onSubmit={e => { e.preventDefault(); if (!a.busy) a.ask(a.draft.get()); }}>
      <input ref={a.inputRef} value={text} dir={text ? 'auto' : undefined} maxLength={400} autoComplete="off" aria-label={c.aiPlaceholder} placeholder={c.aiPlaceholder}
        onChange={e => a.draft.set(e.target.value)} />
      <button type="submit" className="mz-reset ai-send" aria-label={c.aiSend} disabled={a.busy || !text.trim()}><Icon name="send" size={20} /></button>
    </form>
  );
}

const START_ICONS: IconName[] = ['hanger', 'ruler', 'handbag', 'yourPhoto'];

export function Chat() {
  const { c } = useShop();
  const a = useConcierge();
  const box = useRef<HTMLUListElement>(null);
  const pieceHere = usePieceHere();
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const opened = useRef(false);
  // Newest at the bottom. The last message is watched, because a card grows into place after the first scroll has
  // already measured it, and so is the thread, because a phone's keyboard shrinks it.
  useEffect(() => {
    const el = box.current, last = el?.lastElementChild;
    if (!el || !last) return;
    const down = () => el.scrollTo({ top: el.scrollHeight, behavior: reduce || !opened.current ? 'auto' : 'smooth' });
    down();
    opened.current = true;
    const ro = new ResizeObserver(down);
    ro.observe(last);
    ro.observe(el);
    return () => ro.disconnect();
  }, [a.turns.length, a.busy, reduce]);
  const lastOf = (card: Card) => a.turns.reduce((n, t) => (t.card === card ? t.id : n), -1);
  // Once the size is answered, the form that asked for it has done its work.
  // Once it is in the bag, the card that offered to add it has too; leaving it would invite adding it twice.
  // And a newer piece retires whatever was shown for the old one, which would otherwise quietly change under its caption.
  const showCard = (t: Turn) => !!t.card && lastOf(t.card) === t.id && !(t.card === 'sizeAsk' && lastOf('size') > t.id)
    && !((t.card === 'size' || t.card === 'set') && lastOf('added') > t.id)
    && !((t.card === 'set' || t.card === 'tryon' || t.card === 'intro') && lastOf('piece') > t.id);
  return (
    <div className="ai-chat">
      <div className="ai-chat__head">
        <span className="ai-avatar" dir="ltr" aria-hidden="true">AI</span>
        <span className="ai-chat__who">{c.aiName}</span>
        {a.reached > 0 && <button type="button" className="mz-reset mz-icon-btn ai-chat__new" aria-label={c.aiNew} title={c.aiNew} onClick={() => { a.restart(); a.openChat(pieceHere()); box.current?.focus({ preventScroll: true }); }}><Icon name="plus" size={20} /></button>}
        <button type="button" className="mz-reset mz-icon-btn ai-chat__close" aria-label={c.close} onClick={a.closeChat}><Icon name="close" /></button>
      </div>
      <ul ref={box} className={`ai-thread${scrolled ? ' is-scrolled' : ''}`} aria-label={c.aiThread} aria-live="polite" tabIndex={0}
        onScroll={e => setScrolled(e.currentTarget.scrollTop > 4)}>
        {a.turns.map(t => <Bubble key={t.id} t={t} showCard={showCard(t)} count={a.turns.length} />)}
        {a.reached === 0 && (
          <li className="ai-msg">
            <div className="ai-starts">
              {c.aiStarts.map((t, i) => (
                <motion.button key={t} type="button" className="mz-reset ai-start" disabled={a.busy} onClick={() => (i === 0 ? a.findPiece(t) : a.ask(t))}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay: 0.1 + i * 0.06 }}>
                  <Icon name={START_ICONS[i]} size={20} />{t}
                </motion.button>
              ))}
            </div>
          </li>
        )}
        <AnimatePresence>
          {a.busy && (
            <motion.li key="typing" className="ai-msg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p className="ai-bubble ai-typing" role="status"><span className="mz-sr">{c.aiThinking}</span><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /></p>
            </motion.li>
          )}
        </AnimatePresence>
      </ul>
      {a.reached === 1 && !a.busy && (
        <div className="ai-chips">
          {c.aiChips.map(t => <button key={t} type="button" className="mz-reset ai-chip" disabled={a.busy} onClick={() => a.ask(t)}>{t}</button>)}
        </div>
      )}
      <Field />
    </div>
  );
}
