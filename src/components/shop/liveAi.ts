'use client';
import { useEffect, useRef, useState } from 'react';
import { FAL_APP, LIVE_MODEL, LIVE_SECONDS, livePrompt } from '@/lib/live-tryon';
import type { Garment } from '@/lib/types';

/* The live AI try-on: a copy of the camera stream goes to Decart's Lucy VTON over WebRTC — Decart directly when the
   server has its key, fal.ai otherwise — and the stream that comes back shows the customer wearing the chosen abaya as
   she moves. Our server only mints short-lived tokens (/api/tryon/live-token). A session stops itself after
   LIVE_SECONDS and does not restart until she asks.
   The mirror: both providers get the camera as it is, and the page flips what comes back (shop.css .mz-live__ai, and
   the saved picture in LiveMirror's capture). So she and the abaya are both mirrored, like a real looking glass and
   like the on-device mirror, whichever provider runs: a one-sided belt or embroidery sits where her own mirror would
   show it. Mirroring the camera before sending would leave the abaya unmirrored on a mirrored body. */

export type LiveAiState = 'idle' | 'connecting' | 'reconnecting' | 'live' | 'ended' | 'failed' | 'rate' | 'off';

/** The cut-out on white, at most 1024 px: the model reads a clean garment on a plain ground best. */
async function onWhite(src: string): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  await img.decode();
  const k = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}
const asBlob = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('blob'))), 'image/jpeg', 0.92));

type Provider = 'fal' | 'decart';
/** One token serves every redial of a session until just before it expires, so a single bumpy connect does not
 *  use up the visitor's hourly allowance. */
let cached: { provider: Provider; token: string; until: number } | null = null;
let refused: LiveAiState | null = null;
/** A token; `want` keeps a running session's redials on its own provider, so a reconnect never hands Decart's SDK a
 *  fal.ai token (or the other way round). */
async function token(want?: Provider): Promise<{ provider: Provider; token: string }> {
  if (cached && Date.now() < cached.until && (!want || cached.provider === want)) return cached;
  const r = await fetch(`/api/tryon/live-token${want ? `?provider=${want}` : ''}`, { method: 'POST' });
  refused = r.status === 429 ? 'rate' : r.status === 503 ? 'off' : null;
  if (!r.ok) throw new Error(`token ${r.status}`);
  const { provider, token: t, expiresAt } = await r.json();
  if ((provider !== 'decart' && provider !== 'fal') || typeof t !== 'string' || (want && provider !== want)) throw new Error('token shape');
  cached = { provider, token: t, until: Math.min(Date.parse(expiresAt) || 0, Date.now() + 120_000) - 5_000 };
  return cached;
}

/** What a provider's session tells the hook, and what the hook can ask of it. */
interface Events { remote(s: MediaStream): void; live(): void; reconnecting(): void; end(next: LiveAiState): void }
interface Session { dress(g: Garment): Promise<void>; close(): void }

/** Decart's own SDK: WebRTC handled for us. */
async function viaDecart(own: MediaStream, g: Garment, on: Events): Promise<Session> {
  const { createDecartClient, models } = await import('@decartai/sdk');
  const client = createDecartClient({ telemetry: false, apiKeyProvider: async () => (await token('decart')).token });
  const c = await client.realtime.connect(own, {
    model: models.realtime(LIVE_MODEL),
    // The camera as it is: the page mirrors what comes back (see the note at the top). false, not 'auto', which would
    // mirror a front camera on its own.
    mirror: false,
    retries: 2,
    capacityRetryBudgetMs: 20_000,
    initialState: { prompt: { text: livePrompt(g), enhance: false }, image: await asBlob(await onWhite(g.front)) },
    onRemoteStream: on.remote,
  });
  const END: Record<string, LiveAiState> = { insufficient_credits: 'off', session_limit: 'off', moderation_violation: 'failed', policy_violation: 'failed' };
  c.on('connectionChange', s => {
    if (s === 'generating') on.live();
    if (s === 'reconnecting') on.reconnecting();
    if (s === 'disconnected') on.end('failed');
  });
  c.on('sessionEnded', ({ reason }) => on.end(END[reason] ?? 'ended'));
  c.on('error', () => on.end('failed'));
  return {
    dress: async x => { await c.set({ prompt: livePrompt(x), image: await asBlob(await onWhite(x.front)), enhance: false }); },
    close: () => c.disconnect(),
  };
}

type FalMsg = { type?: string; sdp?: string; candidate?: RTCIceCandidateInit; error?: unknown; success?: boolean;
  iceservers?: RTCIceServer[]; iceServers?: RTCIceServer[]; ice_servers?: RTCIceServer[] };

/** fal.ai: their realtime socket carries the WebRTC offer, answer and candidates; we run the peer connection. */
async function viaFal(own: MediaStream, g: Garment, on: Events): Promise<Session> {
  const { fal } = await import('@fal-ai/client');
  let pc: RTCPeerConnection | null = null;
  const garment = async (x: Garment) => ({ prompt: livePrompt(x), reference_image_url: (await onWhite(x.front)).toDataURL('image/jpeg', 0.9), enhance_prompt: false });
  const conn = fal.realtime.connect<Record<string, unknown>, FalMsg>(FAL_APP, {
    connectionKey: `mirror-${Date.now()}`,
    throttleInterval: 0,
    tokenProvider: async () => (await token('fal')).token,
    tokenExpirationSeconds: 120,
    onError: () => on.end('failed'),
    onResult: async m => {
      try {
        switch (m.type) {
          case 'iceservers': case 'iceServers': {
            const servers = (m.iceservers || m.iceServers || m.ice_servers || []).map(s => ({ urls: s.urls, username: s.username, credential: s.credential }));
            pc = new RTCPeerConnection({ iceServers: servers });
            own.getTracks().forEach(t => pc!.addTrack(t, own));
            pc.ontrack = e => { if (e.streams[0]) on.remote(e.streams[0]); };
            pc.onicecandidate = e => {
              if (e.candidate) conn.send({ type: 'icecandidate', candidate: { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex } });
            };
            pc.onconnectionstatechange = () => {
              const s = pc?.connectionState;
              if (s === 'disconnected') on.reconnecting();
              if (s === 'failed' || s === 'closed') on.end('failed');
            };
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            conn.send({ type: 'offer', sdp: offer.sdp });
            break;
          }
          case 'answer': await pc?.setRemoteDescription({ type: 'answer', sdp: m.sdp }); break;
          case 'icecandidate': if (m.candidate) await pc?.addIceCandidate(new RTCIceCandidate(m.candidate)); break;
          case 'generation_started': on.live(); break;
          case 'error': on.end('failed'); break;
        }
      } catch { on.end('failed'); }
    },
  });
  // The first message opens the socket; fal answers with ICE servers and the WebRTC handshake follows.
  conn.send(await garment(g));
  return {
    dress: async x => conn.send(await garment(x)),
    close: () => { pc?.close(); pc = null; conn.close(); },
  };
}

export function useLiveAi({ on, stream, garment }: { on: boolean; stream: MediaStream | null; garment?: Garment }) {
  const video = useRef<HTMLVideoElement>(null);
  const session = useRef<Session | null>(null);
  const ended = useRef(false);
  const [state, setState] = useState<LiveAiState>('idle');
  const [left, setLeft] = useState(LIVE_SECONDS);
  const [round, setRound] = useState(0);
  const garmentRef = useRef(garment);
  garmentRef.current = garment;

  const stop = (next: LiveAiState) => { ended.current = next === 'ended'; setState(next); session.current?.close(); session.current = null; };

  // One session per round. It needs the camera stream and a garment with a photo.
  useEffect(() => {
    const g = garmentRef.current;
    if (!on || !stream || ended.current) return;
    if (!g?.front) { setState('failed'); return; }
    let gone = false, timer = 0, startedAt = 0, own: MediaStream | null = null, s: Session | null = null;
    setState('connecting'); setLeft(LIVE_SECONDS);
    const end = (next: LiveAiState) => { if (!gone) stop(next); };
    // A connect that never answers (queues, retries) gives up after 40 s instead of spinning forever, and for good: a
    // session that turns up later is closed rather than billed after she was told it failed.
    const giveUp = window.setTimeout(() => { if (!startedAt) { end('failed'); gone = true; s?.close(); } }, 40_000);
    const events: Events = {
      remote: r => { const v = video.current; if (v && !gone) { v.srcObject = r; v.play().catch(() => {}); } },
      reconnecting: () => { if (!gone) setState(st => (st === 'live' ? 'reconnecting' : st)); },
      end,
      live: () => {
        if (gone) return;
        setState('live');
        if (startedAt) return;
        // The minute starts with the first dressed frame, on our own clock.
        startedAt = performance.now();
        timer = window.setInterval(() => {
          const spent = (performance.now() - startedAt) / 1000;
          setLeft(Math.max(0, LIVE_SECONDS - Math.floor(spent)));
          if (spent >= LIVE_SECONDS) { window.clearInterval(timer); end('ended'); }
        }, 250);
      },
    };
    (async () => {
      try {
        const { provider } = await token();
        if (gone) return;
        // The provider owns (and stops) the tracks it is given, so it gets clones and our preview keeps running.
        own = new MediaStream(stream.getVideoTracks().map(t => t.clone()));
        s = await (provider === 'fal' ? viaFal : viaDecart)(own, g, events);
        if (gone) { s.close(); return; }
        session.current = s;
        // An abaya picked while connecting: send it now rather than keep the first one.
        const now = garmentRef.current;
        if (now?.front && now.id !== g.id) s.dress(now).catch(() => {});
      } catch {
        if (!gone) setState(refused ?? 'failed');
      }
    })();
    return () => {
      gone = true;
      window.clearTimeout(giveUp); window.clearInterval(timer);
      s?.close(); session.current = null;
      own?.getTracks().forEach(t => t.stop());
    };
  }, [on, stream, round]);

  // A new abaya mid-session: prompt and picture go together.
  useEffect(() => {
    const s = session.current, g = garment;
    if (s && g?.front) s.dress(g).catch(() => {});
  }, [garment?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    video, state, left,
    /** Another session, after the time ran out or a failure. */
    restart: () => { ended.current = false; setState('idle'); setRound(r => r + 1); },
    /** No new session until she asks (used when she takes a picture). */
    hold: () => { ended.current = true; },
  };
}
