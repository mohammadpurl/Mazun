import type { Metadata } from 'next';
import { Stylist } from '@/components/boutique/Stylist';

export const metadata: Metadata = { title: 'AI Stylist' };

export default function StylistPage() {
  return <Stylist />;
}
