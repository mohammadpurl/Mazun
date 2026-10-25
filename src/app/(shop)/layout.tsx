import '@phosphor-icons/web/duotone';
import '@phosphor-icons/web/fill';
import './boutique.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { BagSheet, WishSheet } from '@/components/boutique/Bag';
import { BoutiqueProvider, Toast } from '@/components/boutique/Boutique';
import { Footer, Header } from '@/components/boutique/Header';
import { ProductDrawer } from '@/components/boutique/ProductDrawer';
import { Root } from '@/components/boutique/Root';
import { SizeAssistant } from '@/components/boutique/SizeAssistant';
import { publicCatalog } from '@/lib/catalog';
import { db } from '@/lib/db';
import { requestLang } from '@/lib/lang';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const [s, lang] = await Promise.all([db().getSettings(), requestLang()]);
  const brand = s.brand[lang] || s.brand.en;
  return { title: { default: brand, template: `%s · ${brand}` }, description: s.tagline[lang] || s.tagline.en };
}

export default async function ShopLayout({ children }: { children: ReactNode }) {
  const repo = db();
  const [settings, categories, garments, lang] = await Promise.all([repo.getSettings(), repo.listCategories(), repo.listGarments(), requestLang()]);
  const catalog = publicCatalog(categories, garments);
  return (
    <BoutiqueProvider initialLang={lang} settings={settings} categories={catalog.categories} products={catalog.garments}
      ai={{ text: !!process.env.ANTHROPIC_API_KEY, image: !!process.env.GEMINI_API_KEY }}>
      <Root>
        <Header />
        {children}
        <Footer />
        <ProductDrawer />
        <SizeAssistant />
        <BagSheet />
        <WishSheet />
        <Toast />
      </Root>
    </BoutiqueProvider>
  );
}
