'use client';
/* eslint-disable @next/next/no-img-element -- transparent garment cut-outs from the catalogue */
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { effectivePrice } from '@/lib/fit';
import type { Garment } from '@/lib/types';
import { useBoutique } from '../boutique/Boutique';
import { InfoDialog } from './Chrome';
import { useOpenChat } from './concierge/useConcierge';
import { FlipCard } from './FlipCard';
import { Icon, type IconName } from './Icon';
import { useShop } from './Shop';
import { EASE, SPRING, cardBg, reveal } from './tokens';
import { ONE_SIZE } from '@/lib/defaults';

type View = 'front' | 'back' | 'form';
const VIEW_ICON: Record<View, IconName> = { front: 'front', back: 'turn', form: 'form' };
const rise = (i: number) => ({ initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { ...SPRING.soft, delay: 0.08 * i } });

export function ProductPage({ id }: { id: string }) {
  const b = useBoutique();
  const g = b.byId(id);
  if (!g) return null;
  return <Product key={g.id} g={g} />;
}

/** The dress form: head, neck, the garment, the pole and the brass base, drawn round the front photo. It leans a
 *  little toward the pointer, so it reads as an object in the room. */
function DressForm({ g, small }: { g: Garment; small?: boolean }) {
  const { c } = useShop();
  const b = useBoutique();
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const box = useRef<DOMRect | null>(null);
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), { stiffness: 80, damping: 18 });
  return (
    <motion.div className={`mz-form${small ? ' is-small' : ''}`}
      onPointerEnter={e => { box.current = e.currentTarget.getBoundingClientRect(); }}
      onPointerMove={e => { const r = box.current; if (reduce || e.pointerType !== 'mouse' || !r) return; mx.set((e.clientX - r.left) / r.width - 0.5); }}
      onPointerLeave={() => mx.set(0)} style={{ rotateY, transformPerspective: 1200 }}>
      <span className="mz-form__head" aria-hidden="true" />
      <span className="mz-form__neck" aria-hidden="true" />
      {g.front && <img src={g.front} alt={`${c.wearing} ${b.tx(g.name)}`} />}
      <span className="mz-form__pole" aria-hidden="true" />
      <span className="mz-form__base" aria-hidden="true" />
    </motion.div>
  );
}

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mz-acc">
      <button type="button" className="mz-reset mz-acc__head" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {title}<motion.span className="mz-acc__plus" aria-hidden="true" animate={{ rotate: open ? 45 : 0 }} transition={SPRING.soft}><Icon name="plus" size={20} /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SPRING.soft} style={{ overflow: 'hidden' }}>
            <p className="mz-acc__body">{children}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Product({ g }: { g: Garment }) {
  const b = useBoutique();
  const openChat = useOpenChat();
  const { c } = useShop();
  const category = b.categories.find(x => x.id === g.categoryId);
  const sizeLabel = (n: string) => (n === ONE_SIZE ? b.t.oneSize : n);
  const [view, setView] = useState<View>('front');
  const [size, setSize] = useState<string | null>(g.sizes.some(s => s.n === b.initialSize && s.ok) ? b.initialSize : null);
  const [need, setNeed] = useState(false);
  const [guide, setGuide] = useState(false);
  const reduce = useReducedMotion();
  const sizesRef = useRef<HTMLDivElement>(null);
  const name = b.tx(g.name);
  const colour = g.colors[0];
  const price = effectivePrice(g);
  // The model wearing the piece when there is one; DressForm keeps the flat cut-out.
  const front = g.wornFront || g.front;
  const back = g.wornBack || g.back || g.front;
  const bg = cardBg(colour?.hex);
  const more = b.garments.filter(x => x.id !== g.id).slice(0, 4);
  const soldOut = !g.sizes.some(s => s.ok);
  const extra = [g.detail, ...(g.images ?? [])].filter(Boolean);
  const openGuide = () => { if (g.chart) b.openSize({ garmentId: g.id, onUse: s => { setSize(s); setNeed(false); } }); else setGuide(true); };

  const add = () => {
    if (!size) {
      setNeed(true);
      sizesRef.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      sizesRef.current?.querySelector<HTMLButtonElement>('.mz-size:not(:disabled)')?.focus({ preventScroll: true });
      return;
    }
    b.addToBag(g.id, 0, size);
    setNeed(false);
    b.toast(`${b.t.added} — ${size === ONE_SIZE ? b.t.oneSize : `${b.t.size} ${size}`}`);
  };
  const priceEl = <>{price < g.price && <s>{b.price(g.price)}</s>} {b.price(price)}</>;

  return (
    <main className="mz-pd">
      <div className="mz-wrap">
        <nav aria-label={c.breadcrumb} className="mz-crumbs">
          <Link href="/" className="mz-link">{c.home}</Link><Icon name="caret" size={16} />
          <Link href="/collection" className="mz-link">{category ? b.tx(category.name) : c.navAbayas}</Link><Icon name="caret" size={16} />
          <span aria-current="page">{name}</span>
        </nav>

        <div className="mz-pd__top">
          <div className="mz-pd__gallery">
            <div className="mz-pd__figs">
              <motion.figure className="mz-pd__photo" style={{ background: bg }} {...rise(0)}>
                {front && <motion.img src={front} alt={`${name} — ${c.front}`} animate={{ opacity: view === 'back' ? 0 : 1 }} transition={{ duration: 0.9, ease: EASE }} />}
                {back && <motion.img src={back} alt={`${name} — ${c.back}`} initial={false} animate={{ opacity: view === 'back' ? 1 : 0 }} transition={{ duration: 0.9, ease: EASE }} />}
                <figcaption><Icon name={VIEW_ICON[view === 'back' ? 'back' : 'front']} size={16} />{view === 'back' ? c.back : c.front}</figcaption>
              </motion.figure>
              <motion.figure className="mz-pd__wall" {...rise(1)}>
                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.6, ease: EASE, delay: 0.2 }}><DressForm g={g} /></motion.div>
                <figcaption><Icon name="form" size={16} />{c.onForm}</figcaption>
              </motion.figure>
            </div>
            <div role="group" aria-label={c.views} className="mz-pd__thumbs">
              {(['front', 'back'] as const).map(v => (
                <button key={v} type="button" className="mz-reset mz-thumb" aria-pressed={view === v} onClick={() => setView(v)}>
                  <span style={{ background: bg }}>{(v === 'front' ? front : back) && <img src={v === 'front' ? front : back} alt="" />}</span>
                  {v === 'front' ? c.front : c.back}
                </button>
              ))}
            </div>

            {/* phone: one stage with three views */}
            <div className="mz-pd__stage" style={{ background: view === 'form' ? 'var(--wall)' : bg }}>
              {front && <motion.img className="mz-pd__layer" src={front} alt={`${name} — ${c.front}`} initial={false} animate={{ opacity: view === 'front' ? 1 : 0 }} transition={{ duration: 0.9, ease: EASE }} />}
              {back && <motion.img className="mz-pd__layer" src={back} alt={`${name} — ${c.back}`} initial={false} animate={{ opacity: view === 'back' ? 1 : 0 }} transition={{ duration: 0.9, ease: EASE }} />}
              <motion.div className="mz-pd__formlayer" initial={false} animate={{ opacity: view === 'form' ? 1 : 0, y: view === 'form' ? 0 : 16 }} transition={SPRING.soft}><DressForm g={g} small /></motion.div>
            </div>
            <div role="group" aria-label={c.views} className="mz-pd__tabs">
              {(['front', 'back', 'form'] as const).map(v => (
                <button key={v} type="button" className="mz-reset" aria-pressed={view === v} onClick={() => setView(v)}>
                  <Icon name={VIEW_ICON[v]} size={18} />{v === 'front' ? c.front : v === 'back' ? c.back : c.onForm}
                  {view === v && <motion.span className="mz-pd__tabline" layoutId="mz-tabline" transition={SPRING.soft} />}
                </button>
              ))}
            </div>
            {/* Fabric close-up and the gallery photos added in the admin panel. */}
            {extra.length > 0 && (
              <ul className="mz-pd__more" aria-label={c.morePhotos}>
                {extra.map((src, i) => (
                  <motion.li key={src} {...rise(i + 2)}><img src={src} alt={`${name} — ${c.morePhotos} ${i + 1}`} loading="lazy" /></motion.li>
                ))}
              </ul>
            )}
          </div>

          <div className="mz-pd__info">
            <motion.div className="mz-pd__title" {...rise(1)}>
              <p className="mz-eyebrow">Mazun Atelier</p>
              <h1>{name}</h1>
              <p className="mz-pd__price">{priceEl}</p>
            </motion.div>
            <div className="mz-pd__rule" />
            {colour && (
              <motion.div className="mz-pd__colour" {...rise(2)}>
                <p><span className="mz-dot is-phone" aria-hidden="true" style={{ background: colour.hex }} /><span>{c.colour} · <span className="is-value">{b.tx(colour.name)}</span></span></p>
                <span className="mz-pd__swatch" aria-hidden="true" style={{ background: colour.hex }} />
              </motion.div>
            )}
            <motion.div ref={sizesRef} className="mz-pd__sizes" role="group" aria-labelledby="mz-size-label" {...rise(2)}>
              <div className="mz-pd__sizehead">
                <p id="mz-size-label">{c.size}</p>
                <button type="button" className="mz-reset mz-link is-main" onClick={openGuide}><Icon name="ruler" size={18} />{c.sizeGuide}</button>
              </div>
              <div className="mz-pd__grid">
                {g.sizes.map(s => (
                  <motion.button key={s.n} type="button" className="mz-reset mz-size" aria-pressed={size === s.n} disabled={!s.ok} aria-label={s.ok ? sizeLabel(s.n) : `${sizeLabel(s.n)} — ${c.soldOut}`} title={s.ok ? undefined : c.soldOut}
                    onClick={() => { setSize(s.n); setNeed(false); }} whileTap={{ scale: 0.95 }} transition={SPRING.soft}>{sizeLabel(s.n)}</motion.button>
                ))}
              </div>
              <AnimatePresence>
                {need && <motion.p role="alert" className="mz-pd__need" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING.soft}><Icon name="alert" size={18} />{c.selectSize}</motion.p>}
              </AnimatePresence>
            </motion.div>
            <motion.div className="mz-pd__actions" {...rise(3)}>
              <button type="button" className="mz-reset mz-btn is-main is-block mz-pd__add" disabled={soldOut} onClick={add}><Icon name="bag" size={20} />{soldOut ? c.soldOut : c.addToBag}</button>
              <Link href={`/fitting-room?g=${encodeURIComponent(g.id)}`} className="mz-cardlink">
                <span className="mz-chip"><Icon name="hanger" weight="duotone" /></span>
                <span className="mz-cardlink__text"><span>{c.tryLink}</span><span>{c.trySub}</span></span>
                <Icon name="next" size={20} className="mz-arrow" />
              </Link>
              <button type="button" className="mz-reset mz-cardlink" onClick={() => openChat(g.id)}>
                <span className="mz-chip"><Icon name="chat" /></span>
                <span className="mz-cardlink__text"><span>{c.aiDockPiece}</span><span>{c.aiDockSub}</span></span>
                <Icon name="next" size={20} className="mz-arrow" />
              </button>
            </motion.div>
            <motion.div className="mz-pd__accs" {...rise(4)}>
              <Accordion title={c.description}>{b.tx(g.description) || c.descBody}</Accordion>
              <Accordion title={c.fabric}>{b.tx(g.fabric) || c.fabricBody}</Accordion>
              <Accordion title={c.delivery}>{c.deliveryBody}</Accordion>
            </motion.div>
          </div>
        </div>

        {more.length > 0 && (
          <section aria-label={c.alsoLike} className="mz-pd__more">
            <motion.h2 {...reveal}>{c.alsoLike}</motion.h2>
            <div className="mz-pd__moregrid">
              {more.map((x, i) => (
                <motion.div key={x.id} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ ...SPRING.soft, delay: i * 0.07 }}>
                  <FlipCard g={x} compact />
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="mz-pd__bar">
        <div><span>{name}</span><span>{priceEl}</span></div>
        <button type="button" className="mz-reset mz-btn is-main" disabled={soldOut} onClick={add}><Icon name="bag" size={20} />{soldOut ? c.soldOut : c.addToBag}</button>
      </div>
      <InfoDialog open={guide} onClose={() => setGuide(false)} title={c.sizeGuide} body={c.sizeGuideBody} />
    </main>
  );
}
