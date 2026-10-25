import { notFound } from 'next/navigation';
import { GarmentEditor } from '@/components/admin/GarmentEditor';
import { db } from '@/lib/db';

export default async function GarmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string }> }) {
  const [{ id }, { kind }] = await Promise.all([params, searchParams]);
  const [categories, garment] = await Promise.all([db().listCategories(), id === 'new' ? null : db().getGarment(id)]);
  if (id !== 'new' && !garment) notFound();
  return <GarmentEditor initial={garment} categories={categories} defaultKind={kind === 'accessory' ? 'scarf' : 'garment'} />;
}
