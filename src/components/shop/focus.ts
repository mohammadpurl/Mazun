/** Keeps Tab and Shift+Tab inside a modal layer, wrapping from its last focusable element to its first and back. It acts
 *  only while focus is inside the layer, so a layer stacked on top keeps its own trap. Returns nothing; call it from the
 *  layer's keydown listener. */
const REACHABLE = 'a[href], button, input:not([type=hidden]), select, textarea, [tabindex], [contenteditable="true"]';
/** Rendered and not hidden; Safari before 17.4 lacks checkVisibility, so it falls back to having any box at all. */
const shown = (el: HTMLElement) =>
  (el as { checkVisibility?: HTMLElement['checkVisibility'] }).checkVisibility?.({ checkVisibilityCSS: true }) ?? el.getClientRects().length > 0;

export function trapTab(e: KeyboardEvent, box: HTMLElement | null) {
  if (e.key !== 'Tab' || !box) return;
  const at = document.activeElement;
  if (!at || !box.contains(at)) return;
  const all = [...box.querySelectorAll<HTMLElement>(REACHABLE)].filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[inert]') && shown(el));
  if (!all.length) return;
  const [first, last] = [all[0], all[all.length - 1]];
  if (e.shiftKey && (at === first || at === box)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
}
