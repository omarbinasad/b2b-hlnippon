"use client";

import { useRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Button } from "./button";

interface ConfirmButtonProps {
  /** Trigger content (e.g. icon + label). */
  children: ReactNode;
  /** Accessible name for icon-only triggers. */
  label?: string;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  className?: string;
}

/**
 * Submit button that asks for confirmation first. Place it inside a <form>; on
 * confirm it submits that form (works with server actions). Uses the native
 * modal <dialog>, which traps focus and closes on Escape.
 */
export function ConfirmButton({ children, label, title, message, confirmLabel, className }: ConfirmButtonProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
        className={className}
      >
        {children}
      </button>
      <dialog
        ref={dialogRef}
        aria-label={title}
        className={cx(
          "m-auto w-[min(26rem,calc(100vw-2rem))] rounded-ui border border-line bg-surface p-5 text-foreground shadow-xl",
          "backdrop:bg-black/50",
        )}
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="mt-2 text-sm text-muted">{message}</div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => dialogRef.current?.close()}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              dialogRef.current?.close();
              triggerRef.current?.form?.requestSubmit();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </dialog>
    </>
  );
}
