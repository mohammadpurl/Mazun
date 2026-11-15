'use client';
/* eslint-disable @next/next/no-img-element -- garment cut-outs and the customer's photo as data URLs */
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { effectivePrice } from '@/lib/fit';
import { readPhotoOrVideo } from '@/lib/photo';
import { ONE_SIZE } from '@/lib/defaults';
import type { Garment } from '@/lib/types';
import { useBoutique } from '../boutique/Boutique';
import { InfoDialog, productHref } from './Chrome';
import { savedSize } from './concierge/saved';
import { useOpenChat } from './concierge/useConcierge';
import { FadeImg } from './fx';
import { LiveMirror } from './LiveMirror';
import { Icon, type DuoIconName, type IconName } from './Icon';
import { useShop } from './Shop';
import { EASE, SPRING, cardBg, num } from './tokens';

type Source = { kind: 'own'; url: string } | { kind: 'model' } | null;
type Step = 1 | 2 | 3;
const TIP_ICONS: DuoIconName[] = ['frame', 'pose', 'light', 'shirt'];
const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime';

/** The house model: head, neck and a dress form in the shape of the body, drawn as in the design. */
function HouseModel({ g, label }: { g?: Garment; label: string }) {
  return (
    <div className="mz-model" role="img" aria-label={label}>
      <span className="mz-model__head" /><span className="mz-model__neck" />
      {g?.front ? <img src={g.front} alt="" /> : <span className="mz-model__body" />}
    </div>
  );
}

/** The house model wearing a piece: its photo made in advance (`wornFront`), fading in once it has loaded while the
 *  studio shimmers. A piece with no such photo, or whose photo fails, shows its product photo alone and says so; with
 *  no picture at all, the dress form. `tagged` adds the note that says what the picture is. */
function ModelFigure({ g, failed, onFail, onShown, tagged }: { g?: Garment; failed: boolean; onFail: () => void; onShown: (src: string) => void; tagged: boolean }) {
  const b = useBoutique();
  const { c } = useShop();
  const reduce = useReducedMotion();
  const worn = !!g?.wornFront && !failed;
  const src = worn ? g!.wornFront : g?.front;
  return (
    <>
      <span className="mz-studio__floor" />
      {g && src
        ? <FadeImg key={src} className="mz-studio__photo is-worn" src={src} alt={worn ? `${c.wearing} ${b.tx(g.name)}` : b.tx(g.name)} draggable={false}
            fetchPriority="high" onReady={() => onShown(src)} onError={worn ? onFail : undefined}
            fallback={worn ? undefined : <HouseModel label={c.modelTag} />} />
        : <HouseModel label={c.modelTag} />}
      {tagged && g && (
        <motion.span className="mz-tag is-note" dir={b.dir} initial={reduce ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.soft}>
          {worn ? `${c.modelTag} · ${c.sampleTag}` : c.productTag}
        </motion.span>
      )}
    </>
  );
}

const MODEL: Source = { kind: 'model' };

/** True on a data-saving or 2G connection, where nothing is fetched ahead. */
function thrifty() {
  const n = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!n?.saveData || /2g/.test(n?.effectiveType ?? '');
}
/** Runs `fn` when the browser is idle (or soon, where it cannot say); returns the cancel. Skipped on a thrifty connection. */
function whenIdle(fn: () => void): () => void {
  if (thrifty()) return () => {};
  if ('requestIdleCallback' in window) { const id = requestIdleCallback(fn, { timeout: 3000 }); return () => cancelIdleCallback(id); }
  const t = setTimeout(fn, 1200);
  return () => clearTimeout(t);
}
const warm = (src: string) => { new Image().src = src; };

/** The fitting room: photo → abaya → preview. A real photo goes to the AI try-on service when it is connected
 *  (`/api/ai`, action `tryon`) and before and after are compared with a slider. The house model wears the abaya in a
 *  photo made in advance (`wornFront`), shown at once and tagged as illustrative: no AI is pretended. With no image AI
 *  at all (`ai.photo` off), her own photo is not offered (it could not be dressed); the house model and the live
 *  mirror are. Leaving the preview cancels a try-on that is still running. */
export function TryOnPage() {
  const b = useBoutique();
  const openChat = useOpenChat();
  const query = useSearchParams();
  const queryPiece = query.get('g'), queryLive = query.get('live'), queryModel = query.get('model');
  /** Whether her own photo can be dressed: the shop's image AI, or the free public model. */
  const photoAI = b.ai.photo;
  const { c, picks } = useShop();
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>(1);
  const [source, setSource] = useState<Source>(null);
  const [gid, setGid] = useState<string | null>(null);
  const [dressing, setDressing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [failed, setFailed] = useState<false | 'busy' | true>(false);
  const [size, setSize] = useState<string | null>(null);
  const [need, setNeed] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [guide, setGuide] = useState(false);
  const [live, setLive] = useState(false);
  const fromLive = useRef(false);
  /** The piece whose house-model photo failed to load: it shows its product photo instead. */
  const [wornBad, setWornBad] = useState<string | null>(null);
  const wornWarm = useRef(false);
  /** The house-model picture last seen on screen: until the current one arrives the studio is marked busy. */
  const [shownSrc, setShownSrc] = useState<string | null>(null);
  /** Set when step two opens from the start card on a phone: the tiles are brought into view once they are there. */
  const wantGrid = useRef(false);
  const studio = useRef<HTMLDivElement>(null);
  const run = useRef(0);
  const ctrl = useRef<AbortController | null>(null);
  const dragDepth = useRef(0);
  const sizes = useRef<HTMLDivElement>(null);
  const clip = useMotionValue(100);
  const clipPath = useTransform(clip, v => `inset(0 0 0 ${v}%)`);
  const splitLeft = useTransform(clip, v => `${v}%`);

  const garments = b.garments;
  // The address names the piece; the chat can change it while she is on this page.
  useEffect(() => {
    const named = b.byId(queryPiece);
    if (named?.kind === 'garment' && named.id !== gid) {
      // A result on screen belongs to the piece she has just left.
      cancelRun();
      setResult(null);
      setAdded(null);
      setFailed(false);
      setStep(s => (s === 3 ? 2 : s));
      setGid(named.id);
    }
  }, [queryPiece]); // eslint-disable-line react-hooks/exhaustive-deps
  // Apart from the piece: taking live= off the address must not put back a piece she changed inside the mirror.
  useEffect(() => { if (queryLive === '1') setLive(true); }, [queryLive]);
  // A link asking for the house model (model=1, used while photo try-on is off) shows the named piece on her at once,
  // unless it is already on screen; without a valid piece she chooses one (and model= leaves the address).
  // Keep this effect after the piece effect above: that one moves step 3 back to 2, and this one's preview must win.
  const goneSaid = useRef<string | null>(null);
  useEffect(() => {
    if (queryModel !== '1') return;
    const named = b.byId(queryPiece);
    if (named?.kind === 'garment') {
      if (!(source?.kind === 'model' && step === 3 && gid === named.id)) seeOnModel(named);
      return;
    }
    // A link to a piece that has left the collection says so, rather than quietly showing another.
    if (queryPiece && goneSaid.current !== queryPiece) { goneSaid.current = queryPiece; b.toast(c.pieceGone); }
    cancelRun(); setSource(MODEL); setResult(null); setStep(2);
    const u = new URL(location.href);
    u.searchParams.delete('model');
    history.replaceState(null, '', u);
  }, [queryModel, queryPiece]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const latestPick = [...picks].reverse().map(id => b.byId(id)).find(x => x?.kind === 'garment');
    if (latestPick) setGid(g => g ?? latestPick.id);
  }, [b.byId, picks]); // eslint-disable-line react-hooks/exhaustive-deps

  // However the mirror closes, the address stops asking for it, so the same link works again and a reload does not reopen
  // it. The null state lets Next carry its own and keep useSearchParams in step.
  const wasLive = useRef(false);
  useEffect(() => {
    if (live) { wasLive.current = true; return; }
    if (!wasLive.current) return;
    wasLive.current = false;
    const u = new URL(location.href);
    if (!u.searchParams.has('live')) return;
    u.searchParams.delete('live');
    history.replaceState(null, '', u);
  }, [live]);

  const g = b.byId(gid) ?? garments[0];
  // The address follows the house model's result: ?g=<piece>&model=1 while it is on screen, so Back from the piece's
  // page or a reload shows it again; leaving the result takes model= off, so the next link asking for it still works.
  const wasOnModel = useRef(false);
  const onModel = source?.kind === 'model' && step === 3 && !!g;
  useEffect(() => {
    if (!onModel && !wasOnModel.current) return;
    wasOnModel.current = onModel;
    const u = new URL(location.href);
    if (onModel && g) { u.searchParams.set('g', g.id); u.searchParams.set('model', '1'); } else u.searchParams.delete('model');
    if (u.href !== location.href) history.replaceState(null, '', u);
  }, [onModel, g?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  /** The picture the house model's figure is showing now (her worn photo, or the product photo if that failed). */
  const figSrc = g ? (g.wornFront && wornBad !== g.id ? g.wornFront : g.front) : '';
  // The abaya cut-outs (small) load when the page is idle, so step two's tiles are ready when she gets there. The house
  // model's photos follow only after the one she is looking at has arrived (warmWorn), so they never compete with it.
  useEffect(() => whenIdle(() => garments.forEach(x => { if (x.front) warm(x.front); })), [garments]);
  const stopWarm = useRef(() => {});
  const warmWorn = () => {
    if (wornWarm.current) return;
    wornWarm.current = true;
    stopWarm.current = whenIdle(() => garments.slice(0, 12).forEach(x => { if (x.wornFront) warm(x.wornFront); }));
  };
  useEffect(() => () => stopWarm.current(), []);
  const cancelRun = () => { run.current++; ctrl.current?.abort(); ctrl.current = null; setDressing(false); };
  useEffect(() => () => { ctrl.current?.abort(); }, []);
  const goStep = (n: Step) => { if (n === step) return; if (n === 3) preview(); else { cancelRun(); setStep(n); } };

  async function choose(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try { setSource({ kind: 'own', url: await readPhotoOrVideo(file) }); setResult(null); }
    catch { b.toast(file.type.startsWith('video') ? b.t.badVideo : b.t.badFile); }
    finally { setBusy(false); }
  }

  /** Scrolls an element to just under the sticky header, unless most of it is already in view. */
  function bringIntoView(el: HTMLElement | null) {
    if (!el) return;
    const bar = document.querySelector('.mz-header');
    const head = bar && getComputedStyle(bar).position !== 'relative' ? bar.getBoundingClientRect().bottom : 0;
    const r = el.getBoundingClientRect();
    const seen = Math.min(r.bottom, innerHeight) - Math.max(r.top, head);
    if (r.top >= head - 1 && seen >= Math.min(r.height, innerHeight - head) * 0.6) return;
    scrollTo({ top: scrollY + r.top - head - 12, behavior: reduce ? 'auto' : 'smooth' });
  }
  /** Brings the studio into view when the preview starts: on a phone the button sits below it, and without this she
   *  would be left looking at the sizes and the footer while the result appears above. */
  const showStudio = () => requestAnimationFrame(() => bringIntoView(studio.current));

  async function preview(src: Source = source, piece: Garment | undefined = g) {
    if (!src || !piece) return;
    cancelRun();
    setStep(3); setFailed(false); setAdded(null); clip.set(100);
    // A free-size piece has nothing to choose, so its one size is picked for the customer.
    // The size the stylist already found for this piece comes along.
    const fromChat = savedSize(piece.id);
    setSize(s => (piece.sizes.some(x => x.n === s && x.ok) ? s : piece.sizes.length === 1 && piece.sizes[0].n === ONE_SIZE && piece.sizes[0].ok ? ONE_SIZE : piece.sizes.some(x => x.n === fromChat && x.ok) ? fromChat : null));
    showStudio();
    // The house model's photo is made in advance, and without an image AI her own photo cannot be dressed: neither
    // has anything to wait for, so neither plays the "dressing" scene. (Her own photo without an image AI cannot be
    // reached today, since nothing asks for one; the branch keeps that state honest if it ever is.)
    if (src.kind === 'model' || !photoAI) { setResult(src.kind === 'model' ? 'model' : 'pending'); return; }
    setDressing(true); setResult(null);
    const id = run.current;
    const minWait = new Promise(r => setTimeout(r, reduce ? 300 : 2800));
    const done = (img: string) => {
      if (id !== run.current) return;
      setResult(img); setDressing(false);
      if (reduce || img === 'pending') clip.set(50); else animate(clip, 50, { duration: 1.4, ease: EASE });
    };
    const ac = new AbortController();
    ctrl.current = ac;
    try {
      // The shop's own image AI when it has one, otherwise the free public model (slower, rationed).
      const r = b.ai.image
        ? await fetch('/api/ai', { method: 'POST', signal: ac.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'tryon', person: src.url, garmentId: piece.id, color: 0, lang: b.lang }) })
        : await fetch('/api/tryon/free', { method: 'POST', signal: ac.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ person: src.url, garmentId: piece.id }) });
      if (r.status === 429) { b.toast(b.t.rateLimited); throw new Error('rate'); }
      if (!r.ok) { const { error } = await r.json().catch(() => ({ error: '' })); throw new Error(error === 'busy' || r.status === 503 ? 'busy' : String(r.status)); }
      const { image } = await r.json();
      await minWait;
      done(image);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      if (id === run.current) setFailed((e as Error).message === 'busy' ? 'busy' : true);
      done('pending');
    }
  }

  // A picture from the live mirror goes straight to the realistic preview once its photo and abaya are in state.
  useEffect(() => {
    if (!fromLive.current || source?.kind !== 'own') return;
    fromLive.current = false;
    preview();
  }, [source, gid]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Shows a piece on the house model straight away: from the start card, a model=1 link, the mirror, a failed photo. */
  function seeOnModel(piece: Garment | undefined = g) {
    if (piece) setGid(piece.id);
    setSource(MODEL);
    preview(MODEL, piece);
  }
  /** The house model with no piece named yet: she picks one in step two (on a phone the tiles are scrolled to). */
  function chooseOnModel() {
    cancelRun(); setSource(MODEL); setResult(null);
    wantGrid.current = true;
    setStep(2);
  }

  function add() {
    if (!g) return;
    if (!size || !g.sizes.some(x => x.n === size && x.ok)) {
      setNeed(true);
      sizes.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      sizes.current?.querySelector<HTMLButtonElement>('.mz-size:not(:disabled)')?.focus({ preventScroll: true });
      return;
    }
    b.addToBag(g.id, 0, size); setNeed(false); setAdded(size);
    b.toast(size === ONE_SIZE ? `${b.t.added} — ${b.t.oneSize}` : `${c.added} ${size}`);
  }
  async function share() {
    if (!g) return;
    const url = `${location.origin}${productHref(g.id)}`;
    try {
      if (navigator.share) await navigator.share({ title: b.tx(g.name), url });
      else { await navigator.clipboard.writeText(url); b.toast(c.linkCopied); }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') { try { await navigator.clipboard.writeText(url); b.toast(c.linkCopied); } catch { /* no clipboard */ } }
    }
  }
  /** Her own photo goes to the free public model (no shop AI configured): it is slow, and she is told first. */
  const freeRun = source?.kind === 'own' && !b.ai.image && b.ai.free;
  const realImage = result && result !== 'model' && result !== 'pending' ? result : null;
  const imageExt = realImage?.match(/^data:image\/(png|jpeg|webp)/)?.[1]?.replace('jpeg', 'jpg') ?? 'png';

  const steps: [Step, string][] = [[1, photoAI ? c.s1 : c.s1Soon], [2, c.s2], [3, c.s3]];
  const stepOf = c.stepOf.replace('{n}', num(step, b.lang));
  const fileA = useRef<HTMLInputElement>(null), fileB = useRef<HTMLInputElement>(null);
  const openGuide = () => { if (g?.chart) b.openSize({ garmentId: g.id, onUse: s => { setSize(s); setNeed(false); } }); else setGuide(true); };
  const soldOut = !g?.sizes.some(s => s.ok);
  const sizeName = (n: string) => (n === ONE_SIZE ? b.t.oneSize : n);
  const pulse = reduce ? undefined : { opacity: [0.55, 1, 0.55] };

  const primary: { label: string; icon: IconName; off: boolean; go: () => void } = step === 1
    ? { label: c.continue, icon: 'next', off: !source, go: () => setStep(2) }
    : step === 2 ? { label: c.seePreview, icon: 'hanger', off: !g, go: () => preview() }
    : { label: soldOut ? c.soldOut : c.addToBag, icon: 'bag', off: dressing || soldOut, go: add };

  return (
    <main className="mz-try-page">
      <input ref={fileA} type="file" accept={ACCEPT} hidden onChange={e => { choose(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={fileB} type="file" accept="image/*" capture="user" hidden onChange={e => { choose(e.target.files?.[0]); e.target.value = ''; }} />
      <div className="mz-wrap mz-try-page__in">
        <div className="mz-try-page__head">
          <div>
            <p className="mz-eyebrow is-icon"><Icon name="hanger" size={20} />{c.eyebrow}</p>
            <h1>{photoAI ? c.title : c.titleSoon}</h1>
          </div>
          <ol aria-label={c.stepsLabel} className="mz-steps-nav">
            {steps.map(([n, label], i) => {
              const isDone = n < step, current = n === step;
              return (
                <li key={n}>
                  {i > 0 && <span className="mz-steps-nav__line" aria-hidden="true"><motion.span initial={false} animate={{ scaleX: n <= step ? 1 : 0 }} transition={SPRING.soft} /></span>}
                  <button type="button" className={`mz-reset${current ? ' is-current' : ''}${isDone ? ' is-done' : ''}`} aria-current={current ? 'step' : undefined}
                    disabled={n > 1 && !source} onClick={() => goStep(n)}>
                    <span className="mz-steps-nav__dot">{isDone ? <Icon name="check" size={18} /> : num(n, b.lang)}</span>{label}
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mz-segs">
            <p><span>{steps[step - 1][1]}</span><span>{stepOf}</span></p>
            <div>{steps.map(([n, label]) => <button key={n} type="button" className="mz-reset" aria-label={label} disabled={n > 1 && !source} onClick={() => goStep(n)}><span><motion.span initial={false} animate={{ scaleX: n <= step ? 1 : 0 }} transition={SPRING.soft} /></span></button>)}</div>
          </div>
        </div>

        <div className="mz-try-page__body">
          <div ref={studio} className={`mz-studio${drag ? ' is-drag' : ''}`} dir="ltr" aria-busy={dressing || (source?.kind === 'model' && !!figSrc && shownSrc !== figSrc)}
            onDragEnter={e => { e.preventDefault(); dragDepth.current++; if (step === 1 && photoAI) setDrag(true); }}
            onDragOver={e => e.preventDefault()}
            onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDrag(false); }}
            onDrop={e => { e.preventDefault(); dragDepth.current = 0; setDrag(false); if (step !== 1) return; if (photoAI) choose(e.dataTransfer.files?.[0]); else if (e.dataTransfer.files?.length) b.toast(c.photoSoon); }}>
            <AnimatePresence mode="wait">
              {!source && (photoAI ? (
                <motion.div key="drop" className="mz-drop" dir={b.dir} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease: EASE }}>
                  <motion.span className="mz-drop__ic" aria-hidden="true" animate={pulse} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}><Icon name="yourPhoto" className="is-big" /></motion.span>
                  <p className="mz-drop__title"><span className="mz-only-wide-inline">{c.dropTitle}</span><span className="mz-only-phone">{c.dropTitleM}</span></p>
                  <p className="mz-drop__or mz-only-wide-inline">{c.or}</p>
                  <div className="mz-drop__btns">
                    <button type="button" className="mz-reset mz-btn is-main" onClick={() => setLive(true)}><Icon name="camera" size={20} />{c.liveCta}</button>
                    <button type="button" className="mz-reset mz-btn is-main mz-only-phone-flex" disabled={busy} onClick={() => fileB.current?.click()}><Icon name="yourPhoto" size={20} />{c.camera}</button>
                    <button type="button" className="mz-reset mz-btn is-main" disabled={busy} onClick={() => fileA.current?.click()}><Icon name="upload" size={20} className="mz-only-wide-inline" /><Icon name="library" size={20} className="mz-only-phone" /><span className="mz-only-wide-inline">{busy ? b.t.readingVideo : c.choose}</span><span className="mz-only-phone">{busy ? b.t.readingVideo : c.library}</span></button>
                    <button type="button" className="mz-reset mz-btn is-outline" onClick={() => setSource({ kind: 'model' })}><Icon name="model" size={20} />{c.model}</button>
                  </div>
                  <p className="mz-drop__formats">{c.formats}</p>
                </motion.div>
              ) : (
                // No image AI: her own photo could not be dressed, so it is not asked for. The house model and the live
                // mirror (which runs on the phone itself) are offered, and she is told plainly that her photo comes later.
                <motion.div key="drop-soon" className="mz-drop is-soon" dir={b.dir} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease: EASE }}>
                  <span className="mz-drop__ic" aria-hidden="true"><Icon name="model" className="is-big" /></span>
                  <p className="mz-drop__title">{c.dropTitleSoon}</p>
                  <div className="mz-drop__btns">
                    {/* A piece already named (by a link or the stylist) is shown on the model at once; otherwise she picks one. */}
                    <button type="button" className="mz-reset mz-btn is-main" onClick={() => { if (gid) seeOnModel(); else chooseOnModel(); }}><Icon name="model" size={20} />{c.seeOnModel}</button>
                    <button type="button" className="mz-reset mz-btn is-outline" onClick={() => setLive(true)}><Icon name="camera" size={20} />{c.liveCta}</button>
                  </div>
                  <p className="mz-drop__formats">{c.photoSoon}</p>
                </motion.div>
              ))}
              {source && (
                <motion.div key="fig" className="mz-studio__fig" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, ease: EASE }}>
                  {/* The house model wears the chosen piece from the moment she is chosen: no blank dress form. */}
                  {source.kind === 'own'
                    ? <img className="mz-studio__photo" src={source.url} alt={c.yourPhoto} />
                    : <ModelFigure g={g} failed={wornBad === g?.id} onFail={() => setWornBad(g?.id ?? null)} onShown={s => { setShownSrc(s); if (s === g?.wornFront) warmWorn(); }} tagged />}
                </motion.div>
              )}
            </AnimatePresence>

            {/* The house model's result is the figure itself (ModelFigure above); only her own photo gets a layer over it. */}
            {source?.kind === 'own' && step === 3 && !dressing && result && (
              <>
                {/* Only a real result is compared with the slider; a note shows whole. */}
                <motion.div className="mz-studio__after" style={realImage ? { clipPath } : undefined}>
                  {realImage && <img className="mz-studio__photo" src={realImage} alt={`${c.after} — ${g ? b.tx(g.name) : ''}`} />}
                  {result === 'pending' && (
                    <>
                      <img className="mz-studio__photo is-veiled" src={source.url} alt="" />
                      <div className="mz-studio__pending" dir={b.dir}>
                        {g?.front && <img src={g.front} alt="" />}
                        <p>{!photoAI ? c.photoSoon : failed === 'busy' ? c.freeBusy : failed ? b.t.errT : c.ownPlaceholder}</p>
                        {failed && photoAI && <button type="button" className="mz-reset mz-btn is-main" onClick={() => preview()}><Icon name="again" size={18} />{c.tryAgain}</button>}
                        {!photoAI && <button type="button" className="mz-reset mz-btn is-main" onClick={() => seeOnModel()}><Icon name="model" size={18} />{c.seeOnModel}</button>}
                      </div>
                    </>
                  )}
                </motion.div>
                {realImage && (
                  <>
                    <motion.span className="mz-studio__split" style={{ left: splitLeft }} aria-hidden="true" />
                    <span className="mz-tag is-start">{c.before}</span>
                    <span className="mz-tag is-end">{c.after}</span>
                    <input className="mz-range" type="range" min={0} max={100} defaultValue={50} onChange={e => clip.set(+e.target.value)} aria-label={c.compare} />
                    <motion.span className="mz-knob" style={{ left: splitLeft }} aria-hidden="true"><Icon name="swap" weight="duotone" /></motion.span>
                  </>
                )}
              </>
            )}

            {source?.kind === 'own' && step === 1 && (
              <motion.div className="mz-guides" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }}>
                <span className="is-head"><i>{c.guideHead}</i></span><span className="is-feet"><i>{c.guideFeet}</i></span>
                <b className="tl" /><b className="tr" /><b className="bl" /><b className="br" />
              </motion.div>
            )}
            {/* For the house model the figure's own tag says what it is; this chip is for her photo. */}
            {source?.kind === 'own' && step === 1 && (
              <motion.span className="mz-source" dir={b.dir} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.soft}><Icon name="done" size={18} />{c.photoReady}</motion.span>
            )}
            <AnimatePresence>
              {step === 2 && g && source?.kind === 'own' && (
                <motion.div key={g.id} className="mz-chosen" dir={b.dir} initial={{ opacity: 0, y: 18, rotateY: -12 }} animate={{ opacity: 1, y: 0, rotateY: 0 }} exit={{ opacity: 0, y: 10 }} transition={SPRING.soft}>
                  <span>{c.selected}</span>
                  {g.front && <FadeImg src={g.front} alt="" draggable={false} />}
                  <b>{b.tx(g.name)}</b>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {dressing && step === 3 && (
                <motion.div className="mz-veil" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
                  {!reduce && <motion.span className="mz-veil__scan" animate={{ y: ['-110%', '260%'] }} transition={{ duration: 2.4, repeat: Infinity, ease: EASE }} />}
                  <div className="mz-veil__label" dir={b.dir}><motion.span className="mz-veil__ic" aria-hidden="true" animate={pulse} transition={{ duration: 2.4, repeat: Infinity }}><Icon name="hanger" /></motion.span>{c.dressing}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mz-panel">
            <AnimatePresence mode="wait">
              <motion.div key={`${step}-${dressing}`} className="mz-panel__step" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={SPRING.soft}>
                {step === 1 && (
                  <>
                    <div className="mz-panel__head"><p className="mz-only-wide-inline">{stepOf}</p><h2>{photoAI ? c.p1Title : c.p1TitleSoon}</h2><p>{photoAI ? c.p1Body : c.p1BodySoon}</p></div>
                    {/* The photo tips and the note on where her photo goes only matter when a photo is asked for. */}
                    {photoAI && <ul className="mz-tips">{c.tips.map((tip, i) => <li key={tip}><span className="mz-chip"><Icon name={TIP_ICONS[i] ?? 'check'} weight="duotone" /></span>{tip}</li>)}</ul>}
                    {photoAI && <p className="mz-note"><Icon name="lock" size={18} />{!b.ai.image && b.ai.free ? c.freeConsent : c.privacy}</p>}
                    {/* Without photo try-on the start card's two choices are the only actions, so no disabled Continue competes with them. */}
                    {(photoAI || source) && (
                      <div className="mz-panel__acts mz-only-wide-flex">
                        <button type="button" className="mz-reset mz-btn is-main" disabled={!source} onClick={() => setStep(2)}>{c.continue}<Icon name="next" size={20} className="mz-arrow" /></button>
                        {source && <SourceSwitch source={source} photoAI={photoAI} onPhoto={() => fileA.current?.click()} onModel={() => setSource(MODEL)} />}
                        {source && <button type="button" className="mz-reset mz-link" onClick={() => setLive(true)}><Icon name="camera" size={18} />{c.liveCta}</button>}
                      </div>
                    )}
                    {source && <div className="mz-only-phone-flex mz-panel__acts"><SourceSwitch source={source} photoAI={photoAI} onPhoto={() => fileA.current?.click()} onModel={() => setSource(MODEL)} /><button type="button" className="mz-reset mz-link" onClick={() => setLive(true)}><Icon name="camera" size={18} />{c.liveCta}</button></div>}
                  </>
                )}
                {step === 2 && (
                  <>
                    <div className="mz-panel__head"><p className="mz-only-wide-inline">{stepOf}</p><h2>{c.p2Title}</h2><p>{source?.kind === 'model' ? c.p2BodyModel : c.p2Body}</p></div>
                    <div className="mz-pickgrid" role="group" aria-label={c.p2Title}
                      // Opened from the start card on a phone, the tiles sit below the studio: they are brought into view.
                      ref={el => { if (!el || !wantGrid.current) return; wantGrid.current = false; if (matchMedia('(max-width: 900px)').matches) requestAnimationFrame(() => bringIntoView(el.closest('.mz-panel'))); }}>
                      {[...picks.map(id => b.byId(id)).filter((x): x is Garment => x?.kind === 'garment'), ...garments.filter(x => !picks.includes(x.id))].map(x => (
                        <motion.button key={x.id} type="button" className="mz-reset mz-pickgrid__item" aria-pressed={x.id === g?.id} aria-label={b.tx(x.name)} style={{ background: cardBg(x.colors[0]?.hex) }}
                          onClick={() => setGid(x.id)} whileHover={{ y: -4 }} transition={SPRING.soft}>
                          {x.front && <FadeImg src={x.front} alt="" draggable={false} fallback={<Icon name="hanger" className="mz-pickgrid__none" />} />}
                          {picks.includes(x.id) && <span className="mz-pickgrid__pick" aria-hidden="true"><Icon name="hanger" size={14} /></span>}
                          <AnimatePresence>{x.id === g?.id && <motion.span className="mz-pickgrid__check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={SPRING.soft}><Icon name="check" size={16} /></motion.span>}</AnimatePresence>
                        </motion.button>
                      ))}
                    </div>
                    {g && <p className="mz-panel__sel"><span>{b.tx(g.name)}</span><span>{b.price(effectivePrice(g))}</span></p>}
                    {freeRun && <p className="mz-note"><Icon name="info" size={18} />{c.freeConsent}</p>}
                    <div className="mz-panel__acts mz-only-wide-flex">
                      <button type="button" className="mz-reset mz-btn is-main" onClick={() => preview()}><Icon name="hanger" size={20} />{c.seePreview}</button>
                      <button type="button" className="mz-reset mz-link" onClick={() => setStep(1)}>{c.stepBack}</button>
                    </div>
                  </>
                )}
                {step === 3 && dressing && g && (
                  <>
                    <div className="mz-panel__head"><p className="mz-only-wide-inline">{stepOf}</p><h2>{c.dressing}</h2><p>{freeRun ? c.freeDressing : c.dressingSub}</p></div>
                    <div role="progressbar" aria-label={c.dressing} aria-valuetext={freeRun ? c.freeDressing : undefined} className="mz-progress"><motion.span initial={{ scaleX: 0 }} animate={{ scaleX: freeRun ? 0.9 : 1 }} transition={{ duration: reduce ? 0.3 : freeRun ? 40 : 2.8, ease: freeRun ? 'easeOut' : EASE }} /></div>
                    <div className="mz-panel__mini">{g.front && <FadeImg src={g.front} alt="" draggable={false} />}<span>{b.tx(g.name)}</span></div>
                  </>
                )}
                {step === 3 && !dressing && g && (
                  <>
                    <div className="mz-panel__head">
                      <p className="mz-only-wide-inline">{stepOf}</p>
                      <h2>{b.tx(g.name)}</h2>
                      <p className="mz-panel__meta"><span>{b.price(effectivePrice(g))}</span><span aria-hidden="true">|</span>
                        {g.colors[0] && <span><span className="mz-dot" style={{ background: g.colors[0].hex }} />{b.tx(g.colors[0].name)}</span>}</p>
                    </div>
                    <div className="mz-pd__sizes" role="group" aria-labelledby="mz-to-size" ref={sizes}>
                      <div className="mz-pd__sizehead">
                        <p id="mz-to-size">{c.size}</p>
                        <button type="button" className="mz-reset mz-link is-main" onClick={openGuide}><Icon name="ruler" size={18} />{c.sizeGuide}</button>
                      </div>
                      <div className="mz-pd__grid">
                        {g.sizes.map(s => <button key={s.n} type="button" className="mz-reset mz-size" aria-pressed={size === s.n} disabled={!s.ok}
                          aria-label={s.ok ? sizeName(s.n) : `${sizeName(s.n)} — ${c.soldOut}`} title={s.ok ? undefined : c.soldOut} onClick={() => { setSize(s.n); setNeed(false); setAdded(null); }}>{sizeName(s.n)}</button>)}
                      </div>
                      {need && <p role="alert" className="mz-pd__need"><Icon name="alert" size={18} />{c.selectSize}</p>}
                    </div>
                    <div className="mz-panel__actions">
                      <button type="button" className="mz-reset mz-btn is-main is-block mz-only-wide-flex" disabled={soldOut} onClick={add}><Icon name="bag" size={20} />{soldOut ? c.soldOut : c.addToBag}</button>
                      {added && <p role="status" className="mz-pd__added"><Icon name="done" size={18} />{added === ONE_SIZE ? `${b.t.added} — ${b.t.oneSize}` : `${c.added} ${added}`}</p>}
                      <div className="mz-trio">
                        <button type="button" className="mz-reset" onClick={() => goStep(2)}><Icon name="again" />{c.tryAnother}</button>
                        <button type="button" className="mz-reset" onClick={() => setLive(true)}><Icon name="camera" />{c.liveCta}</button>
                        {realImage ? <a href={realImage} download={`mazun-${g.id}.${imageExt}`}><Icon name="save" />{c.save}</a> : <Link href={productHref(g.id)}><Icon name="view" />{c.viewPiece}</Link>}
                        <button type="button" className="mz-reset" onClick={share}><Icon name="share" />{c.share}</button>
                      </div>
                    </div>
                    <button type="button" className="mz-reset mz-link is-main mz-try-back" onClick={() => openChat(g.id, true)}><Icon name="chat" size={18} />{c.aiBack}</button>
                    <p className="mz-note is-plain"><Icon name="info" size={18} />{c.disclaimer}</p>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Without photo try-on and before she has chosen, the start card holds the only actions: no bar with a disabled button. */}
      {(photoAI || source) && <div className="mz-try-bar">
        {step > 1 && <button type="button" className="mz-reset mz-icon-btn mz-try-bar__back" aria-label={c.stepBack} onClick={() => goStep((step - 1) as Step)}><Icon name="back" /></button>}
        <button type="button" className="mz-reset mz-btn is-main" disabled={primary.off} onClick={primary.go}>
          {primary.icon === 'next' ? <>{primary.label}<Icon name="next" size={20} className="mz-arrow" /></> : <><Icon name={primary.icon} size={20} />{primary.label}</>}
        </button>
      </div>}
      <InfoDialog open={guide} onClose={() => setGuide(false)} title={c.sizeGuide} body={c.sizeGuideBody} />
      <AnimatePresence>
        {live && <LiveMirror garments={garments.filter(x => x.kind === 'garment')} initial={g?.id} onClose={() => setLive(false)} onPhoto={photoAI ? () => { setLive(false); fileA.current?.click(); } : undefined}
          onModel={photoAI ? undefined : id => { setLive(false); const p = b.byId(id); seeOnModel(p?.kind === 'garment' ? p : g); }}
          onRealistic={(frame, id) => { fromLive.current = true; setLive(false); setGid(id); setResult(null); setSource({ kind: 'own', url: frame }); }} />}
      </AnimatePresence>
    </main>
  );
}

/** Lets the customer swap between their own photo and the house model on step one (her photo only when it can be dressed). */
function SourceSwitch({ source, photoAI, onPhoto, onModel }: { source: NonNullable<Source>; photoAI: boolean; onPhoto: () => void; onModel: () => void }) {
  const { c } = useShop();
  if (!photoAI) return source.kind === 'own' ? <button type="button" className="mz-reset mz-link" onClick={onModel}><Icon name="model" size={18} />{c.model}</button> : null;
  return source.kind === 'own'
    ? <>
        <button type="button" className="mz-reset mz-link is-main" onClick={onPhoto}><Icon name="upload" size={18} />{c.replace}</button>
        <button type="button" className="mz-reset mz-link" onClick={onModel}><Icon name="model" size={18} />{c.model}</button>
      </>
    : <button type="button" className="mz-reset mz-link is-main" onClick={onPhoto}><Icon name="yourPhoto" size={18} />{c.useMyPhoto}</button>;
}
