import { notFound } from 'next/navigation';
import { GarmentEditor } from '@/components/admin/GarmentEditor';
import { db } from '@/lib/db';

export default async function GarmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [categories, garment] = await Promise.all([db().listCategories(), id === 'new' ? null : db().getGarment(id)]);
  if (id !== 'new' && !garment) notFound();
  return <GarmentEditor initial={garment} categories={categories} />;
}
