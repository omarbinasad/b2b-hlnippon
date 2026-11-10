import type { Metadata } from "next";
import { PasswordForm, ProfileForm } from "@/components/account/profile-forms";
import { AccountStatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { getPortalCustomerId } from "@/lib/auth/session";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const customer = await repositories.customers.getById(await getPortalCustomerId());
  return (
    <>
      <PageHeader title="Profile" description="Your business and contact details." actions={customer && <AccountStatusBadge status={customer.status} />} />
      <div className="space-y-6">
        {customer && <ProfileForm initial={{ companyName: customer.companyName, contactName: customer.contactName ?? "", email: customer.email ?? "", phone: customer.phone ?? "", remindersOptOut: customer.remindersOptOut }} />}
        <PasswordForm />
      </div>
    </>
  );
}
