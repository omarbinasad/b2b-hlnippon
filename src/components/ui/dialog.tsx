"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * Controlled modal built on the native <dialog> (focus trap, Escape to close,
 * focus returns to the trigger). Render it only on the client side of a leaf.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      className={cx(
        // text-left: dialogs opened from right-aligned table cells must not inherit their alignment.
        "m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-ui border border-line bg-surface p-5 text-left font-normal text-foreground shadow-xl",
        "backdrop:bg-black/50",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="-mt-1 -mr-1 rounded-ui p-1 text-muted hover:bg-surface-muted hover:text-foreground">
          ✕
        </button>
      </div>
      {description && <div className="mt-1 text-sm text-muted">{description}</div>}
      <div className="mt-4">{open && children}</div>
    </dialog>
  );
}
