import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icons";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { getViewer } from "@/lib/auth/session";
import { quickOrderAccess } from "@/lib/storefront/quick-order";
import { cx } from "@/lib/cx";
import { repositories } from "@/lib/data";
import type { ID } from "@/lib/types";

/** Icon link with an optional count badge (hidden at 0; "99+" above 99). */
function CountLink({ href, icon, label, count, showLabel, className }: { href: "/account/notifications"; icon: IconName; label: string; count: number; showLabel?: boolean; className?: string }) {
  const accessible = count > 0 ? `${label} (${count})` : label;
  return (
    <Link href={href} aria-label={accessible} className={cx("relative inline-flex items-center gap-2 rounded-ui px-2 py-2 text-sm font-medium text-muted hover:text-foreground", className)}>
      <span className="relative">
        <Icon name={icon} className="size-5" />
        {count > 0 && (
          <span aria-hidden="true" className="absolute -top-2 -right-2.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[0.625rem] leading-none font-semibold text-brand-contrast tabular-nums">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
      {showLabel && <span className="hidden lg:inline">{label}</span>}
    </Link>
  );
}

/**
 * Cart icon with the number of products, opening the cart panel. The cart is loaded on the server per request
 * (customer-specific, never cached publicly); cart actions revalidate every page so the panel follows each change.
 */
export async function CartLink({ showLabel, stacked, className }: { showLabel?: boolean; stacked?: boolean; className?: string }) {
  const viewer = await getViewer();
  const access = quickOrderAccess(viewer);
  const cart = access === "approved" && viewer.kind === "customer" ? await repositories.cart.get(viewer.customerId) : undefined;
  return <CartDrawer access={access} cart={cart} showLabel={showLabel} stacked={stacked} className={className} />;
}

/** Bell with the customer's unread notification count, linking to the notification list. */
export async function NotificationLink({ customerId, className }: { customerId: ID; className?: string }) {
  const { total } = await repositories.customers.listNotifications(customerId, { unreadOnly: true, perPage: 1 });
  return <CountLink href="/account/notifications" icon="bell" label="Notifications" count={total} className={className} />;
}
