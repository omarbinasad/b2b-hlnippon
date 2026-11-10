import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { Notice } from "@/components/ui/feedback";
import { PreviewBanner, RolePreview } from "@/components/admin/staff/staff-forms";
import { ADMIN_ROLE_ID } from "@/lib/auth/capabilities";
import { getAdminRole, getViewer } from "@/lib/auth/session";
import { repositories } from "@/lib/data";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Renders per request. TODO: redirect non-admins once real auth exists (MOCK: no check).
  await getViewer();
  const [notifications, role, roles] = await Promise.all([repositories.adminNotifications.feed(), getAdminRole(), repositories.staff.roles()]);

  return (
    <AdminShell
      notifications={notifications}
      capabilities={role?.capabilities ?? []}
      roleName={role?.name ?? "current"}
      preview={<RolePreview roles={roles.map((r) => ({ id: r.id, name: r.name }))} current={role?.id ?? ""} />}
      banner={
        <div className="space-y-3">
        {role && role.id !== ADMIN_ROLE_ID && <PreviewBanner roleName={role.name} />}
        <Notice tone="warning">
          <strong>Preview mode:</strong> there is no sign-in or access control yet, and permissions are mocked. Edits to
          products, categories, orders, customers, customer groups, pricing/quantity rules, store settings, shipping zones, tax settings/rates and payment method settings are saved in this demo server&apos;s memory: they
          survive page refreshes but are lost when the server restarts, and on Vercel they may disappear or differ between requests. Roles here preview the interface; they are not security.
        </Notice>
        </div>
      }
    >
      {children}
    </AdminShell>
  );
}
