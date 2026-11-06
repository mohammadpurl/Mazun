'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ONE_SIZE } from '@/lib/defaults';
import { effectivePrice } from '@/lib/fit';
import { Icon } from '../shop/Icon';
import { Art } from './Art';
import { Sheet, useBoutique } from './Boutique';

/** Product drawer: gallery (front, back, detail), colour, size, add to bag, wishlist, try-on / stylist, details. */
export function ProductDrawer() {
  const b = useBoutique();
  const g = b.byId(b.productId);
  const close = useCallback(() => b.openProduct(null), [b]);
  return (
    <Sheet open={!!g} onClose={close} label={g ? b.tx(g.name) : ''} width={4000}>
      {g && <Body key={g.id} id={g.id} onClose={close} />}
    </Sheet>
  );
}

let stepFocus: 'prev' | 'next' | null = null; // the viewer remounts per piece; keeps keyboard focus on the arrow

function Body({ id, onClose }: { id: string; onClose: () => void }) {
  const b = useBoutique();
  const { t, tx, settings } = b;
  const router = useRouter();
  const g = b.byId(id)!;
  const [img, setImg] = useState(0);
  const [color, setColor] = useState(0);
  const [size, setSize] = useState<string | null>(b.initialSize);
  const [openD, setOpenD] = useState<number | null>(null);
  useEffect(() => { if (g.sizes.length === 1 && g.sizes[0].ok) setSize(g.sizes[0].n); }, [g]);

  const order = (b.viewList?.includes(id) ? b.viewList.map(x => b.byId(x)).filter(x => !!x) : b.garments);
  const pos = order.findIndex(x => x.id === id);
  const stepTo = useCallback((d: number) => {
    const n = order.length;
    if (pos < 0 || n < 2) return;
    stepFocus = d > 0 ? 'next' : 'prev';
    document.querySelector('.sheet:has(.pd)')?.scrollTo({ top: 0 });
    b.openProduct(order[(pos + d + n) % n].id, { list: b.viewList ?? undefined });
  }, [b, order, pos]);
  useEffect(() => {
    if (stepFocus) (document.querySelector(`.pd-nav.${stepFocus}`) as HTMLElement | null)?.focus({ preventScroll: true });
    stepFocus = null;
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (b.sizeReq || e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement).closest('input,textarea')) return;
      stepTo((e.key === 'ArrowRight') === (b.dir === 'ltr') ? 1 : -1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [stepTo, b.dir, b.sizeReq]);

  const views = ['front', 'back', 'detail'] as const;
  const labels = [t.front, t.back, t.detail];
  const shownViews = g.kind === 'garment' && (g.detail || !g.front) ? views : (['front', ...(g.back ? ['back'] : []), ...(g.detail ? ['detail'] : [])] as typeof views[number][]);
  const cat = b.categories.find(c => c.id === g.categoryId);
  const price = effectivePrice(g);
  const wished = b.wish.includes(g.id);
  const soldOut = !g.sizes.some(s => s.ok);
  const days = settings.prepDays + g.leadDays + settings.shipDays;

  function add() {
    if (!size) { b.toast(t.pickSizeFirst); return; }
    b.addToBag(g.id, color, size);
    b.toast(`${t.added} — ${tx(g.name)}${size === ONE_SIZE ? '' : `${b.lang === 'en' ? ', ' : '، '}${size}`}`);
  }
  const go = (href: string) => { b.openProduct(null, { leaving: true }); router.push(href); };

  return (
    <div className="pd">
      <button type="button" className="ibtn x" aria-label={t.close} onClick={onClose}><Icon name="close" size={20} /></button>
      <div className="gal">
        {shownViews.length > 1 && (
          <div className="thumbs">
            {shownViews.map((v, i) => (
              <button key={v} type="button" className="thumb" aria-pressed={img === i} aria-label={labels[views.indexOf(v)]} onClick={() => setImg(i)}>
                <span style={{ position: 'absolute', inset: 5 }}><Art g={g} color={color} view={v} /></span>
              </button>
            ))}
          </div>
        )}
        <div className="main">
          {shownViews.map((v, i) => (
            <div key={v} className="view" style={{ opacity: img === i ? 1 : 0, pointerEvents: img === i ? 'auto' : 'none' }} aria-hidden={img !== i}>
              <div className={v === 'detail' ? '' : 'inset'} style={v === 'detail' ? { position: 'absolute', inset: 0 } : undefined}><Art g={g} color={color} view={v} /></div>
            </div>
          ))}
          {shownViews.length > 1 && <span className="tag">{labels[views.indexOf(shownViews[img])]}</span>}
          {pos >= 0 && order.length > 1 && (
            <>
              <button type="button" className="ibtn pd-nav prev" aria-label={t.prev} onClick={() => stepTo(-1)}><Icon name="back" /></button>
              <button type="button" className="ibtn pd-nav next" aria-label={t.next} onClick={() => stepTo(1)}><Icon name="next" /></button>
              <span className="pd-count">{t.pieceOf(pos + 1, order.length)}</span>
            </>
          )}
        </div>
      </div>

      <div className="info">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(cat || g.isNew) && <span className="label">{cat ? tx(cat.name) : ''}{cat && g.isNew ? ' · ' : ''}{g.isNew ? t.newTag : ''}</span>}
          <h2>{tx(g.name)}</h2>
          {tx(g.type) && <span className="type">{tx(g.type)}</span>}
          <span className="price">{b.price(price)}{price < g.price && <s>{b.price(g.price)}</s>}</span>
        </div>

        {g.colors.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="label">{t.color} · <b>{tx(g.colors[color].name)}</b></span>
            {g.colors.length > 1 && (
              <div className="swatches">
                {g.colors.map((c, i) => <button key={i} type="button" className="swatch" style={{ background: c.hex }} aria-label={tx(c.name)} aria-pressed={color === i} onClick={() => setColor(i)} />)}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="label-row">
            <span className="label">{t.size}</span>
            {g.kind === 'garment' && (
              <button type="button" className="tlink" style={{ padding: '4px 0' }} onClick={() => b.openSize({ garmentId: g.id, onUse: setSize })}>
                <Icon name="ruler" size={18} />{t.findSize}
              </button>
            )}
          </div>
          <div className="sizes">
            {g.sizes.map(s => <button key={s.n} type="button" className="size" disabled={!s.ok} aria-pressed={size === s.n} onClick={() => setSize(s.n)}>{s.n === ONE_SIZE ? t.oneSize : s.n}</button>)}
          </div>
          <span className={`stock${soldOut ? ' low' : ''}`}><Icon name="dot" weight="duotone" size={10} />{soldOut ? t.allSoldOut : t.inStock(days, tx(settings.originCity))}</span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn block" style={{ flex: 1 }} disabled={soldOut} onClick={add}>{size && size !== ONE_SIZE ? `${t.addBag} · ${size}` : t.addBag}</button>
          <button type="button" className="wishbtn" aria-label={t.wishAdd} aria-pressed={wished}
            onClick={() => { b.toggleWish(g.id); b.toast(wished ? t.unwished : t.wished); }}>
            <Icon name="heart" weight={wished ? 'duotone' : 'light'} size={22} />
          </button>
        </div>

        {g.kind === 'garment' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="label">{t.tryStyle}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button type="button" className="btn ghost sm" onClick={() => go(`/fitting-room?g=${encodeURIComponent(g.id)}&c=${color}${size ? `&s=${encodeURIComponent(size)}` : ''}`)}>
                <Icon name="hanger" size={18} style={{ color: 'var(--main)' }} />{t.tryOn}
              </button>
              <button type="button" className="btn ghost sm" onClick={() => go(`/stylist?g=${encodeURIComponent(g.id)}`)}>
                <Icon name="chat" size={18} style={{ color: 'var(--main)' }} />{t.styleIt}
              </button>
            </div>
          </div>
        )}

        {tx(g.description) && <p style={{ margin: 0, fontSize: 16, color: 'var(--ink)', maxWidth: '52ch' }}>{tx(g.description)}</p>}

        <div className="acc">
          {([[t.fabric, tx(g.fabric)], [t.fit, g.kind === 'garment' ? t.fitNote : ''], [t.delivery, t.delNote(tx(settings.originCity))]] as [string, string][])
            .filter(([, body]) => body)
            .map(([label, body], i) => (
              <div key={label}>
                <button type="button" aria-expanded={openD === i} onClick={() => setOpenD(openD === i ? null : i)}>
                  {label}<Icon name={openD === i ? 'minus' : 'plus'} size={18} />
                </button>
                {openD === i && <p>{body}</p>}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
