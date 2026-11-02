import type { Metadata } from "next";
import Link from "next/link";
import { GroupForm } from "@/components/admin/customer-groups/group-form";
import { DemoEditingNotice, MockPermissionNote } from "@/components/admin/demo-notice";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "New customer group" };

export default function NewGroupPage() {
  return (
    <>
      <Link href="/admin/customer-groups" className="text-sm text-muted hover:text-foreground">← All groups</Link>
      <PageHeader title="New customer group" description="Add members after creating the group." />
      <div className="max-w-2xl space-y-4">
        <Card>
          <GroupForm />
        </Card>
        <MockPermissionNote permission="customer-groups.manage" />
        <DemoEditingNotice />
      </div>
    </>
  );
}
