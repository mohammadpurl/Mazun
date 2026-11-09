'use client';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useBoutique } from '../boutique/Boutique';
import { FlipCard } from './FlipCard';
import { SplitReveal } from './fx';
import { Icon } from './Icon';
import { useShop } from './Shop';
import { SPRING, reveal } from './tokens';

/** The whole collection: every piece, front and back. */
export function CollectionPage() {
  const b = useBoutique();
  const { c } = useShop();
  const router = useRouter();
  // The rack used to live here; old links still point to it.
  useEffect(() => { if (location.hash === '#rack') router.replace('/#rack'); }, [router]);
  return (
    <main>
      <section id="collection" className="mz-collection">
        <div className="mz-wrap">
          <motion.div className="mz-head" {...reveal}>
            <div>
              <p className="mz-eyebrow">{c.colEyebrow}</p>
              <SplitReveal as="h1" className="mz-h2" text={c.colTitle} />
            </div>
            <p className="mz-hint"><Icon name="turn" size={18} /><span className="mz-hover-only">{c.hoverHint}</span><span className="mz-touch-only">{c.tapHint}</span></p>
          </motion.div>
          <div className="mz-grid">
            {b.garments.map((g, i) => (
              <motion.div key={g.id} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ ...SPRING.soft, delay: (i % 4) * 0.07 }}>
                <FlipCard g={g} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
