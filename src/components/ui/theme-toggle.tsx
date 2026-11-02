"use client";

import { useEffect, useSyncExternalStore } from "react";
import { cx } from "@/lib/cx";
import { Icon } from "./icons";
import { THEME_STORAGE_KEY } from "./theme";

type Theme = "light" | "dark";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const getTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
// Unknown during server render; the real value is applied right after hydration.
const getServerTheme = (): Theme | null => null;

function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage unavailable (private mode): the choice lasts for this page only.
  }
}

/**
 * Light/dark switch. `switch` = sun · toggle · moon (dashboard header);
 * `icon` = compact single button (store and portal headers).
 */
export function ThemeToggle({ variant = "icon", className }: { variant?: "switch" | "icon"; className?: string }) {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);
  const isDark = theme === "dark";

  // Follow the system preference until the user makes a choice.
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(THEME_STORAGE_KEY);
      } catch {}
      if (saved !== "light" && saved !== "dark") document.documentElement.dataset.theme = media.matches ? "dark" : "light";
    };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  const toggle = () => setTheme(isDark ? "light" : "dark");

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className={cx(
          "inline-flex size-10 items-center justify-center rounded-ui text-muted hover:bg-surface-muted hover:text-foreground",
          className,
        )}
      >
        <Icon name={isDark ? "sun" : "moon"} className="size-5" />
      </button>
    );
  }

  return (
    <div className={cx("inline-flex h-11 items-center gap-2 rounded-ui border border-line bg-surface px-3", className)}>
      <Icon name="sun" className={cx("size-5", isDark ? "text-muted" : "text-warning")} />
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label="Dark mode"
        onClick={toggle}
        className={cx(
          "relative h-6 w-11 rounded-full bg-brand transition-colors",
          theme === null && "opacity-0",
        )}
      >
        <span
          aria-hidden
          className={cx(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-surface shadow transition-transform",
            isDark && "translate-x-5",
          )}
        />
      </button>
      <Icon name="moon" className={cx("size-5", isDark ? "text-brand" : "text-muted")} />
    </div>
  );
}
