import { BottomNavIndicator, BottomNavLink } from "@/components/layout/bottom-nav-link";
import { CartLink } from "@/components/layout/header-icons";
import { viewerLinks } from "@/components/layout/store-header";
import { getViewer } from "@/lib/auth/session";

/**
 * Floating rounded menu along the bottom of phone screens, on the store, sign-in and customer portal pages. A highlight
 * slides behind the current item. It reserves its own room through `data-bottom-nav` (see globals.css), which also
 * lifts the other floating buttons above it.
 */
export async function MobileBottomNav() {
  const viewer = await getViewer();
  const { account } = viewerLinks(viewer);
  // Saved lists need an approved account; anyone else goes where the account link takes them.
  const approved = viewer.kind === "customer" && viewer.status === "approved";
  const items = [{ match: "/shop" }, { match: "/account/lists" }, { match: "/cart" }, { match: account.href, exclude: "/account/lists" }];
  return (
    <nav
      aria-label="Mobile"
      data-bottom-nav
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 grid h-16 grid-cols-4 rounded-full border border-line bg-surface/90 p-1.5 shadow-[0_10px_30px_rgb(0_0_0/0.14)] backdrop-blur-md backdrop-saturate-150 md:hidden print:hidden"
    >
      <BottomNavIndicator items={items} />
      <BottomNavLink href="/shop" icon="store" label="Shop" match="/shop" />
      <BottomNavLink href={approved ? "/account/lists" : account.href} icon="heart" label="Wishlist" match="/account/lists" />
      <CartLink stacked className="h-full w-full justify-center" />
      <BottomNavLink href={account.href} icon="user" label="My account" match={account.href} exclude="/account/lists" />
    </nav>
  );
}
