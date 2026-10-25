import { GarmentList } from '@/components/admin/GarmentList';
import { db } from '@/lib/db';

export default async function GarmentsPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const [garments, categories, settings, { kind }] = await Promise.all([db().listGarments(), db().listCategories(), db().getSettings(), searchParams]);
  const accessories = kind === 'accessory';
  return (
    <GarmentList key={accessories ? 'a' : 'g'} accessories={accessories} categories={categories} currency={settings.currency.fa}
      initial={garments.filter(g => (g.kind === 'garment') !== accessories)} />
  );
}
