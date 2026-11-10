import type { Metadata } from "next";
import Link from "next/link";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { RoleEditor } from "@/components/admin/staff/role-editor";
import { PageHeader } from "@/components/ui/page-header";
import { getAdminRole } from "@/lib/auth/session";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Add role" };

export default async function NewRolePage() {
  const [roles, acting] = await Promise.all([repositories.staff.roles(), getAdminRole()]);
  return (
    <>
      <Link href="/admin/roles" className="text-sm text-muted hover:text-foreground">← All roles</Link>
      <PageHeader title="Add role" />
      <RoleEditor roles={roles.map((r) => ({ id: r.id, name: r.name }))} actingRole={{ id: acting?.id ?? "", name: acting?.name ?? "" }} />
      <div className="mt-6"><DemoEditingNotice /></div>
    </>
  );
}
