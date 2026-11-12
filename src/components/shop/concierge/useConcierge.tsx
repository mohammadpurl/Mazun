'use client';
/* The stylist's conversation: one shared state for the floating chat and the home page's sections, alive across the whole
   shop. A message goes to Claude when it is connected; if it is not, or the call fails, the built-in reading in
   lib/concierge.ts answers, so the chat never dead-ends. The server only ever names products from the catalogue.
   A real conversation is kept for the browser session, so a full reload does not lose it. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { familyOf, fill, pickGarment, readMessage, sizeInputs, type Intent, type SizeFacts } from '@/lib/concierge';
import { effectivePrice, recommendSize, type SizeInputs, type SizeRecommendation } from '@/lib/fit';
import { accessoriesByRole, presetPicks, setFor, type Picks } from '@/lib/stylist';
import { ACCESSORY_KINDS, type Garment } from '@/lib/types';
import { useBoutique } from '../../boutique/Boutique';
import { useShop } from '../Shop';
import { num } from '../tokens';
import { SAVE_KEY, readSaved, type Saved } from './saved';

export type Card = 'piece' | 'intro' | 'tryon' | 'sizeAsk' | 'size' | 'set' | 'human' | 'added';
export interface Turn { id: number; me: boolean; text: string; card?: Card }
export interface SizeResult { garmentId: string; rec: SizeRecommendation; inputs: SizeInputs; scanned: boolean }
interface Answer { reply?: string; note?: string; intent: Intent; garmentId: string | null; occasion: number | null; picks?: Picks; size?: SizeFacts }

/** The text in the field lives outside React state, so typing re-renders the field and not everything that reads the conversation. */
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
  garment: Garment | undefined;
  occasion: number;
  picks: Picks;
  sized: SizeResult | null;
  /** Height she has already given, to fill in the form. */
  knownHeight: number;
  /** How far the journey has come: 0 nothing yet, 1 talked, 2 a piece chosen, 3 sized, 4 set. */
  reached: number;
  /** The floating chat is open. */
  open: boolean;
  /** Opens the chat. With a piece, the stylist picks up talking about it; `afterTry` when she has just tried it on. */
  openChat: (pieceId?: string, afterTry?: boolean) => void;
  closeChat: () => void;
  ask: (text: string) => void;
  /** "Find me an abaya": asks the occasion first, when she has not given one. */
  findPiece: (text: string) => void;
  findSize: () => void;
  editSize: () => void;
  completeSet: () => void;
  /** Builds the set again for another occasion. */
  changeOccasion: (occasion: number) => void;
  /** Puts the set for this occasion in the chat, for her to change. */
  offerSet: (occasion: number) => void;
  another: () => void;
  /** Starts the conversation over. */
  restart: () => void;
  /** `said` is what she told us, in her own words, when it came from the form. */
  submitSize: (inputs: SizeInputs, scanned?: boolean, said?: string) => SizeResult | null;
  addSized: () => void;
  /** Adds the look to the bag, asking her size first when it is not known. `look` replaces the picks. */
  addLook: (look?: Picks) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  scanning: boolean;
  setScanning: (on: boolean) => void;
}

const C = createContext<Ctx | null>(null);
/** Only the way to open the chat, for buttons on other pages, which need not re-render with every message. */
const O = createContext<Ctx['openChat'] | null>(null);
export function useOpenChat() {
  const v = useContext(O);
  if (!v) throw new Error('useOpenChat outside ConciergeProvider');
  return v;
}

export function useConcierge() {
  const v = useContext(C);
  if (!v) throw new Error('useConcierge outside ConciergeProvider');
  return v;
}

/** Mid-sentence in English, without touching a name inside it ("for Eid"). */
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const DEFAULT_OCCASION = 3;
const firstSentence = (s: string) => /^.*?[.!؟?](\s|$)/.exec(s)?.[0].trim() ?? s;

const sessionSet = (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* storage blocked */ } };
const sessionDrop = (k: string) => { try { sessionStorage.removeItem(k); } catch { /* storage blocked */ } };

export function ConciergeProvider({ children }: { children: ReactNode }) {
  const b = useBoutique();
  const { c } = useShop();
  const byRole = useMemo(() => accessoriesByRole(b.products), [b.products]);
  // The piece chosen in admin (Settings → featured) is the one she talks about first, while it is in stock.
  const featured = b.byId(b.settings.home.featuredId);
  const featuredId = featured?.kind === 'garment' && featured.sizes.some(s => s.ok) ? featured.id : null;
  const opening = featuredId ?? b.garments.find(g => g.wornFront && g.sizes.some(s => s.ok))?.id ?? b.garments[0]?.id ?? '';
  const greeting = useMemo<Turn>(() => ({ id: 0, me: false, text: c.aiGreet }), [c.aiGreet]);

  const [turns, setTurns] = useState<Turn[]>([greeting]);
  const [draft] = useState(makeDraft);
  const [busy, setBusy] = useState(false);
  const [gid, setGid] = useState(opening);
  const [occasion, setOccasion] = useState(DEFAULT_OCCASION);
  const [picks, setPicks] = useState<Picks>(() => presetPicks(byRole, DEFAULT_OCCASION));
  const [sized, setSized] = useState<SizeResult | null>(null);
  const [reached, setReached] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);
  const seen = useRef<string[]>([]);
  const knownSize = useRef<Partial<SizeInputs> | null>(null);
  const knownScanned = useRef(false);
  const named = useRef(false);
  const addAfterSize = useRef(false);
  const confused = useRef(0);
  // What she last asked of a piece, so it follows her to the next one.
  const wanted = useRef<'size' | 'set' | 'tryon' | null>(null);
  const run = useRef(0);
  // The handlers below read current values through this, so a reply that lands late still acts on the latest state.
  const live = useRef({ gid, occasion, turns, sized, picks, reached, open, busy });
  live.current = { gid, occasion, turns, sized, picks, reached, open, busy };

  const garment = b.byId(gid);
  const say = useCallback((me: boolean, text: string, card?: Card) => {
    const t: Turn = { id: nextId.current++, me, text, card };
    live.current.turns = [...live.current.turns, t];
    setTurns(live.current.turns);
  }, []);
  const reach = useCallback((n: number) => { live.current.reached = Math.max(live.current.reached, n); setReached(r => Math.max(r, n)); }, []);
  /** Something went in the bag: the stylist says so where she is being read, and the page's toast says so where she is not. */
  const confirmAdded = useCallback((text: string) => {
    say(false, text, 'added');
    if (!live.current.open) b.toast(text);
  }, [b, say]);
  /** She asked for a size, a set or a try-on before choosing anything: name the piece it is for, with a way to change it. */
  const introduce = useCallback((g: Garment) => {
    if (live.current.reached >= 2) return;
    say(false, fill(c.aiStartWith, { name: b.tx(g.name) }), 'intro');
    reach(2);
  }, [b, c, say, reach]);

  const forget = useCallback(() => {
    seen.current = []; knownSize.current = null; knownScanned.current = false; named.current = false; addAfterSize.current = false; confused.current = 0; wanted.current = null;
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
    run.current++;
    dropSaved.current = true;
    forget();
    setBusy(false);
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
    confirmAdded(b.t.lookAdded);
  }, [b, confirmAdded]);

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
    wanted.current = a.intent === 'size' || a.intent === 'set' || a.intent === 'tryon' ? a.intent : null;
    if (!g && a.intent !== 'chat') { addAfterSize.current = false; say(false, reply || c.aiConfused); return; }
    if (g && (a.intent === 'size' || a.intent === 'set' || a.intent === 'tryon')) introduce(g);
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
        setSet(a.picks ?? setFor(byRole, g, a.occasion ?? live.current.occasion));
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
      case 'set': {
        const o = a.occasion ?? live.current.occasion;
        setSet(a.picks ?? setFor(byRole, g!, o));
        // The occasion is only named if she has named one.
        say(false, reply || (named.current ? fill(c.aiSetReply, { name, occasion: lowerFirst(c.aiOccasions[o]) }) : fill(c.aiSetReplyPlain, { name })), 'set');
        reach(4);
        return;
      }
      case 'tryon':
        say(false, reply || fill(c.aiTryReply, { name }), 'tryon');
        reach(2);
        return;
      default:
        // Twice off the shop's four tasks: offer a person, when the shop has a chat channel.
        confused.current += 1;
        say(false, reply || c.aiConfused, confused.current >= 2 ? 'human' : undefined);
    }
  }, [b, byRole, c, say, reach, setOcc, setSet, chooseGarment, applySize, introduce]);

  /** Once every piece in stock has been shown, the list starts again from the one in the conversation. */
  const seenSoFar = useCallback(() => {
    if (seen.current.length >= b.garments.filter(g => g.sizes.some(s => s.ok)).length) seen.current = [live.current.gid];
    // The piece in the conversation counts as seen, even when it is only the opening one.
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

  const ask = useCallback(async (raw: string) => {
    const text = raw.trim().slice(0, 400);
    if (!text) return;
    run.current++;
    const id = run.current;
    const history = live.current.turns.slice(-8).filter(t => t.id !== 0).map(t => ({ me: t.me, text: t.text }));
    say(true, text);
    reach(1);
    draft.set('');
    live.current.busy = true;
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
  }, [b.ai.text, b.lang, say, reach, apply, localAnswer, draft]);

  /** Measurements complete enough to size another piece without asking again. */
  const knownInputs = useCallback((): SizeInputs | null => {
    const k = knownSize.current;
    return k && (k.usual || k.bust) ? { height: k.height ?? 0, usual: k.usual ?? 'M', fit: k.fit ?? 'regular', bust: k.bust ?? 0, len: k.len ?? 'ankle' } : null;
  }, []);

  const findSize = useCallback(() => {
    run.current++;
    setBusy(false);
    // The question is already on screen, waiting for her.
    if (live.current.turns.at(-1)?.card === 'sizeAsk') return;
    wanted.current = 'size';
    say(true, c.aiActSize);
    reach(1);
    const g = b.byId(live.current.gid);
    if (g) introduce(g);
    // What she already told us, or what the camera read, still holds for the next piece.
    const k = knownInputs();
    if (k) { applySize(k, knownScanned.current); return; }
    say(false, c.aiSizeAsk, 'sizeAsk');
  }, [b, c, say, reach, applySize, knownInputs, introduce]);

  /** She wants to give different measurements. */
  const editSize = useCallback(() => {
    run.current++;
    setBusy(false);
    say(false, c.aiSizeAsk, 'sizeAsk');
  }, [c, say]);

  const completeSet = useCallback(() => { if (!live.current.busy) void ask(c.aiActSet); }, [ask, c]);

  const findPiece = useCallback((text: string) => {
    if (named.current) { void ask(text); return; }
    run.current++;
    setBusy(false);
    say(true, text);
    reach(1);
    say(false, c.aiAskOccasion);
  }, [ask, c, say, reach]);

  const changeOccasion = useCallback((o: number) => {
    if (live.current.busy) return;
    setOcc(o);
    // Claude rebuilds the set when it is connected, so one tap does not swap its choice for the shop's table.
    if (b.ai.text) { void ask(`${c.aiActSet} ${lowerFirst(c.aiOccasions[o])}`); return; }
    run.current++;
    setBusy(false);
    const g = b.byId(live.current.gid);
    if (!g) return;
    setSet(setFor(byRole, g, o));
    // It works like a filter on the card she is looking at, so the card's caption changes in place.
    const text = fill(c.aiSetReply, { name: b.tx(g.name), occasion: lowerFirst(c.aiOccasions[o]) });
    const at = live.current.turns.reduce((n, t) => (t.card === 'set' ? t.id : n), -1);
    if (at < 0) say(false, text, 'set');
    else { live.current.turns = live.current.turns.map(t => (t.id === at ? { ...t, text } : t)); setTurns(live.current.turns); }
    reach(4);
  }, [b, byRole, c, say, reach, setOcc, setSet, ask]);

  const offerSet = useCallback((o: number) => {
    const g = b.byId(live.current.gid);
    if (!g) return;
    run.current++;
    setBusy(false);
    setOcc(o);
    setSet(setFor(byRole, g, o));
    say(false, b.ai.text ? c.aiSetChangeAi : c.aiSetChange, 'set');
    reach(4);
  }, [b, byRole, c, say, reach, setOcc, setSet]);

  const another = useCallback(() => {
    const again = wanted.current;
    run.current++;
    setBusy(false);
    say(true, c.aiActOther);
    const g = pickGarment(b.garments, { occasion: live.current.occasion, family: null, budget: null, another: true }, seenSoFar());
    apply({ intent: 'pick', garmentId: g?.id ?? null, occasion: named.current ? live.current.occasion : null });
    if (!g || !again) return;
    // What she asked for the last piece, she wants for this one.
    if (again !== 'size') { apply({ intent: again, garmentId: null, occasion: null }); return; }
    wanted.current = 'size';
    const k = knownInputs();
    if (k) applySize(k, knownScanned.current);
    else say(false, c.aiSizeAsk, 'sizeAsk');
  }, [b.garments, c, say, apply, applySize, knownInputs, seenSoFar]);

  const submitSize = useCallback((inputs: SizeInputs, scanned = false, said?: string) => {
    if (said) say(true, said);
    return applySize(inputs, scanned);
  }, [say, applySize]);

  // A bag still waiting on a size does not outlive the conversation that asked for it.
  const closeChat = useCallback(() => { addAfterSize.current = false; setOpen(false); }, []);

  const restart = useCallback(() => {
    run.current++;
    live.current.busy = false;
    setBusy(false);
    forget();
    sessionDrop(SAVE_KEY);
    live.current.gid = opening;
    setGid(opening);
    live.current.occasion = DEFAULT_OCCASION;
    setOccasion(DEFAULT_OCCASION);
    setSet(presetPicks(byRole, DEFAULT_OCCASION));
  }, [forget, opening, byRole, setSet]);

  const openChat = useCallback((pieceId?: string, afterTry = false) => {
    const g = pieceId ? b.byId(pieceId) : undefined;
    // A reply on its way is left to land: dropping it would leave her question unanswered.
    if (g?.kind === 'garment' && !live.current.busy) {
      const changed = g.id !== live.current.gid;
      const text = fill(afterTry ? c.aiAfterTry : c.aiOnPiece, { name: b.tx(g.name) });
      // Reopening on the same piece carries on where she was, without the stylist repeating herself.
      if ((changed || afterTry || live.current.reached < 2) && live.current.turns.at(-1)?.text !== text) {
        run.current++;
        setBusy(false);
        // A bag waiting on a size was for the piece she has left.
        if (changed) { addAfterSize.current = false; live.current.sized = null; setSized(null); setSet(setFor(byRole, g, live.current.occasion)); }
        chooseGarment(g.id);
        say(false, text, 'piece');
        reach(2);
      }
    }
    setOpen(true);
  }, [b, byRole, c, say, reach, setSet, chooseGarment]);

  const addLook = (look?: Picks) => {
    if (look) setSet(look);
    const res = live.current.sized;
    if (res && res.garmentId === live.current.gid) { commitLook(res); return; }
    // The abaya needs a size before it goes in the bag; the bag waits for the answer.
    addAfterSize.current = true;
    if (look) { live.current.open = true; setOpen(true); }
    const k = knownInputs();
    if (k) applySize(k, knownScanned.current);
    else say(false, c.aiSizeAsk, 'sizeAsk');
  };

  const addSized = () => {
    const res = live.current.sized;
    if (!res) return;
    b.addToBag(res.garmentId, 0, res.rec.size);
    confirmAdded(c.aiAddedOne);
  };

  // Keeps a real conversation for the session.
  useEffect(() => {
    // Runs in the same commit as a language change, while this render still holds the old conversation.
    if (dropSaved.current) { dropSaved.current = false; sessionDrop(SAVE_KEY); return; }
    if (reached === 0) return;
    const saved: Saved = { lang: b.lang, turns, gid, occasion, named: named.current, picks, sized, reached, seen: seen.current, known: knownSize.current, scanned: knownScanned.current, nextId: nextId.current };
    sessionSet(SAVE_KEY, JSON.stringify(saved));
  }, [reached, turns, gid, occasion, picks, sized, b.lang]);

  /** On arrival: her own conversation if there is one, and the chat already open for a link to it (/#talk, /?g=<id>#talk). */
  useEffect(() => {
    const arrive = () => {
      if (location.hash === '#talk') openChat(new URLSearchParams(location.search).get('g') ?? undefined, true);
    };
    const saved = readSaved();
    if (!saved || saved.lang !== b.lang || !b.byId(saved.gid)) { arrive(); return; }
    nextId.current = saved.nextId; seen.current = saved.seen; knownSize.current = saved.known; knownScanned.current = saved.scanned; named.current = saved.named;
    live.current.turns = saved.turns; live.current.reached = saved.reached; live.current.occasion = saved.occasion; live.current.picks = saved.picks;
    live.current.gid = saved.gid;
    const keptSize = saved.sized && b.byId(saved.sized.garmentId) ? saved.sized : null;
    live.current.sized = keptSize;
    setTurns(saved.turns); setGid(saved.gid); setOccasion(saved.occasion); setPicks(saved.picks); setSized(keptSize); setReached(saved.reached);
    arrive();
    // Runs once, when the shop opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: Ctx = {
    turns, draft, busy, garment, occasion, picks, sized, knownHeight: knownSize.current?.height ?? 0, reached, open, openChat, closeChat,
    ask: t => { void ask(t); }, findPiece, findSize, editSize, completeSet, changeOccasion, offerSet, another, restart, submitSize, addSized, addLook, inputRef, scanning, setScanning,
  };
  return <O.Provider value={openChat}><C.Provider value={value}>{children}</C.Provider></O.Provider>;
}
