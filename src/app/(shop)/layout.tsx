import './boutique.css';
import './shop.css';
import './sheets.css';
import './landing.css';
import './stage.css';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { BagSheet, WishSheet } from '@/components/boutique/Bag';
import { BoutiqueProvider, Toast, type AiFlags } from '@/components/boutique/Boutique';
import { ProductDrawer } from '@/components/boutique/ProductDrawer';
import { Root } from '@/components/boutique/Root';
import { SizeAssistant } from '@/components/boutique/SizeAssistant';
import { COPY } from '@/components/shop/copy';
import { isTheme } from '@/components/shop/tokens';
import { requestLang } from '@/lib/lang';
import { liveVia } from '@/lib/live-token';
import { shareImage, sharePreview, siteOrigin } from '@/lib/share';
import { catalogueOnce, settingsOnce } from '@/lib/shop-data';

export const dynamic = 'force-dynamic';

/** Which AI the shop has switched on, read from the server's environment. `photo` is the one switch for "her own
 *  photo can be dressed": the shop's image AI or the free public model. */
function aiFlags(): AiFlags {
  const image = !!process.env.GEMINI_API_KEY, free = process.env.FREE_TRYON === 'on';
  return { text: !!process.env.ANTHROPIC_API_KEY, image, live: liveVia(), free, photo: image || free };
}

export async function generateMetadata(): Promise<Metadata> {
  const [s, lang, origin] = await Promise.all([settingsOnce(), requestLang(), siteOrigin()]);
  const brand = s.brand[lang] || s.brand.en;
  const description = s.tagline[lang] || s.tagline.en;
  return {
    metadataBase: new URL(origin),
    title: { default: brand, template: `%s · ${brand}` },
    description,
    ...sharePreview({ title: brand, description, brand, lang, image: shareImage(undefined, COPY[lang].shareAlt.replace('{brand}', brand)) }),
  };
}

export default async function ShopLayout({ children }: { children: ReactNode }) {
  const [settings, catalog, lang] = await Promise.all([settingsOnce(), catalogueOnce(), requestLang()]);
  const t = (await cookies()).get('theme')?.value;
  return (
    <BoutiqueProvider initialLang={lang} settings={settings} categories={catalog.categories} products={catalog.garments}
      ai={aiFlags()}>
      <Root theme={isTheme(t) ? t : 'wine'} overlays={<><ProductDrawer /><SizeAssistant /><BagSheet /><WishSheet /><Toast /></>}>
        {children}
      </Root>
    </BoutiqueProvider>
  );
}
