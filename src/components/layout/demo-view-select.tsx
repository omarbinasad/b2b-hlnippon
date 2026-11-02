"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { setDemoViewAction } from "@/app/demo-view-actions";
import { Icon } from "@/components/ui/icons";

const subscribe = () => () => {};

/** The switcher's interactive part: a pill showing the current view, expanding to a small panel. Sits above the bottom-left corner, where the Next.js dev indicator is shown. */
export function DemoViewSelect({ cookieName, fallback, options }: { cookieName: string; fallback: string; options: { value: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string>();
  const [pending, startTransition] = useTransition();
  // The view saved in the browser (a demo preference, not a secret); the server falls back to MOCK_VIEWER the same way.
  const saved = useSyncExternalStore(
    subscribe,
    () => document.cookie.split("; ").find((c) => c.startsWith(`${cookieName}=`))?.split("=")[1],
    () => undefined,
  );
  const current = chosen ?? (saved && options.some((o) => o.value === saved) ? saved : fallback);
  const label = options.find((o) => o.value === current)?.label ?? current;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-16 left-4 z-40 inline-flex max-w-[calc(100vw-2rem)] items-center gap-1.5 rounded-full border border-warning bg-warning-soft px-3 py-1.5 text-xs font-medium text-foreground shadow-lg"
      >
        <Icon name="eye" className="size-3.5 shrink-0" />
        <span className="truncate">Demo view: {label}</span>
      </button>
    );
  }

  return (
    <div role="region" aria-label="Demo view" className="fixed bottom-16 left-4 z-40 w-[min(19rem,calc(100vw-2rem))] rounded-ui border border-warning bg-surface p-3 text-sm shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <label htmlFor="demo-view" className="font-semibold">View the site as</label>
        <button type="button" onClick={() => setOpen(false)} className="-mt-1 -mr-1 rounded-ui p-1 text-muted hover:bg-surface-muted hover:text-foreground" aria-label="Minimise demo view">
          <Icon name="close" className="size-4" />
        </button>
      </div>
      <select
        id="demo-view"
        value={current}
        disabled={pending}
        onChange={(e) => {
          const view = e.target.value;
          startTransition(async () => {
            const r = await setDemoViewAction(view);
            if (r.ok) {
              setChosen(view);
              router.refresh();
            }
          });
        }}
        aria-describedby="demo-view-hint"
        className="mt-2 h-9 w-full rounded-ui border border-line bg-surface px-2 text-base sm:text-sm"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <p id="demo-view-hint" className="mt-2 text-xs text-muted">
        {pending ? "Switching…" : "Demo only — not a real login. Prices, product cards, quick order, cart and checkout change with the view."}
      </p>
    </div>
  );
}
