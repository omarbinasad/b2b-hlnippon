import type { Metadata } from "next";
import Link from "next/link";
import { ActionNotice, DemoEditingNotice, MockPermissionNote } from "@/components/admin/demo-notice";
import { ShippingNav, ShippingRules } from "@/components/admin/shipping/shipping-nav";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { ListToolbar, SortHeader } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";
import type { ZoneSortField } from "@/lib/data/repositories";
import { formatMoney } from "@/lib/format";
import { flatParams, listState } from "@/lib/list-params";
import { methodTypeLabel } from "@/lib/shipping/engine";
import type { ShippingMethod } from "@/lib/types";

export const metadata: Metadata = { title: "Shipping zones" };

const PATH = "/admin/shipping";
const SORTS = ["match", "name"] as const satisfies readonly ZoneSortField[];

function methodSummary(m: ShippingMethod) {
  switch (m.type) {
    case "flat_rate":
      return formatMoney(m.cost);
    case "local_pickup":
      return m.cost ? formatMoney(m.cost) : "Free";
    case "free_shipping":
      return `from ${formatMoney(m.minSubtotal)}`;
    case "weight_tiers":
      return `${m.tiers.length} weight tiers`;
    case "subtotal_tiers":
      return `${m.tiers.length} subtotal tiers`;
  }
}

export default async function ShippingZonesPage({ searchParams }: PageProps<"/admin/shipping">) {
  const sp = await searchParams;
  const state = listState(sp, SORTS, "match");
  const zones = await repositories.shipping.listZones({ ...state, perPage: 20 });
  const { notice, ...params } = flatParams(sp);
  const sorting = { sort: state.sort, dir: state.dir, pathname: PATH, params };

  return (
    <>
      <PageHeader
        title="Shipping"
        description="Zones by prefecture, city or postcode, and the delivery rates for each."
        actions={
          <ButtonLink href="/admin/shipping/new">
            <Icon name="plus" className="size-4" /> New zone
          </ButtonLink>
        }
      />
      <ShippingNav current="zones" />
      <ActionNotice notice={notice} />
      <div className="mb-4 space-y-3">
        <Notice tone="warning" title="Sample rates">
          All charges here are demo values, not courier prices. The backend must repeat these calculations at cart, checkout and order creation.
        </Notice>
        <ShippingRules />
      </div>
      <ListToolbar
        pathname={PATH}
        params={params}
        searchLabel="Search zones"
        searchPlaceholder="Zone, location or method"
        total={zones.total}
        page={zones.page}
        perPage={zones.perPage}
      />
      <div className="space-y-6">
        {zones.items.length ? (
          <Table caption="Shipping zones">
            <thead>
              <tr>
                <SortHeader label="Zone (matching order)" field="match" {...sorting} />
                <th scope="col">Covers</th>
                <th scope="col">Methods</th>
              </tr>
            </thead>
            <tbody>
              {zones.items.map((z) => (
                <tr key={z.id}>
                  <td className="min-w-44">
                    <Link href={`/admin/shipping/${z.id}`} className="font-medium text-brand hover:underline">{z.name}</Link>
                    {z.isFallback && (
                      <span className="ml-2 align-middle">
                        <Badge tone="info">Fallback</Badge>
                      </span>
                    )}
                    <span className="block text-xs text-muted">{z.id}{z.legacyWooId && ` · legacy #${z.legacyWooId}`}</span>
                  </td>
                  <td className="min-w-52 text-sm">{z.locationSummary}</td>
                  <td className="min-w-56">
                    {z.methods.length ? (
                      <ul className="space-y-0.5 text-sm">
                        {z.methods.map((m) => (
                          <li key={m.id} className={m.enabled ? undefined : "text-muted line-through"}>
                            {m.name} <span className="text-xs text-muted">· {methodTypeLabel[m.type]} · {methodSummary(m)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-sm text-muted">No methods — orders here need an agreed charge</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No zones match this search" action={<ButtonLink href={PATH} variant="secondary">Clear search</ButtonLink>} />
        )}
        <Pagination page={zones.page} totalPages={zones.totalPages} pathname={PATH} searchParams={params} />
        <MockPermissionNote permission="shipping.manage" />
        <DemoEditingNotice />
      </div>
    </>
  );
}
