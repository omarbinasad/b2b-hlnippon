import type { Metadata } from "next";
import Link from "next/link";
import { DemoEditingNotice, MockPermissionNote } from "@/components/admin/demo-notice";
import { QuickCustomerForm } from "@/components/admin/customers/quick-customer-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Add customer" };

export default async function NewCustomerPage() {
  const groups = await repositories.customers.listGroups();
  return (
    <>
      <Link href="/admin/customers" className="text-sm text-muted hover:text-foreground">← All customers</Link>
      <PageHeader title="Add customer" description="Quick add with the essentials. Addresses and business details can be completed later." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,40rem)_1fr]">
        <Card>
          <QuickCustomerForm groups={groups} />
        </Card>
        <div className="space-y-3">
          <MockPermissionNote permission="customers.manage" />
          <p className="text-xs text-muted">No welcome email or SMS is sent; messaging is a later module. No login is created.</p>
          <DemoEditingNotice />
        </div>
      </div>
    </>
  );
}
