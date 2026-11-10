import type { Metadata } from "next";
import Link from "next/link";
import { Can } from "@/components/admin/capabilities-context";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { Table } from "@/components/ui/table";
import { ALL_CAPABILITIES, CUSTOMER_ROLE } from "@/lib/auth/capabilities";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Roles" };

export default async function RolesPage() {
  const [roles, counts] = await Promise.all([repositories.staff.roles(), repositories.staff.staffCounts()]);
  return (
    <>
      <PageHeader title="Roles" description="Choose a role to decide exactly what it can do. Assign roles to people under Staff." actions={<Can cap="roles.manage"><ButtonLink href="/admin/roles/new"><Icon name="plus" className="size-4" /> Add role</ButtonLink></Can>} />
      <div className="mb-4"><Notice tone="warning" title="Interface preview, not security">Permissions here change what the demo shows and accepts. The backend must check them on every protected action. Use &quot;Preview as&quot; at the top to try a role.</Notice></div>
      <Table caption="Roles">
        <thead><tr><th scope="col">Role</th><th scope="col">Permissions</th><th scope="col">Staff</th><th scope="col">Type</th></tr></thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id}>
              <td className="min-w-56"><Link href={`/admin/roles/${r.id}`} className="font-medium text-brand hover:underline">{r.name}</Link><span className="block text-xs text-muted">{r.description}</span></td>
              <td className="whitespace-nowrap tabular-nums">{r.capabilities.length} of {ALL_CAPABILITIES.length}</td>
              <td className="tabular-nums"><Link href={`/admin/staff?role=${r.id}`} className="hover:underline" aria-label={`${counts[r.id] ?? 0} staff with ${r.name}`}>{counts[r.id] ?? 0}</Link></td>
              <td><Badge tone={r.system ? "neutral" : "info"}>{r.system ? "Template" : "Custom"}</Badge></td>
            </tr>
          ))}
          <tr>
            <td className="min-w-56"><span className="font-medium">{CUSTOMER_ROLE.name}</span><span className="block text-xs text-muted">{CUSTOMER_ROLE.description}</span></td>
            <td>Portal only</td>
            <td className="text-muted">—</td>
            <td><Badge tone="neutral">Not staff</Badge></td>
          </tr>
        </tbody>
      </Table>
      <div className="mt-6"><DemoEditingNotice /></div>
    </>
  );
}
