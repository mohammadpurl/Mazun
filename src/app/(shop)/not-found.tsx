import { NotFound } from '@/components/shop/NotFound';

/** A product link that leads nowhere (notFound() in /abaya/[id]). */
export default function ShopNotFound() {
  return <NotFound what="piece" />;
}
