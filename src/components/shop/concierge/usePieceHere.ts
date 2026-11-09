import { usePathname } from 'next/navigation';
import { useBoutique } from '../../boutique/Boutique';
import { productHref } from '../Chrome';

/** The piece the current page is about, read when it is needed: on a product page, or the one named in the fitting room's address. */
export function usePieceHere() {
  const b = useBoutique();
  const path = usePathname();
  return () => b.garments.find(g => path === productHref(g.id))?.id ?? (path === '/fitting-room' ? new URLSearchParams(location.search).get('g') ?? undefined : undefined);
}
