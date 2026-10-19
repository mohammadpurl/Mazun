import { GarmentList } from '@/components/admin/GarmentList';
import { db } from '@/lib/db';

export default async function GarmentsPage() {
  const [garments, categories, settings] = await Promise.all([db().listGarments(), db().listCategories(), db().getSettings()]);
  return <GarmentList initial={garments} categories={categories} currency={settings.currency.fa} />;
}
