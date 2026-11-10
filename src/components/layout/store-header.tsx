import Link from "next/link";
import { applyCta, siteConfig } from "@/config/site";
import { categoryIcons, defaultCategoryIcon } from "@/config/storefront";
import { LogoutButton } from "./logout-button";
import { HeaderMenu, MobileMenuLinks } from "./menu-links";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getViewer, type Viewer } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { buildCategoryTree, type CategoryNode } from "@/lib/catalog/category-tree";
import { CategoryMenu, type MenuCategory } from "./category-menu";
import { CartLink } from "./header-icons";
import { MobileMenu } from "./mobile-menu";

const iconLink = "inline-flex items-center gap-2 rounded-ui px-2 py-2 text-sm font-medium text-muted hover:text-foreground";

/** Product/SKU search that lands on the existing catalog route (/shop?q=…). */
function SearchForm({ id, className }: { id: string; className?: string }) {
  return (
    <form role="search" action="/shop" className={className}>
      <label htmlFor={id} className="sr-only">Search products or SKU</label>
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <input
          id={id}
          name="q"
          type="search"
          placeholder="Search products or SKU"
          autoComplete="off"
          className="h-10 w-full rounded-full border border-line bg-surface pr-4 pl-9 text-base placeholder:text-muted focus:border-brand focus:ring-3 focus:ring-brand/25 focus:outline-none sm:text-sm"
        />
      </div>
    </form>
  );
}

/** Mobile menu categories: top-level categories with subcategories open as disclosures (no JS needed). */
function MobileCategoryTree({ nodes, depth = 0 }: { nodes: CategoryNode[]; depth?: number }) {
  return (
    <ul className={depth ? "mt-1 space-y-0.5 border-l border-line pl-2" : "mt-1 space-y-0.5"}>
      {nodes.map((c) => (
        <li key={c.slug}>
          {c.children.length === 0 ? (
            <Link href={`/shop?category=${c.slug}`} className="flex items-center gap-3 rounded-ui px-3 py-2 text-sm hover:bg-surface-muted">
              {depth === 0 && <Icon name={categoryIcons[c.slug] ?? defaultCategoryIcon} className="size-5 shrink-0 text-brand" />}
              {c.name}
            </Link>
          ) : (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-ui px-3 py-2 text-sm hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
                {depth === 0 && <Icon name={categoryIcons[c.slug] ?? defaultCategoryIcon} className="size-5 shrink-0 text-brand" />}
                {c.name}
                <Icon name="chevronDown" className="ml-auto size-4 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="pb-1 pl-3">
                <Link href={`/shop?category=${c.slug}`} className="block rounded-ui px-3 py-2 text-sm font-medium text-brand hover:bg-surface-muted">All {c.name}</Link>
                <MobileCategoryTree nodes={c.children} depth={depth + 1} />
              </div>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Account link and main call to action for the current viewer (MOCK viewer until real sign-in exists). */
export function viewerLinks(viewer: Viewer) {
  // Admins see the same header as an approved customer; the extra Admin panel button is added separately.
  if (viewer.kind === "admin" || viewer.kind === "customer")
    return viewer.kind === "admin" || viewer.status === "approved"
      ? ({ account: { href: "/account", label: "My account" }, cta: { href: "/account/quick-order", label: "Quick order" } } as const)
      : ({ account: { href: "/account", label: "My account" }, cta: { href: "/account", label: "Application status" } } as const);
  return { account: { href: "/login", label: "Log in" }, cta: applyCta } as const;
}

export async function StoreHeader() {
  // Complete public category tree (hidden categories — e.g. the demo seed — are left out by the repository).
  const tree = buildCategoryTree(await repositories.products.listCategories());
  const menu: MenuCategory[] = tree.map((c) => ({ ...c, icon: categoryIcons[c.slug] ?? defaultCategoryIcon }));
  const viewer = await getViewer();
  const [navItems, { topBar }] = await Promise.all([repositories.navigation.resolved("header"), repositories.siteContent.get()]);
  const { account, cta } = viewerLinks(viewer);
  const isAdmin = viewer.kind === "admin";

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      {/* Top bar */}
      <div className="border-b border-line bg-brand-soft/60">
        <div className="mx-auto flex h-8 max-w-site items-center justify-between gap-4 px-4 text-xs text-muted sm:px-6">
          <p className="flex min-w-0 items-center gap-2 truncate">
            <Icon name="truck" className="size-4 shrink-0 text-brand" />
            <span className="truncate">{topBar}</span>
          </p>
          {viewer.kind !== "guest" && <LogoutButton className="shrink-0 hover:text-foreground" />}
          <a href={`tel:${siteConfig.contact.phone.replace(/[^+\d]/g, "")}`} className="hidden shrink-0 hover:text-foreground sm:inline">
            {siteConfig.contact.phone}
          </a>
        </div>
      </div>

      {/* Logo, search, account, cart */}
      <div className="relative mx-auto flex max-w-site items-center gap-3 px-4 py-3 sm:px-6">
        <Logo responsive />
        <SearchForm id="header-search" className="mx-auto hidden w-full max-w-xl md:block" />
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Link href={account.href} className={iconLink} aria-label={account.label}>
            <Icon name="user" className="size-5" />
            <span className="hidden whitespace-nowrap lg:inline">{account.label}</span>
          </Link>
          <CartLink showLabel />
          <ThemeToggle />
          <MobileMenu>
            <nav aria-label="Main mobile" className="space-y-4">
              <ul className="space-y-1">
                <MobileMenuLinks items={navItems} />
                <li>
                  <Link href={account.href} className="block rounded-ui px-3 py-2 text-sm font-medium hover:bg-surface-muted">{account.label}</Link>
                </li>
              </ul>
              <div>
                <p className="px-3 text-xs font-semibold tracking-wide text-muted uppercase">Categories</p>
                <MobileCategoryTree nodes={tree} />
              </div>
              {isAdmin && <ButtonLink href="/admin" variant="secondary" className="w-full">Admin panel</ButtonLink>}
              <ButtonLink href={cta.href} className="w-full">{cta.label}</ButtonLink>
            </nav>
          </MobileMenu>
        </div>
      </div>

      {/* Mobile search */}
      <div className="px-4 pb-3 md:hidden">
        <SearchForm id="header-search-mobile" />
      </div>

      {/* Category menu, navigation, application CTA. Below 1280px the menu button takes over: this row doesn't fit. */}
      <div className="hidden border-t border-line xl:block">
        <div className="mx-auto flex max-w-site items-center gap-4 px-4 py-2 sm:px-6">
          <CategoryMenu categories={menu} />
          <nav aria-label="Main">
            <HeaderMenu items={navItems} />
          </nav>
          {isAdmin && (
            <ButtonLink href="/admin" variant="secondary" size="sm" className="ml-auto">
              <Icon name="settings" className="size-4" /> Admin panel
            </ButtonLink>
          )}
          <ButtonLink href={cta.href} size="sm" className={isAdmin ? undefined : "ml-auto"}>
            {cta.label}
            <Icon name="arrowRight" className="size-4" />
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
