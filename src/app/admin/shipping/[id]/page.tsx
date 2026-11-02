import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoEditingNotice, MockPermissionNote } from "@/components/admin/demo-notice";
import { ShippingRules } from "@/components/admin/shipping/shipping-nav";
import { ZoneForm } from "@/components/admin/shipping/zone-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { deleteZoneAction } from "../actions";

export async function generateMetadata({ params }: PageProps<"/admin/shipping/[id]">): Promise<Metadata> {
  const zone = await repositories.shipping.getZone((await params).id);
  return { title: zone ? `Zone: ${zone.name}` : "Zone not found" };
}

export default async function EditZonePage({ params }: PageProps<"/admin/shipping/[id]">) {
  const { id } = await params;
  const [zone, zones, classes] = await Promise.all([
    repositories.shipping.getZone(id),
    repositories.shipping.listZones({ perPage: 200 }),
    repositories.catalogSettings.shippingClasses(),
  ]);
  if (!zone) notFound();

  return (
    <>
      <Link href="/admin/shipping" className="text-sm text-muted hover:text-foreground">← Shipping zones</Link>
      <PageHeader
        title={zone.name}
        description={`${zone.id}${zone.legacyWooId ? ` · legacy #${zone.legacyWooId}` : ""} · updated ${formatDateTime(zone.updatedAt)}`}
        actions={zone.isFallback ? <Badge tone="info">Fallback zone</Badge> : undefined}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <ZoneForm zone={zone} others={zones.items.filter((z) => z.id !== zone.id)} classes={classes} />
        <aside className="space-y-4">
          <p className="text-sm">
            Check the result for an address and cart in the{" "}
            <Link href="/admin/shipping/preview" className="font-medium text-brand hover:underline">rate preview</Link>.
          </p>
          <ShippingRules />
          {zone.isFallback ? (
            <p className="text-xs text-muted">The fallback zone can&apos;t be deleted — every address needs a zone.</p>
          ) : (
            <Card title="Delete zone">
              <form action={deleteZoneAction}>
                <input type="hidden" name="id" value={zone.id} />
                <ConfirmButton
                  title={`Delete “${zone.name}”?`}
                  message="Addresses it covers will match a broader zone or the fallback zone. Existing orders keep their saved shipping amount."
                  confirmLabel="Delete zone"
                  className="text-sm font-medium text-danger hover:underline"
                >
                  Delete this zone
                </ConfirmButton>
              </form>
            </Card>
          )}
          <MockPermissionNote permission="shipping.manage" />
          <DemoEditingNotice />
        </aside>
      </div>
    </>
  );
}
