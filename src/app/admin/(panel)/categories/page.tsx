import { CategoryManager } from '@/components/admin/CategoryManager';
import { db } from '@/lib/db';

export default async function CategoriesPage() {
  const [categories, garments] = await Promise.all([db().listCategories(), db().listGarments()]);
  const counts = Object.fromEntries(categories.map(c => [c.id, garments.filter(g => g.categoryId === c.id).length]));
  return <CategoryManager initial={categories} counts={counts} />;
}
