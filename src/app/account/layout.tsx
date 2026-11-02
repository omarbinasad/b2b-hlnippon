import type { Metadata } from "next";
import { DemoViewSwitcher } from "@/components/layout/demo-view-switcher";
import { CartLink, NotificationLink } from "@/components/layout/header-icons";
import { PortalShell } from "@/components/layout/portal-shell";
import { Notice } from "@/components/ui/feedback";
import { accountNav } from "@/config/site";
import { getPortalCustomerId } from "@/lib/auth/session";
import { repositories } from "@/lib/data";

export const metadata: Metadata = {
  title: { default: "My account", template: "%s | My account" },
  robots: { index: false, follow: false },
};

export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  const customerId = await getPortalCustomerId();
  const customer = await repositories.customers.getById(customerId);

  return (
    <PortalShell
      area="Customer portal"
      home="/account"
      nav={accountNav}
      navLabel="Account"
      userLabel={customer?.companyName ?? "Customer"}
      headerActions={
        <>
          <NotificationLink customerId={customerId} />
          <CartLink />
        </>
      }
      banner={
        <Notice tone="warning" title="Preview mode">
          There is no sign-in yet. This portal shows sample data for a demo customer and is not access-controlled. Use “Demo view” (bottom left) to see ordering as a guest, an applicant or an approved customer.
        </Notice>
      }
    >
      {children}
      <DemoViewSwitcher />
    </PortalShell>
  );
}
