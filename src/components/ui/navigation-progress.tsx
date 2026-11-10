"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

/*
 * The preloader, on every page: a thin bar at the top, the page gently dimming, a small spinner if it takes a moment, and
 * the new page fading in. Styles are in globals.css under "Preloader".
 *
 * It's one layer in the root layout instead of a loading.tsx everywhere: a loading.tsx only covers navigation into its own
 * segment, and starts the response early, so a page that isn't found could no longer answer 404. The skeleton loading.tsx
 * files still show where they exist.
 *
 * State is an attribute on <html>: none while the first page loads (bar only), "loading" during a navigation, "skeleton"
 * while a loading.tsx is showing (the address has changed but the content hasn't arrived), "done" after.
 */

/** Longest the page stays dimmed if a navigation never arrives, such as a failed connection. */
const GIVE_UP_MS = 10_000;
/** Links that download a file: the page stays where it is, so nothing would ever end the preloader. */
const FILE_LINK = /\/(export$|media\/|documents\/)/;

let giveUp: ReturnType<typeof setTimeout> | undefined;
let skeletons = 0;

const finish = () => {
  clearTimeout(giveUp);
  document.documentElement.dataset.nav = skeletons ? "skeleton" : "done";
};

/** Goes in a loading.tsx: keeps the preloader running until the real page replaces the skeleton. */
export function LoadingMark() {
  useEffect(() => {
    skeletons += 1;
    document.documentElement.dataset.nav = "skeleton";
    return () => {
      skeletons -= 1;
      finish();
    };
  }, []);
  return null;
}

/** Starts the preloader for a navigation made from code, such as router.push. Links and search forms start it themselves. */
export function startNavigationProgress() {
  clearTimeout(giveUp);
  document.documentElement.dataset.nav = "loading";
  giveUp = setTimeout(finish, GIVE_UP_MS);
}

function onClick(e: MouseEvent) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
  const url = new URL(link.href);
  if (url.origin !== location.origin || FILE_LINK.test(url.pathname)) return;
  // Same page, including a link to a heading on it.
  if (url.pathname === location.pathname && url.search === location.search) return;
  startNavigationProgress();
}

function onSubmit(e: SubmitEvent) {
  const form = e.target as HTMLFormElement;
  // Only plain search forms load a new page. Server actions report through their own button.
  if (!e.defaultPrevented && form.method === "get" && !form.target) startNavigationProgress();
}

/** Coming back with the browser's back button can restore a page exactly as it was left, preloader included. */
const onPageShow = (e: PageTransitionEvent) => {
  if (e.persisted) finish();
};

/** The route changing is what ends it. Also ends the first page's bar, once the page is interactive. */
function RouteWatcher() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    finish();
  }, [pathname, search]);
  return null;
}

export function NavigationProgress() {
  useEffect(() => {
    // On window and in the bubble phase: the unsaved-changes guard stops the click before it gets here, so a link that
    // only opened its "Discard changes?" dialog doesn't start the preloader.
    window.addEventListener("click", onClick);
    window.addEventListener("submit", onSubmit);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("submit", onSubmit);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);
  return (
    <>
      <div aria-hidden className="nav-progress" />
      <div aria-hidden className="nav-spinner" />
      <Suspense fallback={null}>
        <RouteWatcher />
      </Suspense>
    </>
  );
}
