"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";

interface PopoverProps {
  /** Content of the trigger button. */
  trigger: ReactNode;
  triggerClassName?: string;
  /** Accessible name of the panel. */
  label: string;
  panelClassName?: string;
  /** Render prop so the panel can close itself (e.g. after Apply). */
  children: (close: () => void) => ReactNode;
}

/** Button + floating panel. Closes on Escape and outside click; returns focus to the trigger. */
export function Popover({ trigger, triggerClassName, label, panelClassName, children }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const panelId = useId();
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    // When the panel closes while focus was inside it, focus falls to <body>; send it back to the trigger.
    if (wasOpen.current && !open && (!document.activeElement || document.activeElement === document.body)) {
      buttonRef.current?.focus();
    }
    wasOpen.current = open;
    if (!open) return;

    panelRef.current?.querySelector<HTMLElement>("input:checked, input, button, select")?.focus();
    // Ignore keys a nested widget (e.g. a date picker) already handled.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && setOpen(false);
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={label}
          className={cx(
            "absolute top-full z-40 mt-2 w-full min-w-72 rounded-ui border border-line bg-surface p-4 shadow-lg sm:right-0 sm:w-80",
            panelClassName,
          )}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}
