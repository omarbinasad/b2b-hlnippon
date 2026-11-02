import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { Notice } from "@/components/ui/feedback";
import { getViewer } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Renders per request. TODO: redirect non-admins once real auth exists (MOCK: no check).
  await getViewer();

  return (
    <AdminShell
      banner={
        <Notice tone="warning">
          <strong>Preview mode:</strong> there is no sign-in or access control yet, and permissions are mocked. Edits to
          products, categories, orders, customers, customer groups, pricing/quantity rules, store settings, shipping zones, tax settings/rates and payment method settings are saved in this demo server&apos;s memory: they
          survive page refreshes but are lost when the server restarts, and on Vercel they may disappear or differ between requests. Other admin screens are read-only.
        </Notice>
      }
    >
      {children}
    </AdminShell>
  );
}
