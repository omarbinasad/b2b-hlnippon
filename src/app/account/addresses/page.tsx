import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PlannedFeatures } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { getPortalCustomerId } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { formatAddressLines, humanize } from "@/lib/format";

export const metadata: Metadata = { title: "Addresses" };

export default async function AddressesPage() {
  const customer = await repositories.customers.getById(await getPortalCustomerId());
  const addresses = customer?.addresses ?? [];

  return (
    <>
      <PageHeader title="Addresses" description="Delivery and billing addresses used at checkout." />
      <div className="space-y-6">
        {addresses.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {addresses.map((a) => (
              <li key={a.id}>
                <Card
                  title={a.label}
                  actions={
                    <div className="flex gap-1">
                      <Badge>{humanize(a.type)}</Badge>
                      {a.isDefault && <Badge tone="brand">Default</Badge>}
                    </div>
                  }
                >
                  <address className="text-sm not-italic">
                    {a.companyName && <p>{a.companyName}</p>}
                    <p>{a.recipientName}</p>
                    {formatAddressLines(a).map((line) => <p key={line}>{line}</p>)}
                    <p className="mt-1 text-muted">{a.phone}</p>
                  </address>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No addresses saved" />
        )}
        <PlannedFeatures items={["Add, edit and remove addresses", "Postal-code address lookup", "Set default delivery address"]} />
      </div>
    </>
  );
}
