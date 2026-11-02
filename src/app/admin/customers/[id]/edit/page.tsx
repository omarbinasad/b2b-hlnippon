import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerDetailsForm } from "@/components/admin/customers/customer-details-form";
import { DemoEditingNotice, MockPermissionNote } from "@/components/admin/demo-notice";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Edit customer" };

export default async function EditCustomerPage({ params }: PageProps<"/admin/customers/[id]/edit">) {
  const { id } = await params;
  const [customer, groups, routes] = await Promise.all([
    repositories.customers.getById(id),
    repositories.customers.listGroups(),
    repositories.delivery.listRoutes({ perPage: 48 }),
  ]);
  if (!customer) notFound();

  return (
    <>
      <Link href={`/admin/customers/${customer.id}`} className="text-sm text-muted hover:text-foreground">← {customer.companyName}</Link>
      <PageHeader title="Edit customer" description="Addresses and approval status are managed on the customer page." />
      <div className="max-w-3xl space-y-4">
        <CustomerDetailsForm customer={customer} groups={groups} routes={routes.items.map((r) => ({ id: r.id, name: r.name }))} />
        <MockPermissionNote permission="customers.manage" />
        <p className="text-xs text-muted">Past orders keep the name and contact details they were placed with.</p>
        <DemoEditingNotice />
      </div>
    </>
  );
}
