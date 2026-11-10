import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { StaffEditor } from "@/components/admin/staff/staff-forms";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Staff member" };

export default async function StaffMemberPage({ params, searchParams }: PageProps<"/admin/staff/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [member, roles] = await Promise.all([repositories.staff.staffMember(id), repositories.staff.roles()]);
  if (!member) notFound();
  return (
    <>
      <Link href="/admin/staff" className="text-sm text-muted hover:text-foreground">← All staff</Link>
      <PageHeader title={member.name} description={member.email} />
      <StaffEditor key={member.id} member={member} roles={roles} created={sp.notice === "created"} />
      <div className="mt-6"><DemoEditingNotice /></div>
    </>
  );
}
