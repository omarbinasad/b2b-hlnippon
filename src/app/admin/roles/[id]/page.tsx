import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { RoleEditor } from "@/components/admin/staff/role-editor";
import { PageHeader } from "@/components/ui/page-header";
import { getAdminRole } from "@/lib/auth/session";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Edit role" };

export default async function RolePage({ params, searchParams }: PageProps<"/admin/roles/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [role, roles, counts, acting] = await Promise.all([repositories.staff.role(id), repositories.staff.roles(), repositories.staff.staffCounts(), getAdminRole()]);
  if (!role) notFound();
  return (
    <>
      <Link href="/admin/roles" className="text-sm text-muted hover:text-foreground">← All roles</Link>
      <PageHeader title={role.name} description={role.description} />
      <RoleEditor key={role.id} role={role} roles={roles.map((r) => ({ id: r.id, name: r.name }))} actingRole={{ id: acting?.id ?? "", name: acting?.name ?? "" }} staffCount={counts[role.id] ?? 0} created={sp.notice === "created"} />
      <div className="mt-6"><DemoEditingNotice /></div>
    </>
  );
}
