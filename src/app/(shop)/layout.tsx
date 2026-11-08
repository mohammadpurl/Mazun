import './boutique.css';
import './shop.css';
import './sheets.css';
import './landing.css';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { BagSheet, WishSheet } from '@/components/boutique/Bag';
import { BoutiqueProvider, Toast } from '@/components/boutique/Boutique';
import { ProductDrawer } from '@/components/boutique/ProductDrawer';
import { Root } from '@/components/boutique/Root';
import { SizeAssistant } from '@/components/boutique/SizeAssistant';
import { isTheme } from '@/components/shop/tokens';
import { requestLang } from '@/lib/lang';
import { catalogueOnce, settingsOnce } from '@/lib/shop-data';

export const dynamic = 'force-dynamic';


export async function generateMetadata(): Promise<Metadata> {
  const [s, lang] = await Promise.all([settingsOnce(), requestLang()]);
  const brand = s.brand[lang] || s.brand.en;
  return { title: { default: brand, template: `%s · ${brand}` }, description: s.tagline[lang] || s.tagline.en };
}

export default async function ShopLayout({ children }: { children: ReactNode }) {
  const [settings, catalog, lang] = await Promise.all([settingsOnce(), catalogueOnce(), requestLang()]);
  const t = (await cookies()).get('theme')?.value;
  return (
    <BoutiqueProvider initialLang={lang} settings={settings} categories={catalog.categories} products={catalog.garments}
      ai={{ text: !!process.env.ANTHROPIC_API_KEY, image: !!process.env.GEMINI_API_KEY, live: !!(process.env.FAL_KEY || process.env.FAL_API_KEY || process.env.DECART_API_KEY), free: process.env.FREE_TRYON === 'on' }}>
      <Root theme={isTheme(t) ? t : 'wine'} overlays={<><ProductDrawer /><SizeAssistant /><BagSheet /><WishSheet /><Toast /></>}>
        {children}
      </Root>
    </BoutiqueProvider>
  );
}
