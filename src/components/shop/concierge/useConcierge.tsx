'use client';
/* The concierge's conversation: one shared state for the hero's chat, the stage photo and the sections below it.
   A message goes to Claude when it is connected; if it is not, or the call fails, the built-in reading in
   lib/concierge.ts answers, so the chat never dead-ends. The server only ever names products from the catalogue.
   A real conversation is kept for the browser session, so a trip to the fitting room does not lose it. */
import gsap from 'gsap';
import { useReducedMotion } from 'motion/react';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { familyOf, fill, pickGarment, readMessage, sizeInputs, type Intent, type SizeFacts } from '@/lib/concierge';
import { effectivePrice, recommendSize, type SizeInputs, type SizeRecommendation } from '@/lib/fit';
import { accessoriesByRole, presetPicks, type Picks } from '@/lib/stylist';
import { ACCESSORY_KINDS, type Garment } from '@/lib/types';
import { useBoutique } from '../../boutique/Boutique';
import { useShop } from '../Shop';
import { num } from '../tokens';
import { SAVE_KEY, readSaved, type Saved } from './saved';

export type Card = 'piece' | 'tryon' | 'sizeAsk' | 'size' | 'set' | 'human';
export interface Turn { id: number; me: boolean; text: string; card?: Card }
export interface SizeResult { garmentId: string; rec: SizeRecommendation; inputs: SizeInputs; scanned: boolean }
interface Answer { reply?: string; note?: string; intent: Intent; garmentId: string | null; occasion: number | null; picks?: Picks; size?: SizeFacts }

/** The text in the field lives outside React state: the sample types it letter by letter, and only the field should re-render. */
function makeDraft() {
  let value = '';
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set: (v: string) => { if (v === value) return; value = v; subs.forEach(f => f()); },
    subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
  };
}
export type Draft = ReturnType<typeof makeDraft>;

interface Ctx {
  turns: Turn[];
  draft: Draft;
  busy: boolean;
  /** The sample conversation is on screen. */
  sample: boolean;
  /** The sample is playing by itself. */
  playing: boolean;
  garment: Garment | undefined;
  occasion: number;
  picks: Picks;
  sized: SizeResult | null;
  /** Height she has already given, to fill in the form. */
  knownHeight: number;
  /** How far the journey has come: 0 nothing yet, 1 talked, 2 a piece chosen, 3 sized, 4 set. */
  reached: number;
  /** The conversation was brought back from earlier in the session, rather than started just now. */
  resumed: boolean;
  ask: (text: string) => void;
  findSize: () => void;
  editSize: () => void;
  completeSet: () => void;
  another: () => void;
  submitSize: (inputs: SizeInputs, scanned?: boolean) => SizeResult | null;
  addSized: () => void;
  /** Adds the look to the bag, asking her size first when it is not known. `look` replaces the picks. */
  addLook: (look?: Picks) => void;
  halt: () => void;
  takeOver: () => void;
  focusInput: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  scanning: boolean;
  setScanning: (on: boolean) => void;
}

const C = createContext<Ctx | null>(null);
export function useConcierge() {
  const v = useContext(C);
  if (!v) throw new Error('useConcierge outside ConciergeProvider');
  return v;
}

const firstSentence = (s: string) => /^.*?[.!؟?](\s|$)/.exec(s)?.[0].trim() ?? s;

const SAMPLE_KEY = 'mazun_sample_seen';
let lastPop = 0;
if (typeof window !== 'undefined') window.addEventListener('popstate', () => { lastPop = Date.now(); });
const sessionSet = (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* storage blocked */ } };
const sessionDrop = (k: string) => { try { sessionStorage.removeItem(k); } catch { /* storage blocked */ } };
const sampleSeen = () => { try { return sessionStorage.getItem(SAMPLE_KEY) === '1'; } catch { return false; } };

export function ConciergeProvider({ children }: { children: ReactNode }) {
  const b = useBoutique();
  const { c } = useShop();
  const reduce = useReducedMotion();
  const byRole = useMemo(() => accessoriesByRole(b.products), [b.products]);
  // The piece chosen in admin (Settings → featured) opens the page and stars in the sample, while it is in stock.
  const featured = b.byId(b.settings.home.featuredId);
  const featuredId = featured?.kind === 'garment' && featured.sizes.some(s => s.ok) ? featured.id : null;
  const opening = featuredId ?? b.garments.find(g => g.wornFront && g.sizes.some(s => s.ok))?.id ?? b.garments[0]?.id ?? '';
  const greeting = useMemo<Turn>(() => ({ id: 0, me: false, text: c.aiGreet }), [c.aiGreet]);

  const [turns, setTurns] = useState<Turn[]>([greeting]);
  const [draft] = useState(makeDraft);
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [gid, setGid] = useState(opening);
  const [occasion, setOccasion] = useState(3);
  const [picks, setPicks] = useState<Picks>(() => presetPicks(byRole, 3));
  const [sized, setSized] = useState<SizeResult | null>(null);
  const [reached, setReached] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [resumed, setResumed] = useState(false);
  const resumedOnce = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);
  const seen = useRef<string[]>([]);
  const knownSize = useRef<Partial<SizeInputs> | null>(null);
  const knownScanned = useRef(false);
  const named = useRef(false);
  const addAfterSize = useRef(false);
  const confused = useRef(0);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const run = useRef(0);
  // The handlers below read current values through this, so a reply that lands late still acts on the latest state.
  const live = useRef({ gid, occasion, turns, sized, picks, sample, reached });
  live.current = { gid, occasion, turns, sized, picks, sample, reached };

  const garment = b.byId(gid);
  const say = useCallback((me: boolean, text: string, card?: Card) => {
    const t: Turn = { id: nextId.current++, me, text, card };
    live.current.turns = [...live.current.turns, t];
    setTurns(live.current.turns);
  }, []);
  const reach = useCallback((n: number) => { live.current.reached = Math.max(live.current.reached, n); setReached(r => Math.max(r, n)); }, []);

  const forget = useCallback(() => {
    seen.current = []; knownSize.current = null; knownScanned.current = false; named.current = false; addAfterSize.current = false; confused.current = 0;
    live.current.sized = null; setSized(null);
    live.current.reached = 0; setReached(0);
    live.current.turns = [greeting]; setTurns([greeting]);
    draft.set('');
  }, [greeting, draft]);

  // A new language restarts the conversation in that language, so no half-translated thread is left on screen.
  const firstLang = useRef(b.lang);
  const dropSaved = useRef(false);
  useEffect(() => {
    if (firstLang.current === b.lang) return;
    firstLang.current = b.lang;
    timeline.current?.kill(); timeline.current = null;
    run.current++;
    dropSaved.current = true;
    forget();
    live.current.sample = false; setSample(false); setPlaying(false); setBusy(false);
  }, [b.lang, forget]);

  const chooseGarment = useCallback((id: string) => {
    if (!seen.current.includes(id)) seen.current = [...seen.current, id];
    live.current.gid = id;
    setGid(id);
  }, []);
  const setOcc = useCallback((o: number) => { live.current.occasion = o; named.current = true; setOccasion(o); }, []);
  const setSet = useCallback((p: Picks) => { live.current.picks = p; setPicks(p); }, []);

  const commitLook = useCallback((res: SizeResult) => {
    const g = b.byId(live.current.gid);
    if (!g) return;
    b.addToBag(g.id, 0, res.rec.size);
    for (const k of ACCESSORY_KINDS) {
      const a = live.current.picks[k] ? b.byId(live.current.picks[k]) : undefined;
      const s = a?.sizes.find(x => x.ok)?.n;
      if (a && s) b.addToBag(a.id, 0, s);
    }
    b.toast(b.t.lookAdded);
  }, [b]);

  const applySize = useCallback((inputs: SizeInputs, scanned = false): SizeResult | null => {
    const g = b.byId(live.current.gid);
    if (!g) { say(false, c.aiConfused); return null; }
    const rec = recommendSize(inputs, g);
    knownSize.current = inputs;
    knownScanned.current = scanned;
    if (!rec) { addAfterSize.current = false; say(false, c.aiNoneAvailable); return null; }
    const res: SizeResult = { garmentId: g.id, rec, inputs, scanned };
    live.current.sized = res;
    setSized(res);
    const name = b.tx(g.name);
    say(false, rec.size === rec.wanted ? fill(c.aiSizeResult, { size: rec.size, name }) : fill(c.aiSizeNearest, { wanted: rec.wanted, size: rec.size, name }), 'size');
    reach(3);
    if (addAfterSize.current) {
      addAfterSize.current = false;
      // Only the size she needs goes in the bag unasked; a substitute is hers to accept.
      if (rec.size === rec.wanted) commitLook(res);
    }
    return res;
  }, [b, c, say, reach, commitLook]);

  /** Acts on an answer, whoever wrote it: Claude's own words when there are some, the shop's otherwise. */
  const apply = useCallback((a: Answer) => {
    if (a.occasion !== null) setOcc(a.occasion);
    if (a.garmentId) chooseGarment(a.garmentId);
    const g = b.byId(a.garmentId ?? live.current.gid);
    const name = g ? b.tx(g.name) : '';
    const reply = a.reply?.trim();
    if (a.intent !== 'chat') confused.current = 0;
    if (!g && a.intent !== 'chat') { addAfterSize.current = false; say(false, reply || c.aiConfused); return; }
    switch (a.intent) {
      case 'pick': {
        addAfterSize.current = false;
        if (!g) return;
        const why = firstSentence(b.tx(g.description));
        const occ = a.occasion ?? null;
        const text = reply || (occ !== null ? fill(c.aiPicked, { occasion: c.aiOccasions[occ], name, why }) : fill(c.aiPickedPlain, { name, why }));
        say(false, a.note ? `${a.note} ${text}` : text, 'piece');
        // A new piece starts its own size and set.
        live.current.sized = null; setSized(null);
        setSet(a.picks ?? presetPicks(byRole, a.occasion ?? live.current.occasion));
        reach(2);
        return;
      }
      case 'size': {
        const inputs = a.size ? sizeInputs(a.size, knownSize.current) : null;
        if (inputs) { applySize(inputs, inputs.bust > 0 && knownScanned.current); return; }
        if (a.size?.height) knownSize.current = { ...knownSize.current, height: a.size.height };
        say(false, reply || c.aiSizeAsk, 'sizeAsk');
        return;
      }
      case 'set':
        setSet(a.picks ?? presetPicks(byRole, a.occasion ?? live.current.occasion));
        say(false, reply || fill(c.aiSetReply, { name }), 'set');
        reach(4);
        return;
      case 'tryon':
        say(false, reply || fill(c.aiTryReply, { name }), 'tryon');
        reach(2);
        return;
      default:
        // Twice off the shop's four tasks: offer a person, when the shop has a chat channel.
        confused.current += 1;
        say(false, reply || c.aiConfused, confused.current >= 2 ? 'human' : undefined);
    }
  }, [b, byRole, c, say, reach, setOcc, setSet, chooseGarment, applySize]);

  /** Once every piece in stock has been shown, the list starts again from the one on screen. */
  const seenSoFar = useCallback(() => {
    if (seen.current.length >= b.garments.filter(g => g.sizes.some(s => s.ok)).length) seen.current = [live.current.gid];
    // The piece on the stage counts as seen, even when it is only the opening photo.
    return seen.current.includes(live.current.gid) ? seen.current : [...seen.current, live.current.gid];
  }, [b.garments]);

  const localAnswer = useCallback((text: string): Answer => {
    const r = readMessage(text);
    const g = r.intent === 'pick' ? pickGarment(b.garments, r, r.another ? seenSoFar() : []) : null;
    let note: string | undefined;
    if (g && r.budget && effectivePrice(g) > r.budget) note = fill(c.aiNoBudget, { budget: num(r.budget, b.lang) });
    else if (g && r.family && g.colors[0] && familyOf(g.colors[0].hex) !== r.family) note = c.aiNoColour;
    return { intent: r.intent, garmentId: g?.id ?? null, occasion: r.occasion, size: r.size, note };
  }, [b.garments, b.lang, c, seenSoFar]);

  /** Stops the sample where it is; what it has shown so far stays. */
  const halt = useCallback(() => {
    if (!timeline.current) return;
    timeline.current.kill(); timeline.current = null;
    setPlaying(false); setBusy(false); draft.set('');
    sessionSet(SAMPLE_KEY, '1');
  }, [draft]);

  const clearSample = useCallback(() => {
    const wasPlaying = !!timeline.current;
    timeline.current?.kill(); timeline.current = null;
    setPlaying(false);
    // The sample may have been waiting on its own typing dots; nothing else would ever turn them off.
    if (wasPlaying) setBusy(false);
    if (!live.current.sample) return;
    live.current.sample = false;
    setSample(false);
    sessionSet(SAMPLE_KEY, '1');
    forget();
  }, [forget]);

  const ask = useCallback(async (raw: string) => {
    const text = raw.trim().slice(0, 400);
    if (!text) return;
    clearSample();
    run.current++;
    const id = run.current;
    const history = live.current.turns.slice(-8).filter(t => t.id !== 0).map(t => ({ me: t.me, text: t.text }));
    say(true, text);
    reach(1);
    draft.set('');
    setBusy(true);
    let answer: Answer | null = null;
    if (b.ai.text) {
      try {
        const r = await fetch('/api/ai', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(25_000),
          body: JSON.stringify({ action: 'concierge', lang: b.lang, message: text, history, garmentId: live.current.reached >= 2 ? live.current.gid : null, occasion: named.current ? live.current.occasion : null }),
        });
        if (r.ok) answer = await r.json();
      } catch { /* the built-in reading answers below */ }
    } else await new Promise(r => setTimeout(r, 600));
    if (id !== run.current) return;
    setBusy(false);
    apply(answer ?? localAnswer(text));
  }, [b.ai.text, b.lang, clearSample, say, reach, apply, localAnswer, draft]);

  /** Measurements complete enough to size another piece without asking again. */
  const knownInputs = useCallback((): SizeInputs | null => {
    const k = knownSize.current;
    return k && (k.usual || k.bust) ? { height: k.height ?? 0, usual: k.usual ?? 'M', fit: k.fit ?? 'regular', bust: k.bust ?? 0, len: k.len ?? 'ankle' } : null;
  }, []);

  const findSize = useCallback(() => {
    clearSample();
    run.current++;
    setBusy(false);
    say(true, c.aiActSize);
    reach(1);
    // What she already told us, or what the camera read, still holds for the next piece.
    const k = knownInputs();
    if (k) { applySize(k, knownScanned.current); return; }
    say(false, c.aiSizeAsk, 'sizeAsk');
  }, [c, clearSample, say, reach, applySize, knownInputs]);

  /** She wants to give different measurements. */
  const editSize = useCallback(() => {
    clearSample();
    run.current++;
    setBusy(false);
    say(false, c.aiSizeAsk, 'sizeAsk');
  }, [c, clearSample, say]);

  const completeSet = useCallback(() => {
    clearSample();
    run.current++;
    setBusy(false);
    say(true, c.aiActSet);
    const g = b.byId(live.current.gid);
    setSet(presetPicks(byRole, live.current.occasion));
    say(false, fill(c.aiSetReply, { name: g ? b.tx(g.name) : '' }), 'set');
    reach(4);
  }, [b, byRole, c, clearSample, say, reach, setSet]);

  const another = useCallback(() => {
    clearSample();
    run.current++;
    setBusy(false);
    say(true, c.aiActOther);
    const g = pickGarment(b.garments, { occasion: live.current.occasion, family: null, budget: null, another: true }, seenSoFar());
    apply({ intent: 'pick', garmentId: g?.id ?? null, occasion: named.current ? live.current.occasion : null });
  }, [b.garments, c, clearSample, say, apply, seenSoFar]);

  const submitSize = useCallback((inputs: SizeInputs, scanned = false) => {
    clearSample();
    return applySize(inputs, scanned);
  }, [clearSample, applySize]);

  const focusInput = useCallback(() => {
    document.getElementById('talk')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), reduce ? 0 : 500);
  }, [reduce]);

  const addLook = (look?: Picks) => {
    if (look) setSet(look);
    // A size from the sample conversation was never hers.
    const res = live.current.sample ? null : live.current.sized;
    if (res && res.garmentId === live.current.gid) { commitLook(res); return; }
    // The abaya needs a size before it goes in the bag; the bag waits for the answer.
    clearSample();
    addAfterSize.current = true;
    const k = knownInputs();
    if (k) applySize(k, knownScanned.current);
    else say(false, c.aiSizeAsk, 'sizeAsk');
    if (look) focusInput();
  };

  const addSized = () => {
    // The sample's size is not hers: ask for the real one instead.
    if (live.current.sample) { findSize(); return; }
    const res = live.current.sized;
    if (!res) return;
    b.addToBag(res.garmentId, 0, res.rec.size);
    b.toast(c.aiAddedOne);
  };

  const takeOver = useCallback(() => {
    clearSample();
    inputRef.current?.focus({ preventScroll: true });
  }, [clearSample]);

  // Keeps a real conversation for the session.
  useEffect(() => {
    // Runs in the same commit as a language change, while this render still holds the old conversation.
    if (dropSaved.current) { dropSaved.current = false; sessionDrop(SAVE_KEY); return; }
    if (sample || reached === 0) return;
    const saved: Saved = { lang: b.lang, turns, gid, occasion, named: named.current, picks, sized, reached, seen: seen.current, known: knownSize.current, scanned: knownScanned.current, nextId: nextId.current };
    sessionSet(SAVE_KEY, JSON.stringify(saved));
  }, [sample, reached, turns, gid, occasion, picks, sized, b.lang]);

  // The restored thread changes the page's height after the browser has already scrolled to the address's section, so
  // the section is found again once the taller thread is in the DOM. Not on Back, where she returns to where she was reading.
  useLayoutEffect(() => {
    if (resumed && location.hash && Date.now() - lastPop > 1500) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [resumed]);

  /** On arrival: her own conversation if there is one; otherwise the sample, written from the live catalogue with the
   *  same logic a real message gets, and played once a session. */
  useEffect(() => {
    if (!b.garments.length || resumedOnce.current) return;
    const saved = readSaved();
    // Coming back from the fitting room (/?g=<id>#talk), the stylist picks up with the piece she just tried.
    const tried = b.byId(new URLSearchParams(location.search).get('g'));
    const fromRoom = tried?.kind === 'garment' ? tried : undefined;
    const usable = !!saved && saved.lang === b.lang && !!b.byId(saved.gid);
    if (usable || fromRoom) {
      resumedOnce.current = true;
      setResumed(true);
      if (usable) {
        nextId.current = saved.nextId; seen.current = saved.seen; knownSize.current = saved.known; knownScanned.current = saved.scanned; named.current = saved.named;
        live.current.turns = saved.turns; live.current.reached = saved.reached; live.current.occasion = saved.occasion; live.current.picks = saved.picks;
        live.current.gid = saved.gid;
        const keptSize = saved.sized && b.byId(saved.sized.garmentId) ? saved.sized : null;
        live.current.sized = keptSize;
        setTurns(saved.turns); setGid(saved.gid); setOccasion(saved.occasion); setPicks(saved.picks); setSized(keptSize); setReached(saved.reached);
      }
      if (fromRoom) {
        chooseGarment(fromRoom.id);
        say(false, fill(c.aiAfterTry, { name: b.tx(fromRoom.name) }), 'piece');
        reach(2);
        history.replaceState(history.state, '', `/${location.hash}`);
      }
      return;
    }
    if (sampleSeen()) return;
    const [q1, q2, q3] = c.aiDemo;
    const answerOne = () => { const a = localAnswer(q1); apply(featuredId ? { ...a, garmentId: featuredId, note: undefined } : a); };
    const answerTwo = () => apply({ intent: 'size', garmentId: null, occasion: null, size: readMessage(q2).size });
    const answerThree = () => apply({ intent: 'set', garmentId: null, occasion: null });
    live.current.sample = true;
    setSample(true);
    live.current.turns = [greeting];
    setTurns([greeting]);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      say(true, q1); answerOne(); say(true, q2); answerTwo(); say(true, q3); answerThree();
      setReached(4);
      sessionSet(SAMPLE_KEY, '1');
      return;
    }
    setPlaying(true);
    const tl = gsap.timeline({ delay: 1.1, onComplete: () => { setPlaying(false); timeline.current = null; sessionSet(SAMPLE_KEY, '1'); } });
    timeline.current = tl;
    const typed = (text: string) => {
      const proxy = { n: 0 };
      tl.to(proxy, { n: text.length, duration: Math.min(1.5, text.length * 0.035), ease: 'none', onUpdate: () => draft.set(text.slice(0, Math.round(proxy.n))) });
    };
    const exchange = (text: string, answer: () => void, stage: number) => {
      typed(text);
      tl.call(() => { draft.set(''); say(true, text); reach(1); setBusy(true); }, undefined, '+=0.3');
      tl.call(() => { setBusy(false); answer(); reach(stage); }, undefined, '+=0.9');
    };
    exchange(q1, answerOne, 2);
    tl.to({}, { duration: 2.2 });
    exchange(q2, answerTwo, 3);
    tl.to({}, { duration: 2 });
    exchange(q3, answerThree, 4);
    return () => { tl.kill(); };
    // Runs once, when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: Ctx = {
    turns, draft, busy, sample, playing, garment, occasion, picks, sized, knownHeight: knownSize.current?.height ?? 0, reached, resumed,
    ask: t => { void ask(t); }, findSize, editSize, completeSet, another, submitSize, addSized, addLook, halt, takeOver, focusInput, inputRef, scanning, setScanning,
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
