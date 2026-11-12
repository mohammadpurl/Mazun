import { useEffect, useRef, type RefObject } from 'react';

let lastId = 0;
type Marks = Record<string, unknown> | null;

/** While `on`, a full-screen layer owns a history entry, so the phone's Back closes it rather than leaving the page.
 *  Layers opened above it copy the mark into their own entries, so going back from one of them lands on this entry and
 *  leaves this layer open. Each opening has its own id, because an old entry can come back with an old mark on it. Set
 *  `leaving` when the layer closes because of a navigation: going back then would cancel it. */
export function useBackCloses(on: boolean, close: () => void, mark: string, leaving?: RefObject<boolean>) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!on) return;
    // Unique across reloads too, since the entries outlive this page load.
    const id = `${performance.timeOrigin}-${++lastId}`;
    const url = location.href;
    const state = () => history.state as Marks;
    history.pushState({ ...history.state, [mark]: id, mzTop: id }, '');
    let popped = false;
    const onPop = () => {
      if (state()?.[mark] === id) return;
      popped = true;
      closeRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // Closed by its own button: take the entry back, only if nothing has been opened on top of it and the page has not
      // changed. A layer that opened as this one was fading out keeps its entry, at the cost of one extra press of Back.
      if (!popped && !leaving?.current && location.href === url && state()?.mzTop === id) history.back();
    };
  }, [on, mark, leaving]);
}
