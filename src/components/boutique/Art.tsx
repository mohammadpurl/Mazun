/* eslint-disable @next/next/no-img-element -- uploaded cut-outs need object-fit:contain and 3D flips */
import type { Garment, Shape } from '@/lib/types';

/** Outlines from the design, drawn while a garment has no photo yet. */
export const CLIP: Record<Shape, string> = {
  abaya: 'polygon(40% 0%,60% 0%,77% 5%,95% 36%,88% 39%,79% 23%,87% 100%,13% 100%,21% 23%,12% 39%,5% 36%,23% 5%)',
  gown: 'polygon(41% 0%,59% 0%,69% 6%,65% 30%,70% 42%,93% 100%,7% 100%,30% 42%,35% 30%,31% 6%)',
  dress: 'polygon(40% 0%,60% 0%,74% 6%,88% 30%,82% 33%,71% 19%,68% 40%,82% 96%,18% 96%,32% 40%,29% 19%,18% 33%,12% 30%,26% 6%)',
  kaftan: 'polygon(40% 0%,60% 0%,98% 17%,96% 42%,77% 31%,82% 98%,18% 98%,23% 31%,4% 42%,2% 17%)',
};

/** Fabric sheen over the garment colour. */
export const fabric = (tone: string, back = false) => (back
  ? 'linear-gradient(180deg,rgba(255,255,255,.08),rgba(0,0,0,.14)),linear-gradient(90deg,rgba(0,0,0,.12),rgba(255,255,255,.07) 35%,rgba(0,0,0,.02) 50%,rgba(255,255,255,.07) 65%,rgba(0,0,0,.12)),'
  : 'linear-gradient(180deg,rgba(255,255,255,.12),rgba(0,0,0,.12)),linear-gradient(100deg,rgba(0,0,0,.16),rgba(255,255,255,.18) 27%,rgba(0,0,0,0) 43%,rgba(0,0,0,.14) 61%,rgba(255,255,255,.12) 78%,rgba(0,0,0,.18)),') + tone;

const ACCESSORY_ICON: Record<string, string> = { scarf: 'ph-wave-sine', bag: 'ph-handbag', jewel: 'ph-diamond', shoes: 'ph-high-heel' };

/** A product picture: the uploaded photo when there is one, otherwise the design's coloured silhouette
 *  (garments) or a soft tile with an icon (accessories). Fills its positioned parent. */
export function Art({ g, color = 0, view = 'front', inset }: { g: Garment; color?: number; view?: 'front' | 'back' | 'detail'; inset?: string }) {
  const src = view === 'detail' ? g.detail : view === 'back' ? g.back || g.front : g.front;
  const tone = (g.colors[color] ?? g.colors[0])?.hex ?? '#8C7A68';
  const label = g.name.en || g.name.ar || g.name.fa;
  if (src) return <span className="sil" style={inset ? { inset } : undefined}><img className="contain" src={src} alt={label} loading="lazy" /></span>;
  if (view === 'detail') return <span className="ph" aria-hidden="true" style={{ background: fabric(tone) }} />;
  if (g.kind !== 'garment') {
    return (
      <span className="ph icon" aria-hidden="true" style={{ background: `radial-gradient(70% 70% at 50% 40%, ${tone}55, transparent 70%), var(--linen)` }}>
        <i className={`ph-duotone ${ACCESSORY_ICON[g.kind]}`} style={{ fontSize: 'clamp(36px,5vw,64px)', color: '#55573F', position: 'relative', zIndex: 1 }} />
      </span>
    );
  }
  return (
    <span className="sil" aria-hidden="true" style={inset ? { inset } : undefined}>
      <span className="shadow"><span className="shape" style={{ clipPath: CLIP[g.shape], background: fabric(tone, view === 'back') }} /></span>
      {view === 'back' && <span className="seams" style={{ clipPath: CLIP[g.shape] }} />}
    </span>
  );
}

/** A campaign/editorial picture from the admin panel, or the sand placeholder until one is uploaded. */
export function Pic({ src, alt = '', dark }: { src: string; alt?: string; dark?: boolean }) {
  return src ? <img className="cover" src={src} alt={alt} /> : <span className={`ph${dark ? ' dark' : ''}`} aria-hidden="true" />;
}
