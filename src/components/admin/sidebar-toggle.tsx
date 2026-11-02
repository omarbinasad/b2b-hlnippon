"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/icons";
import { SIDEBAR_STORAGE_KEY } from "@/components/ui/theme";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-sidebar"] });
  return () => observer.disconnect();
}
const isCollapsed = () => document.documentElement.dataset.sidebar === "collapsed";
const serverSnapshot = () => false;

/** Collapses the desktop admin sidebar to an icon rail and back; the choice is saved in the browser. */
export function SidebarToggle({ controls }: { controls: string }) {
  const collapsed = useSyncExternalStore(subscribe, isCollapsed, serverSnapshot);

  const toggle = () => {
    const next = !collapsed;
    if (next) document.documentElement.dataset.sidebar = "collapsed";
    else delete document.documentElement.dataset.sidebar;
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "collapsed" : "expanded");
    } catch {
      // Storage unavailable: the choice lasts for this page only.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={!collapsed}
      aria-controls={controls}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="flex w-full items-center gap-3 rounded-ui px-3 py-2.5 text-sm font-medium hover:bg-sidebar-active/60 hover:text-sidebar-active-foreground"
    >
      <Icon name="chevronsLeft" className="size-5 shrink-0 transition-transform sidebar-collapsed:rotate-180" />
      <span className="sidebar-collapsed:sr-only">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
    </button>
  );
}
