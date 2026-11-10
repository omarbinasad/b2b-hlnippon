"use client";

import { useTransition } from "react";
import { demoLogoutAction } from "@/app/demo-view-actions";
import { cx } from "@/lib/cx";

export function LogoutButton({ className }: { className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => demoLogoutAction())} className={cx("hover:underline", className)}>
      {pending ? "Logging out…" : "Log out"}
    </button>
  );
}
