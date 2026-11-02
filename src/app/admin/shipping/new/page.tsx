import type { Metadata } from "next";
import Link from "next/link";
import { DemoEditingNotice, MockPermissionNote } from "@/components/admin/demo-notice";
import { ShippingRules } from "@/components/admin/shipping/shipping-nav";
import { ZoneForm } from "@/components/admin/shipping/zone-form";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "New shipping zone" };

export default async function NewZonePage() {
  const [zones, classes] = await Promise.all([repositories.shipping.listZones({ perPage: 200 }), repositories.catalogSettings.shippingClasses()]);
  return (
    <>
      <Link href="/admin/shipping" className="text-sm text-muted hover:text-foreground">← Shipping zones</Link>
      <PageHeader title="New shipping zone" description="Choose the locations it covers and its delivery methods. Rates are demo values." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <ZoneForm others={zones.items} classes={classes} />
        <aside className="space-y-4">
          <ShippingRules open />
          <MockPermissionNote permission="shipping.manage" />
          <DemoEditingNotice />
        </aside>
      </div>
    </>
  );
}
