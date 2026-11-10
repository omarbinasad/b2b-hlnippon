"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { markAdminNotificationReadAction, markAllAdminNotificationsReadAction } from "@/app/admin/notification-actions";
import { Icon, type IconName } from "@/components/ui/icons";
import { Popover } from "@/components/ui/popover";
import { cx } from "@/lib/cx";
import { formatDateTime } from "@/lib/format";
import type { AdminNotification, AdminNotificationFeed, AdminNotificationKind } from "@/lib/types";

const REFRESH_MS = 60_000;

const kindIcon: Record<AdminNotificationKind, IconName> = {
  order: "clipboard",
  registration: "fileUser",
  low_stock: "box",
  contact: "mail",
};

function Row({ item, onOpen }: { item: AdminNotification; onOpen: () => void }) {
  const [, startTransition] = useTransition();
  const body = (
    <>
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
        <Icon name={kindIcon[item.kind]} className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx("block text-sm", !item.read && "font-semibold")}>{item.title}</span>
        {item.detail && <span className="line-clamp-2 block text-xs break-words text-muted">{item.detail}</span>}
        <span className="mt-0.5 block text-[11px] text-muted">{formatDateTime(item.at)}</span>
      </span>
      {!item.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-cta-from"><span className="sr-only">Unread</span></span>}
    </>
  );
  const row = "flex items-start gap-3 px-4 py-3 text-left";
  const markRead = () => {
    if (!item.read) startTransition(() => markAdminNotificationReadAction(item.id));
  };
  return item.href ? (
    <Link
      href={item.href as Route}
      onClick={() => {
        markRead();
        onOpen();
      }}
      className={cx(row, "hover:bg-surface-muted")}
    >
      {body}
    </Link>
  ) : (
    <button type="button" onClick={markRead} className={cx(row, "w-full hover:bg-surface-muted")}>{body}</button>
  );
}

/**
 * Top-bar bell with the unread count and a dropdown of every notification. The feed comes from the server with the
 * admin layout; refreshing it about once a minute keeps the bell and the sidebar badges current. The backend can
 * replace this with push updates.
 */
export function NotificationBell({ feed }: { feed: AdminNotificationFeed }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <Popover
      label="Notifications"
      triggerClassName="relative grid size-10 place-items-center rounded-full border border-line bg-surface text-muted hover:text-foreground"
      panelClassName="right-0 !w-[min(24rem,calc(100vw-2rem))] !min-w-0 overflow-hidden !p-0"
      trigger={
        <>
          <Icon name="bell" className="size-5" />
          <span className="sr-only">Notifications{feed.unread > 0 ? ` (${feed.unread} unread)` : ""}</span>
          {feed.unread > 0 && (
            <span aria-hidden="true" className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-cta-from px-1 text-[0.6875rem] leading-none font-semibold text-white tabular-nums">
              {feed.unread > 99 ? "99+" : feed.unread}
            </span>
          )}
        </>
      }
    >
      {(close) => (
        <>
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="font-semibold">Notifications</h2>
            {feed.unread > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => markAllAdminNotificationsReadAction())}
                className="text-xs font-medium text-brand hover:underline disabled:opacity-50"
              >
                Mark all as read
              </button>
            )}
          </div>
          {feed.items.length ? (
            <ul className="scrollbar-thin max-h-[min(26rem,70vh)] divide-y divide-line overflow-y-auto overscroll-contain">
              {feed.items.map((item) => <li key={item.id}><Row item={item} onOpen={close} /></li>)}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted">Nothing needs your attention.</p>
          )}
          {feed.total > feed.items.length && (
            <p className="border-t border-line px-4 py-2 text-center text-xs text-muted">Showing the latest {feed.items.length} of {feed.total}</p>
          )}
        </>
      )}
    </Popover>
  );
}
