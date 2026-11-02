import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PlannedFeatures } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  const { contact } = siteConfig;
  return (
    <>
      <PageHeader title="Contact" description="Questions about products, wholesale accounts or deliveries? Get in touch." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Contact details">
          <dl className="space-y-2 text-sm">
            <div><dt className="text-muted">Phone</dt><dd>{contact.phone}</dd></div>
            <div><dt className="text-muted">Email</dt><dd>{contact.email}</dd></div>
            <div><dt className="text-muted">Address</dt><dd>{contact.address}</dd></div>
            <div><dt className="text-muted">Hours</dt><dd>{contact.hours}</dd></div>
          </dl>
        </Card>
        <PlannedFeatures items={["Contact form (requires backend email handling)", "Map and directions"]} />
      </div>
    </>
  );
}
