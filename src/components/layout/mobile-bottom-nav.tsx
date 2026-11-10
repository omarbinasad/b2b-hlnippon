import { BottomNavLink } from "@/components/layout/bottom-nav-link";
import { CartLink } from "@/components/layout/header-icons";
import { viewerLinks } from "@/components/layout/store-header";
import { getViewer } from "@/lib/auth/session";

/**
 * Sticky menu along the bottom of phone screens, on the store, sign-in and customer portal pages. It reserves its own
 * room through `data-bottom-nav` (see globals.css), which also lifts the other floating buttons above it.
 */
export async function MobileBottomNav() {
  const viewer = await getViewer();
  const { account } = viewerLinks(viewer);
  // Saved lists need an approved account; anyone else goes where the account link takes them.
  const approved = viewer.kind === "customer" && viewer.status === "approved";
  return (
    <nav
      aria-label="Mobile"
      data-bottom-nav
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
    >
      <BottomNavLink href="/shop" icon="store" label="Shop" match="/shop" />
      <BottomNavLink href={approved ? "/account/lists" : account.href} icon="heart" label="Wishlist" match="/account/lists" />
      <CartLink stacked className="h-15 w-full justify-center rounded-none text-xs" />
      <BottomNavLink href={account.href} icon="user" label="My account" match={account.href} exclude="/account/lists" />
    </nav>
  );
}
