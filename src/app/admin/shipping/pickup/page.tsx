import type { Metadata } from "next";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { ShippingNav } from "@/components/admin/shipping/shipping-nav";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";
import { PickupManager } from "@/components/admin/shipping/settings-forms";

export const metadata: Metadata = { title: "Pickup locations" };

export default async function Page() {
  const locations = await repositories.shipping.listPickups();
  return (
    <>
      <PageHeader title="Shipping" description="Places customers can collect orders from." />
      <ShippingNav current="pickup" />
      <PickupManager locations={locations} />
      <div className="mt-6"><DemoEditingNotice /></div>
    </>
  );
}
