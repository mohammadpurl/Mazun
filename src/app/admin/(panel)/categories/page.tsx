import { garmentsOnce } from '@/lib/admin-data';
import { Collections } from '@/components/admin/collections/Collections';
import { db } from '@/lib/db';

export const metadata = { title: 'مجموعه‌ها' };

export default async function Categories({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const [categories, garments, sp] = await Promise.all([db().listCategories(), garmentsOnce(), searchParams]);
  const counts: Record<string, number> = {};
  const covers: Record<string, string> = {};
  for (const g of garments) if (g.kind === 'garment' && g.categoryId) {
    counts[g.categoryId] = (counts[g.categoryId] ?? 0) + 1;
    covers[g.categoryId] ||= g.wornFront || g.front;
  }
  return <Collections initial={categories} counts={counts} covers={covers} openNew={sp.new === '1'} />;
}
