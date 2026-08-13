'use client';

import { ReactNode, useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({
  open,
  onClose,
  title,
  children,
  closeOnBackdropClick = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  // Off by default so an accidental click outside a rule/appointment
  // editor can't silently discard in-progress edits — opt in for
  // lower-stakes overlays (e.g. the onboarding tour) where PLAN.md
  // explicitly calls for "click outside closes it" behavior.
  closeOnBackdropClick?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus trap + Escape-to-close + focus-return to the triggering element.
  // Previously this Modal had none of the three, which meant every
  // modal-based flow (rule editor, appointment editor, and now the
  // onboarding tour) was a keyboard-accessibility dead end — see PLAN.md
  // Section 2 item 5.
  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable?.[0] ?? dialog)?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = dialog?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (closeOnBackdropClick && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-lg outline-none"
      >
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="font-serif text-lg font-semibold text-text-primary">{title}</h2>}
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-text-secondary hover:bg-accent-soft/20 hover:text-text-primary"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
