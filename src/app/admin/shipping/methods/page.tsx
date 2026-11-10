import type { Metadata } from "next";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { ShippingNav } from "@/components/admin/shipping/shipping-nav";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";
import Link from "next/link";
import { MethodToggle } from "@/components/admin/shipping/settings-forms";
import { Table } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { methodTypeLabel } from "@/lib/shipping/engine";
import type { ShippingMethod } from "@/lib/types";

export const metadata: Metadata = { title: "Shipping methods" };

export default async function Page() {
  const { items } = await repositories.shipping.listZones({ perPage: 200 });
  const rate = (m: ShippingMethod) => {
    switch (m.type) {
      case "flat_rate": return formatMoney(m.cost);
      case "local_pickup": return m.cost ? formatMoney(m.cost) : "No fee";
      case "free_shipping": return `Free from ${formatMoney(m.minSubtotal)}`;
      case "weight_tiers": return `${m.tiers.length} weight tiers`;
      case "subtotal_tiers": return `${m.tiers.length} order amount tiers`;
    }
  };
  return (
    <>
      <PageHeader title="Shipping" description="Every method across your zones. Edit rates in the zone." />
      <ShippingNav current="methods" />
      <Table caption="Shipping methods">
        <thead><tr><th scope="col">Method</th><th scope="col">Type</th><th scope="col">Rate</th><th scope="col">Zone</th><th scope="col">Enabled</th></tr></thead>
        <tbody>
          {items.flatMap((z) => z.methods.map((m) => (
            <tr key={`${z.id}-${m.id}`}>
              <td className="font-medium">{m.name}</td>
              <td className="whitespace-nowrap">{methodTypeLabel[m.type]}</td>
              <td className="whitespace-nowrap">{rate(m)}</td>
              <td><Link href={`/admin/shipping/${z.id}`} className="text-brand hover:underline">{z.name}</Link></td>
              <td><MethodToggle zoneId={z.id} methodId={m.id} name={m.name} enabled={m.enabled} /></td>
            </tr>
          )))}
        </tbody>
      </Table>
      <div className="mt-6"><DemoEditingNotice /></div>
    </>
  );
}
