"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { startNavigationProgress } from "@/components/ui/navigation-progress";

let unsaved = false;

/** For controls outside the form, such as "Preview as" in the top bar. */
export const hasUnsavedChanges = () => unsaved;

/**
 * Warns before leaving a form with unsaved changes: closing or reloading the tab (the browser's own warning), and links
 * inside the app (our dialog). The browser's back button can't be intercepted in the app router, so it isn't covered.
 */
export function useUnsavedGuard(dirty: boolean) {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    unsaved = dirty;
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      e.preventDefault();
      e.stopPropagation();
      setTarget(url.pathname + url.search);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      unsaved = false;
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const dialog = (
    <Dialog open={target !== null} onClose={() => setTarget(null)} title="Discard unsaved changes?" description="You've changed this but haven't saved it. Leaving now loses those changes.">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={() => setTarget(null)}>Keep editing</Button>
        <Button variant="danger" onClick={() => { if (target) { startNavigationProgress(); router.push(target as never); } setTarget(null); }}>Discard and leave</Button>
      </div>
    </Dialog>
  );

  /** Go somewhere, asking first if there are unsaved changes. */
  const navigate = (href: string) => {
    if (dirty) setTarget(href);
    else {
      startNavigationProgress();
      router.push(href as never);
    }
  };

  return { dialog, navigate };
}
