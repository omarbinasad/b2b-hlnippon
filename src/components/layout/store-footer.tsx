import type { Route } from "next";
import Link from "next/link";
import { applyCta, siteConfig } from "@/config/site";
import { repositories } from "@/lib/data";
import { Logo } from "@/components/ui/logo";
import { getViewer } from "@/lib/auth/session";

export async function StoreFooter() {
  // Signed-in viewers (MOCK viewer for now) don't need the apply and log-in links.
  const signedIn = (await getViewer()).kind !== "guest";
  const menu = await repositories.navigation.resolved("footer");
  // Items with children are columns; loose top-level links share a final column.
  const loose = menu.filter((i) => !i.children.length);
  const columns = [...menu.filter((i) => i.children.length), ...(loose.length ? [{ id: "more", label: "More", href: "#", children: loose }] : [])];
  const visible = columns.map((col) => ({ ...col, children: col.children.filter((l) => !signedIn || (l.href !== applyCta.href && l.href !== "/login")) }));
  const { name, description, contact, legalName, registrationNumber } = siteConfig;
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
            {contact.hours && <p>{contact.hours}</p>}
            {contact.whatsapp && (
              <p><a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`} rel="noopener" className="hover:text-foreground">WhatsApp: {contact.whatsapp}</a></p>
            )}
          </address>
          {contact.social.length > 0 && (
            <ul className="flex flex-wrap gap-x-3 gap-y-1">
              {contact.social.map((s) => (
                <li key={s.url}><a href={s.url} rel="noopener" className="text-muted capitalize hover:text-foreground">{s.network}</a></li>
              ))}
            </ul>
          )}
        </div>
        {visible.map((col) => (
          <nav key={col.id} aria-label={col.label}>
            <h2 className="font-semibold">{col.label}</h2>
            <ul className="mt-3 space-y-2">
              {col.children.map((l) => (
                <li key={l.id}>
                  <Link href={l.href as Route} className="text-muted hover:text-foreground">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-site px-4 py-4 text-xs text-muted sm:px-6">
          © {new Date().getFullYear()} {legalName ?? name}.{registrationNumber ? ` Registration no. ${registrationNumber}.` : ""} Prices are shown to approved business customers and exclude tax unless stated.
        </p>
      </div>
    </footer>
  );
}
