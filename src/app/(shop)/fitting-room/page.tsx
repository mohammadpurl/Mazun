import type { Metadata } from 'next';
import { COPY } from '@/components/shop/copy';
import { TryOnPage } from '@/components/shop/TryOnPage';
import { requestLang } from '@/lib/lang';

export async function generateMetadata(): Promise<Metadata> {
  return { title: COPY[await requestLang()].eyebrow };
}

export default function FittingRoomPage() {
  return <TryOnPage />;
}
