import type { Route } from "next";
import Link from "next/link";
import { applyCta, siteConfig } from "@/config/site";
import { Logo } from "@/components/ui/logo";
import { getViewer } from "@/lib/auth/session";

/* Only links to routes that exist — no placeholder or broken links. */
const columns: { title: string; links: { href: Route; label: string }[] }[] = [
  {
    title: "Catalog",
    links: [
      { href: "/shop", label: "All products" },
      { href: "/#categories" as Route, label: "Categories" },
      { href: "/#quick-order" as Route, label: "Quick order" },
    ],
  },
  {
    title: "For businesses",
    links: [
      { href: applyCta.href, label: applyCta.label },
      { href: "/#delivery" as Route, label: "Delivery information" },
      { href: "/about", label: "About us" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/contact", label: "Contact us" },
      { href: "/login", label: "Log in" },
      { href: "/account", label: "Customer account" },
    ],
  },
];

export async function StoreFooter() {
  // Signed-in viewers (MOCK viewer for now) don't need the apply and log-in links.
  const signedIn = (await getViewer()).kind !== "guest";
  const visible = columns.map((col) => ({ ...col, links: col.links.filter((l) => !signedIn || (l.href !== applyCta.href && l.href !== "/login")) }));
  const { name, description, contact } = siteConfig;
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-site gap-8 px-4 py-10 text-sm sm:px-6 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-sm text-muted">{description}</p>
          <address className="space-y-0.5 text-muted not-italic">
            <p>{contact.address}</p>
            <p>
              <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`} className="hover:text-foreground">{contact.phone}</a>
              {" · "}
              <a href={`mailto:${contact.email}`} className="hover:text-foreground">{contact.email}</a>
            </p>
            <p>{contact.hours}</p>
          </address>
        </div>
        {visible.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="font-semibold">{col.title}</h2>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-muted hover:text-foreground">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-site px-4 py-4 text-xs text-muted sm:px-6">
          © {new Date().getFullYear()} {name}. Prices are shown to approved business customers and exclude tax unless stated.
        </p>
      </div>
    </footer>
  );
}
