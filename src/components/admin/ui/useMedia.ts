'use client';
import { useCallback, useSyncExternalStore } from 'react';

/** Whether a media query matches, kept in sync; false while rendering on the server. */
export function useMedia(query: string): boolean {
  const subscribe = useCallback((cb: () => void) => { const m = window.matchMedia(query); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); }, [query]);
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
