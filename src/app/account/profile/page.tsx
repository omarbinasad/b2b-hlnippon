import type { Metadata } from "next";
import { AccountStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PlannedFeatures } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { getPortalCustomerId } from "@/lib/auth/session";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const customer = await repositories.customers.getById(await getPortalCustomerId());

  return (
    <>
      <PageHeader title="Profile" description="Your business and contact details." />
      <div className="space-y-6">
        {customer && (
          <Card title={customer.companyName} actions={<AccountStatusBadge status={customer.status} />}>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Contact</dt><dd>{customer.contactName ?? "—"}</dd></div>
              <div><dt className="text-muted">Business type</dt><dd>{customer.businessType}</dd></div>
              <div><dt className="text-muted">Email</dt><dd>{customer.email ?? "—"}</dd></div>
              <div><dt className="text-muted">Phone</dt><dd>{customer.phone ?? "—"}</dd></div>
            </dl>
          </Card>
        )}
        <PlannedFeatures items={["Edit contact details", "Change password", "Manage additional users for the account"]} />
      </div>
    </>
  );
}
