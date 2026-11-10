import type { Metadata } from "next";
import Link from "next/link";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { AddStaffButton } from "@/components/admin/staff/staff-forms";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { ListToolbar } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { ALL_CAPABILITIES } from "@/lib/auth/capabilities";
import { repositories } from "@/lib/data";
import { flatParams, param } from "@/lib/list-params";

export const metadata: Metadata = { title: "Staff" };

const PATH = "/admin/staff";

export default async function StaffPage({ searchParams }: PageProps<"/admin/staff">) {
  const sp = await searchParams;
  const [result, roles] = await Promise.all([repositories.staff.staff({ search: param(sp, "q") || undefined, roleId: param(sp, "role") || undefined, page: Number(param(sp, "page")) || 1, perPage: 25 }), repositories.staff.roles()]);
  const params = flatParams(sp);
  const roleOf = (id: string) => roles.find((r) => r.id === id);
  return (
    <>
      <PageHeader title="Staff" description="Who works in the admin, and which role each person has. Choose someone to change their role or see what they can do." actions={<AddStaffButton roles={roles} />} />
      <ListToolbar pathname={PATH} params={params} searchLabel="Search staff" searchPlaceholder="Name or email" filters={[{ name: "role", label: "Role", options: roles.map((r) => ({ value: r.id, label: r.name })), allLabel: "All roles" }]} total={result.total} page={result.page} perPage={result.perPage} />
      <div className="space-y-6">
        {result.items.length ? (
          <Table caption="Staff">
            <thead><tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Permissions</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {result.items.map((s) => {
                const role = roleOf(s.roleId);
                return (
                  <tr key={s.id}>
                    <td className="min-w-56"><Link href={`/admin/staff/${s.id}`} className="font-medium text-brand hover:underline">{s.name}</Link><span className="block text-xs break-all text-muted">{s.email}</span></td>
                    <td className="whitespace-nowrap">{role?.name ?? "Role removed"}</td>
                    <td className="whitespace-nowrap tabular-nums">{role ? `${role.capabilities.length} of ${ALL_CAPABILITIES.length}` : "—"}</td>
                    <td><span className="flex flex-wrap gap-1"><Badge tone={s.active ? "success" : "neutral"}>{s.active ? "Active" : "Inactive"}</Badge>{s.invitedAt && <Badge tone="info">Invited</Badge>}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : <EmptyState title="No staff match" />}
        <Pagination page={result.page} totalPages={result.totalPages} pathname={PATH} searchParams={params} />
        <DemoEditingNotice />
      </div>
    </>
  );
}
