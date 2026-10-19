import { SettingsForm } from '@/components/admin/SettingsForm';
import { db } from '@/lib/db';

export default async function SettingsPage() {
  return <SettingsForm initial={await db().getSettings()} />;
}
