import type { Metadata } from "next";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { ShippingNav } from "@/components/admin/shipping/shipping-nav";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";
import { GeneralShippingForm } from "@/components/admin/shipping/settings-forms";

export const metadata: Metadata = { title: "Shipping settings" };

export default async function Page() {
  const settings = await repositories.shipping.getGeneral();
  return (
    <>
      <PageHeader title="Shipping" description="Options that apply to every zone." />
      <ShippingNav current="settings" />
      <GeneralShippingForm settings={settings} />
      <div className="mt-6"><DemoEditingNotice /></div>
    </>
  );
}
