'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
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
  const { t, settings } = b;
  const [filter, setFilter] = useState<RackFilter>('all');

  // "?c=<collection>" from search suggestions and shared links preselects the rack filter.
  useEffect(() => {
    const c = new URLSearchParams(location.search).get('c');
    if (c && b.categories.some(x => x.id === c)) setFilter(c);
  }, [b.categories]);

  const showCollection = (c: Category) => { setFilter(c.id); scrollToId('rack'); };
  const featured = b.byId(settings.home.featuredId) ?? b.garments[0];
  const second = b.garments.find(g => g !== featured) ?? featured, third = b.garments.find(g => g !== featured && g !== second) ?? featured;
  const accessories = (['bag', 'shoes'] as const).flatMap(k => b.products.find(p => p.kind === k && p.front) ?? []);
  const appt = shopChatLink(settings, t.apptMsg);

  return (
    <main>
      <Rack filter={filter} setFilter={setFilter} />

      <section id="ai" className="ai">
        <div className="ai-head">
          <span className="kicker">{t.aiK}</span>
          <h2 className="h2">{t.aiT}</h2>
        </div>
        <div className="ai-grid">
          <article className="ai-card">
            <div className="pic">{featured && <span className="in"><Art g={featured} /></span>}</div>
            <h3 className="h3">{t.a1T}</h3>
            <p>{t.a1B}</p>
            <p className="note">{t.privacy}</p>
            <Link href={featured ? `/fitting-room?g=${encodeURIComponent(featured.id)}` : '/fitting-room'} className="btn">{t.a1C}</Link>
          </article>
          <article className="ai-card">
            <div className="pic">{second && <span className="in"><Art g={second} view="back" /></span>}</div>
            <h3 className="h3">{t.a2T}</h3>
            <p>{t.a2B}</p>
            {second && <button type="button" className="btn ghost" onClick={() => b.openSize({ garmentId: second.id, onUse: size => b.openProduct(second.id, { size }) })}>{t.a2C}</button>}
          </article>
          <article className="ai-card">
            <div className="pic set">
              {third && <span className="in"><Art g={third} /></span>}
              {accessories.map(a => <span key={a.id} className="acc-tile"><Art g={a} /></span>)}
            </div>
            <h3 className="h3">{t.a3T}</h3>
            <p>{t.a3B}</p>
            <Link href={third ? `/stylist?g=${encodeURIComponent(third.id)}` : '/stylist'} className="btn ghost">{t.a3C}</Link>
          </article>
        </div>
      </section>

      <Collections onShow={showCollection} />

      <section id="atelier" className="atelier">
        {settings.home.atelier && <div className="pic"><Pic src={settings.home.atelier} /></div>}
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
  const cover = (c: Category) => b.garments.find(g => g.categoryId === c.id);
  if (!cats.length) return <div id="collections" />;
  const arrow = <i className="ph-duotone ph-arrow-right flip-rtl" />;
  const tile = (c: Category, i: number, ratio: string, flex: string, extra?: React.CSSProperties, compact = false) => (
    <div className="tile" style={{ flex, ...extra }}>
      <div className="pic" style={{ aspectRatio: ratio }}>
        {c.image ? <Pic src={c.image} alt={tx(c.name)} /> : cover(c) && <span className="tile-art"><Art g={cover(c)!} /></span>}
      </div>
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
            {settings.home.fabric && (
              <figure className="fabric">
                <div className="pic"><Pic src={settings.home.fabric} alt={t.fabricCap} /></div>
                <figcaption>{t.fabricCap}</figcaption>
              </figure>
            )}
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
