// Unifies mouse, touch and keyboard into: tap events, a "holding" flag and a first-gesture hook.
// Prevents page scroll / pinch zoom / context menus while keeping browser shortcuts working.

const SCROLL_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']);

export function createInput(target, { onTap, onHold, onGesture }) {
  const pointers = new Set();
  const keys = new Set();
  const refresh = () => onHold(pointers.size > 0 || keys.size > 0);

  const pointerDown = (e) => {
    pointers.add(e.pointerId);
    onGesture('down');
    onTap();
    refresh();
  };
  const pointerUp = (e) => {
    pointers.delete(e.pointerId);
    onGesture('up');                      // touch audio unlock happens on pointer-up
    refresh();
  };
  target.addEventListener('pointerdown', pointerDown);
  window.addEventListener('pointerup', pointerUp);
  window.addEventListener('pointercancel', pointerUp);

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;            // keep reload / devtools / shortcuts
    if (/^F\d+$/.test(e.key) || e.key === 'Escape' || e.key === 'Tab') return;
    if (SCROLL_KEYS.has(e.code)) e.preventDefault();
    onGesture('key');
    if (!e.repeat && !keys.has(e.code)) {
      keys.add(e.code);
      onTap();
    }
    refresh();
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    refresh();
  });
  window.addEventListener('blur', () => { pointers.clear(); keys.clear(); refresh(); });

  // No scrolling, no pinch zoom, no context menu / long-press menus.
  const stop = (e) => e.preventDefault();
  target.addEventListener('touchstart', stop, { passive: false });
  target.addEventListener('touchmove', stop, { passive: false });
  target.addEventListener('contextmenu', stop);
  document.addEventListener('contextmenu', stop);
  document.addEventListener('gesturestart', stop);
  document.addEventListener('gesturechange', stop);
  window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', stop);
}
