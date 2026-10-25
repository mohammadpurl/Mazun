import { SettingsForm } from '@/components/admin/SettingsForm';
import { db } from '@/lib/db';

export default async function SettingsPage() {
  const [settings, garments] = await Promise.all([db().getSettings(), db().listGarments()]);
  return <SettingsForm initial={settings} garments={garments} />;
}
