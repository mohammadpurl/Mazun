import type { Metadata } from 'next';
import { COPY } from '@/components/shop/copy';
import { CollectionPage } from '@/components/shop/CollectionPage';
import { requestLang } from '@/lib/lang';

export async function generateMetadata(): Promise<Metadata> {
  return { title: COPY[await requestLang()].navCollection };
}

export default function Page() {
  return <CollectionPage />;
}
