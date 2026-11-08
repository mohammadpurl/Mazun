import { garmentsOnce, adminSettingsOnce } from '@/lib/admin-data';
import { SettingsPage } from '@/components/admin/settings/SettingsPage';

export const metadata = { title: 'تنظیمات سایت' };

export default async function Settings() {
  const [settings, garments] = await Promise.all([adminSettingsOnce(), garmentsOnce()]);
  return <SettingsPage initial={settings} garments={garments} />;
}
