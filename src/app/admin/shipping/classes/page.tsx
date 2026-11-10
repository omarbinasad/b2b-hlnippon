import type { Metadata } from "next";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { ShippingNav } from "@/components/admin/shipping/shipping-nav";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";
import { ClassManager } from "@/components/admin/shipping/settings-forms";

export const metadata: Metadata = { title: "Shipping classes" };

export default async function Page() {
  const classes = await repositories.shipping.listClasses();
  return (
    <>
      <PageHeader title="Shipping" description="Groups of products that cost differently to ship, such as frozen or heavy." />
      <ShippingNav current="classes" />
      <ClassManager classes={classes} />
      <div className="mt-6"><DemoEditingNotice /></div>
    </>
  );
}
