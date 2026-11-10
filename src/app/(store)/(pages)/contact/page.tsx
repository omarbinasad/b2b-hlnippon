import type { Metadata } from "next";
import { ContactForm } from "@/components/storefront/contact-form";
import { Card } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Contact", description: "Questions about products, wholesale accounts or deliveries? Get in touch." };

/** OpenStreetMap embed around a point (no API key), with a marker. */
function mapEmbedUrl({ lat, lng }: { lat: number; lng: number }) {
  const d = 0.006;
  const bbox = [lng - d, lat - d, lng + d, lat + d].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lng}`;
}

export default function ContactPage() {
  const { contact } = siteConfig;
  const directions = contact.map && `https://www.google.com/maps/search/?api=1&query=${contact.map.lat},${contact.map.lng}`;
  const details: { icon: IconName; label: string; value: string; href?: string }[] = [
    { icon: "phone", label: "Phone", value: contact.phone, href: `tel:${contact.phone.replace(/[^+\d]/g, "")}` },
    { icon: "mail", label: "Email", value: contact.email, href: `mailto:${contact.email}` },
    { icon: "mapPin", label: "Address", value: contact.address },
    ...(contact.hours ? [{ icon: "clock" as const, label: "Hours", value: contact.hours }] : []),
  ];

  return (
    <>
      <PageHeader title="Contact us" description="Questions about products, wholesale accounts or deliveries? Send us a message or give us a call." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
        <Card title="Send us a message">
          <ContactForm />
        </Card>

        <div className="space-y-6">
          <Card title="Contact details">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {details.map((d) => (
                <div key={d.label} className="flex min-w-0 items-start gap-3">
                  <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                    <Icon name={d.icon} className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted">{d.label}</dt>
                    <dd className="text-sm font-medium break-words">
                      {d.href ? <a href={d.href} className="hover:text-brand hover:underline">{d.value}</a> : d.value}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </Card>

          {contact.map && directions && (<section aria-label="Map" className="overflow-hidden rounded-ui border border-line bg-surface">
            <iframe
              title={`Map showing ${contact.map.label}`}
              src={mapEmbedUrl(contact.map)}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              sandbox="allow-scripts allow-same-origin allow-popups"
              className="block aspect-[4/3] w-full bg-surface-muted"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span className="text-xs text-muted">{contact.map.label}</span>
              <a href={directions} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
                Open in Google Maps <Icon name="arrowRight" className="size-4" />
              </a>
            </div>
          </section>)}
        </div>
      </div>
    </>
  );
}
