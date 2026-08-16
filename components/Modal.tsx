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
  position = 'center',
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
  // 'drawer' reuses the same focus-trap/Escape/backdrop machinery below but
  // renders as a full-height off-canvas panel sliding in from the left
  // (mobile nav) instead of a centered dialog.
  position?: 'center' | 'drawer';
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

  const isDrawer = position === 'drawer';

  return (
    <div
      className={`fixed inset-0 z-50 flex bg-black/40 ${
        isDrawer ? 'items-stretch justify-start' : 'items-center justify-center p-4'
      }`}
      onMouseDown={(e) => {
        if (closeOnBackdropClick && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={
          isDrawer
            ? 'animate-slide-in flex h-full w-72 max-w-[85vw] flex-col overflow-hidden border-r border-border bg-surface p-4 shadow-medium outline-none'
            : 'animate-scale-in flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl border border-border bg-surface p-6 shadow-medium outline-none'
        }
      >
        <div className="mb-4 flex shrink-0 items-center justify-between">
          {title && <h2 className="font-serif text-lg font-semibold text-text-primary">{title}</h2>}
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-text-secondary hover:bg-accent-soft/20 hover:text-text-primary"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
