import type { Metadata } from 'next';
import { Stylist } from '@/components/boutique/Stylist';
import { STRINGS } from '@/components/boutique/i18n';
import { requestLang } from '@/lib/lang';

export async function generateMetadata(): Promise<Metadata> {
  return { title: STRINGS[await requestLang()].syK };
}

export default function StylistPage() {
  return <Stylist />;
}
