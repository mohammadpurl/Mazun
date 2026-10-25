'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { effectivePrice } from '@/lib/fit';
import { shopChatLink } from '@/lib/order-message';
import type { Category } from '@/lib/types';
import { Art, Pic } from './Art';
import { useBoutique } from './Boutique';
import { Rack, type RackFilter } from './Rack';

const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: 'smooth' });
};

export function Home() {
  const b = useBoutique();
  const { t, tx, settings } = b;
  const [filter, setFilter] = useState<RackFilter>('all');

  // "?c=<collection>" from search suggestions and shared links preselects the rack filter.
  useEffect(() => {
    const c = new URLSearchParams(location.search).get('c');
    if (c && b.categories.some(x => x.id === c)) setFilter(c);
  }, [b.categories]);

  const showCollection = (c: Category) => { setFilter(c.id); scrollToId('rack'); };
  const featured = b.byId(settings.home.featuredId) ?? b.garments[0];
  const accessories = b.products.filter(p => p.kind === 'bag' || p.kind === 'shoes').slice(0, 2);
  const appt = shopChatLink(settings, t.apptMsg);
  const arrow = <i className="ph-duotone ph-arrow-right flip-rtl" />;

  return (
    <main>
      <section className="hero">
        <div style={{ position: 'absolute', inset: 0 }}><Pic src={settings.home.hero} dark /></div>
        <div className="scrim" />
        <div className="copy">
          <div style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 22 }}>
            <h1><span>{t.h1a}</span><em>{t.h1b}</em></h1>
            <p>{t.heroSub}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 10 }}>
              <button type="button" className="btn light" onClick={() => scrollToId('collections')}>{t.heroCta1}</button>
              <Link href="/fitting-room" className="btn on-dark">{t.heroCta2}</Link>
            </div>
          </div>
          {featured && (
            <button type="button" className="cap" onClick={() => b.openProduct(featured.id)}>
              {tx(featured.name)}, {tx(featured.type)} · {b.price(effectivePrice(featured))}{arrow}
            </button>
          )}
        </div>
      </section>

      <Collections onShow={showCollection} />

      <Rack filter={filter} setFilter={setFilter} />

      <section className="teaser">
        <div className="pair" dir="ltr">
          <div>
            <div className="pic"><Pic src={settings.home.tryBefore} /></div>
            <span className="label" dir={b.dir}>{t.before}</span>
          </div>
          <div>
            <div className="pic"><Pic src={settings.home.tryAfter} /></div>
            <span className="label" dir={b.dir}>{t.after}</span>
          </div>
        </div>
        <div className="text">
          <span className="kicker">{t.trK}</span>
          <h2 className="h2s">{t.trT}</h2>
          <p className="lead">{t.trB}</p>
          <div style={{ marginTop: 8 }}><Link href="/fitting-room" className="btn">{t.trCta}</Link></div>
          <p className="note">{t.privacy}</p>
        </div>
      </section>

      <section className="teaser rev">
        <div className="text">
          <span className="kicker">{t.stK}</span>
          <h2 className="h2s">{t.stT}</h2>
          <p className="lead">{t.stB}</p>
          <div style={{ marginTop: 8 }}>
            <Link href={featured ? `/stylist?g=${encodeURIComponent(featured.id)}` : '/stylist'} className="btn ghost">{t.stCta}{arrow}</Link>
          </div>
        </div>
        {featured && (
          <div className="compo" aria-hidden="true">
            <div><Art g={featured} /></div>
            {accessories.map(a => <div key={a.id}><Art g={a} /></div>)}
          </div>
        )}
      </section>

      <section id="atelier" className="atelier">
        <div className="pic"><Pic src={settings.home.atelier} /></div>
        <div className="cols2">
          <div>
            <span className="kicker">{t.atK}</span>
            <h2 className="h2s" style={{ maxWidth: '16ch' }}>{t.atT}</h2>
          </div>
          <div>
            <p className="lead">{t.atB}</p>
            {appt && <div><a className="tlink u" style={{ fontSize: 15 }} href={appt} target="_blank" rel="noopener noreferrer">{t.atCta}</a></div>}
          </div>
        </div>
      </section>
    </main>
  );
}

/** The four editorial tiles of the design, filled from the first four collections in admin order. */
function Collections({ onShow }: { onShow: (c: Category) => void }) {
  const b = useBoutique();
  const { t, tx, settings } = b;
  const cats = b.categories.slice(0, 4);
  if (!cats.length) return <div id="collections" />;
  const arrow = <i className="ph-duotone ph-arrow-right flip-rtl" />;
  const tile = (c: Category, i: number, ratio: string, flex: string, extra?: React.CSSProperties, compact = false) => (
    <div className="tile" style={{ flex, ...extra }}>
      <div className="pic" style={{ aspectRatio: ratio }}><Pic src={c.image} alt={tx(c.name)} /></div>
      <div className="meta">
        <span className="num">{String(i + 1).padStart(2, '0')}</span>
        <div>
          <h3 className="h3" style={compact ? { fontSize: 'clamp(24px,2vw,30px)' } : undefined}>{tx(c.name)}</h3>
          <p>{tx(c.description)}</p>
        </div>
        <button type="button" className="tlink" onClick={() => onShow(c)} aria-label={compact ? tx(c.name) : undefined}>
          {compact ? null : t.discover}{arrow}
        </button>
      </div>
    </div>
  );
  return (
    <section id="collections" className="cols">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 'clamp(40px,5vw,72px)' }}>
        <span className="kicker">{t.colK}</span>
        <h2 className="h2" style={{ maxWidth: '14ch' }}>{t.colT}</h2>
      </div>
      <div className="cols-row">
        {tile(cats[0], 0, '4/5', '7 1 480px')}
        {cats[1] && (
          <div className="tile" style={{ flex: '5 1 340px', marginTop: 'clamp(0px, calc(12vw - 60px), 168px)' }}>
            {tile(cats[1], 1, '3/4', '1 1 auto')}
            <figure className="fabric">
              <div className="pic"><Pic src={settings.home.fabric} alt={t.fabricCap} /></div>
              <figcaption>{t.fabricCap}</figcaption>
            </figure>
          </div>
        )}
      </div>
      {cats.length > 2 && (
        <div className="cols-row">
          {tile(cats[2], 2, '2/3', '4 1 300px', undefined, true)}
          {cats[3] && tile(cats[3], 3, '16/10', '8 1 520px')}
        </div>
      )}
    </section>
  );
}
