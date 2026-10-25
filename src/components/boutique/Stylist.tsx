'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { effectivePrice } from '@/lib/fit';
import { accessoriesByRole, chipPicks, lookTotal, presetPicks, replacePick, type Picks } from '@/lib/stylist';
import { ACCESSORY_KINDS, type AccessoryKind } from '@/lib/types';
import { Art } from './Art';
import { useBoutique } from './Boutique';

interface Msg { me: boolean; text: string }
const RATIO: Record<AccessoryKind, string> = { scarf: '4/5', bag: '1/1', jewel: '1/1', shoes: '4/3' };

/** The AI stylist: a garment as the foundation, one accessory per role, occasion presets and a chat.
 *  Occasions and "Replace" work instantly from the catalogue; chat goes to Claude when it is connected. */
export function Stylist() {
  const b = useBoutique();
  const { t, tx } = b;
  const byRole = useMemo(() => accessoriesByRole(b.products), [b.products]);
  const [gid, setGid] = useState(b.garments[0]?.id ?? '');
  const [occ, setOcc] = useState(0);
  const [picks, setPicks] = useState<Picks>(() => presetPicks(byRole, 0));
  const [summary, setSummary] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);
  const chat = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const g = b.byId(new URLSearchParams(location.search).get('g'));
    if (g && g.kind === 'garment') setGid(g.id);
  }, [b]);
  useEffect(() => { const el = chat.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs, typing]);

  const base = b.byId(gid);
  if (!base) return <main className="sty"><p className="lead">{t.emptyRack}</p></main>;
  const roles = ACCESSORY_KINDS.filter(k => byRole[k].length);
  const total = lookTotal(base, picks, id => b.byId(id));
  const pieceCount = 1 + roles.filter(k => picks[k]).length;

  const setOccasion = (i: number) => { setOcc(i); setPicks(presetPicks(byRole, i)); setSummary(null); setSaved(false); };

  async function send(text: string, chip: number | null) {
    const history = msgs;
    setMsgs(m => [...m, { me: true, text }]);
    setTyping(true); setDraft(''); setSaved(false);
    if (!b.ai.text) {
      // Built-in stylist: chips map to fixed looks; free text changes the bag, as in the design.
      await new Promise(r => setTimeout(r, 700));
      if (chip != null) {
        const c = chipPicks(byRole, chip);
        setPicks(c.picks);
        if (c.occasion != null) setOcc(c.occasion);
        setMsgs(m => [...m, { me: false, text: t.occSummary[c.occasion ?? occ] }]);
      } else {
        setPicks(p => replacePick(byRole, p, 'bag'));
        setMsgs(m => [...m, { me: false, text: t.localReply }]);
      }
      setTyping(false);
      return;
    }
    try {
      const r = await fetch('/api/ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stylist', lang: b.lang, garmentId: base!.id, occasion: occ, picks, history, message: text }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      setPicks(d.picks ?? picks);
      if (d.summary) setSummary(d.summary);
      setMsgs(m => [...m, { me: false, text: d.reply || t.aiError }]);
    } catch {
      setMsgs(m => [...m, { me: false, text: t.aiError }]);
    } finally {
      setTyping(false);
    }
  }

  function addLook() {
    const size = base!.sizes.find(s => s.ok)?.n;
    if (size) b.addToBag(base!.id, 0, size);
    for (const k of roles) {
      const a = picks[k] ? b.byId(picks[k]) : undefined;
      const s = a?.sizes.find(x => x.ok)?.n;
      if (a && s) b.addToBag(a.id, 0, s);
    }
    b.toast(t.lookAdded);
  }

  function saveLook() {
    try {
      const looks = JSON.parse(localStorage.getItem('mazun_looks') ?? '[]');
      localStorage.setItem('mazun_looks', JSON.stringify([...(Array.isArray(looks) ? looks : []), { base: base!.id, picks, at: Date.now() }].slice(-20)));
    } catch { /* storage blocked */ }
    setSaved(true); b.toast(t.saved);
  }

  return (
    <main className="sty">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 760 }}>
          <span className="kicker">{t.syK} · {b.ai.text ? t.aiResp : t.sampleResp}</span>
          <h1>{t.syT} <em>{tx(base.name)}</em></h1>
          <p style={{ margin: 0, fontSize: 17, fontStyle: 'italic', color: 'rgba(41,35,31,.78)', maxWidth: '56ch' }}>{summary ?? t.occSummary[occ]}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="label">{t.occasion}</span>
          <div className="seg">{t.occ.map((l, i) => <button key={l} type="button" aria-pressed={occ === i} onClick={() => setOccasion(i)}>{l}</button>)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(28px,3vw,48px)', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 620px', minWidth: 0 }}>
          <div className="sty-grid">
            <div className="sty-item" style={{ gridArea: 'base', gap: 14 }}>
              <div className="pic" style={{ aspectRatio: '2/3', background: 'transparent' }}><Art g={base} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span className="role">01 · {t.foundation}</span>
                <span style={{ fontSize: 20, lineHeight: 1.2 }}>{tx(base.name)} — {tx(base.type)}</span>
                <span style={{ fontSize: 15 }}>{b.price(effectivePrice(base))}</span>
                <button type="button" className="tlink u" style={{ alignSelf: 'flex-start', padding: '4px 0' }} onClick={() => b.openProduct(base.id)}>{t.viewPiece}</button>
              </div>
            </div>
            {roles.length === 0 && <p className="note" style={{ gridArea: 'scarf' }}>{t.noAccessories}</p>}
            {roles.map((k, i) => {
              const a = picks[k] ? b.byId(picks[k]) : undefined;
              if (!a) return null;
              return (
                <div key={k} className="sty-item" style={{ gridArea: k }}>
                  <button type="button" className="pic" style={{ aspectRatio: RATIO[k], border: 'none', padding: 0, cursor: 'pointer' }} aria-label={tx(a.name)} onClick={() => b.openProduct(a.id)}>
                    <Art g={a} />
                  </button>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span className="role">{String(i + 2).padStart(2, '0')} · {t.roles[k]}</span>
                    <span style={{ fontSize: 17, lineHeight: 1.25 }}>{tx(a.name)}</span>
                    <span style={{ fontSize: 15 }}>{b.price(effectivePrice(a))}</span>
                    {tx(a.note) && <p>{tx(a.note)}</p>}
                    {byRole[k].length > 1 && (
                      <button type="button" className="tlink" style={{ alignSelf: 'flex-start', padding: '6px 0 0' }} onClick={() => { setPicks(p => replacePick(byRole, p, k)); setSaved(false); }}>
                        <i className="ph-duotone ph-arrows-clockwise" />{t.replace}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 18, paddingTop: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="label">{t.total} · {t.pieces(pieceCount)}</span>
              <span style={{ fontSize: 34, lineHeight: 1.1 }}>{b.price(total)}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <button type="button" className="btn ghost" onClick={saveLook}><i className={saved ? 'ph-fill ph-bookmark-simple' : 'ph-duotone ph-bookmark-simple'} style={{ fontSize: 18 }} />{saved ? t.saved : t.save}</button>
              <button type="button" className="btn" onClick={addLook}><i className="ph-duotone ph-handbag" style={{ fontSize: 18 }} />{t.addLook}</button>
            </div>
          </div>
        </div>

        <aside style={{ flex: '0 1 380px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="label-row">
            <h2 style={{ margin: 0, fontWeight: 400, fontSize: 28, lineHeight: 1.1 }}>{t.chatT}</h2>
            <span style={{ fontSize: 12, fontStyle: 'italic', color: 'rgba(41,35,31,.68)' }}>{b.ai.text ? t.aiResp : t.sampleResp}</span>
          </div>
          <div ref={chat} className="chat" aria-live="polite">
            <div className="msg"><small>{t.stylist}</small><p>{t.greet(tx(base.type) || tx(base.name))}</p></div>
            {msgs.map((m, i) => <div key={i} className={`msg${m.me ? ' me' : ''}`}><small>{m.me ? t.you : t.stylist}</small><p>{m.text}</p></div>)}
            {typing && <span style={{ fontSize: 14, fontStyle: 'italic', color: 'rgba(41,35,31,.66)' }}>{t.composing}</span>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {t.chips.map((c, i) => <button key={c} type="button" className="chip" disabled={typing} onClick={() => send(c, i)}>{c}</button>)}
          </div>
          <form className="ask" onSubmit={e => { e.preventDefault(); const v = draft.trim(); if (v && !typing) send(v, null); }}>
            <input value={draft} onChange={e => setDraft(e.target.value)} placeholder={t.ph} maxLength={400} aria-label={t.ph} />
            <button type="submit" className="ibtn" aria-label={t.send} disabled={typing}><i className="ph-duotone ph-paper-plane-tilt flip-rtl" style={{ fontSize: 20 }} /></button>
          </form>
        </aside>
      </div>
    </main>
  );
}
