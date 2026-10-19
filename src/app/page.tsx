import { Shop } from '@/components/shop/Shop';
import { publicCatalog } from '@/lib/catalog';
import { db } from '@/lib/db';
import './shop.css';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const repo = db();
  const [settings, categories, garments] = await Promise.all([repo.getSettings(), repo.listCategories(), repo.listGarments()]);
  const catalog = publicCatalog(categories, garments);
  return (
    <Shop
      settings={settings}
      categories={catalog.categories}
      garments={catalog.garments}
      ai={{ text: !!process.env.ANTHROPIC_API_KEY, image: !!process.env.GEMINI_API_KEY }}
    />
  );
}
