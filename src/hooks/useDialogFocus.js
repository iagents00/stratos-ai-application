import { useEffect, useRef } from 'react';

// For dialogs portalled outside #root: isolate background controls and restore
// the opener on close. Keep normal tab order inside the dialog.
export function useDialogFocus(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open || !ref.current) return;
    const dialog = ref.current;
    const opener = document.activeElement;
    const root = document.getElementById('root');
    const wasInert = root?.inert;
    const overflow = document.body.style.overflow;
    if (root && !root.contains(dialog)) root.inert = true;
    document.body.style.overflow = 'hidden';
    const focusables = () => [...dialog.querySelectorAll('button, input, select, textarea, a[href], [tabindex]')]
      .filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length > 0);
    (dialog.querySelector('input') || focusables()[0] || dialog).focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        onClose();
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      const first = items[0], last = items.at(-1);
      if (!first) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      dialog.removeEventListener('keydown', onKeyDown);
      if (root) root.inert = wasInert;
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [open, onClose]);
  return ref;
}
