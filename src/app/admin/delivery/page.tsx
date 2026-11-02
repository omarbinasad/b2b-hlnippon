import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { ShippingNav } from "@/components/admin/shipping/shipping-nav";
import { EmptyState, Notice, PlannedFeatures } from "@/components/ui/feedback";
import { ListToolbar, SortHeader } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";
import type { RouteSortField } from "@/lib/data/repositories";
import { activeOptions } from "@/lib/enums";
import { formatMoney, humanize } from "@/lib/format";
import { boolParam, flatParams, listState } from "@/lib/list-params";

export const metadata: Metadata = { title: "Delivery routes" };

const PATH = "/admin/delivery";
const SORTS = ["name", "fee", "cutoff"] as const satisfies readonly RouteSortField[];

export default async function DeliveryPage({ searchParams }: PageProps<"/admin/delivery">) {
  const sp = await searchParams;
  const state = listState(sp, SORTS, "name");
  const routes = await repositories.delivery.listRoutes({ ...state, active: boolParam(sp, "active"), perPage: 20 });
  const params = flatParams(sp);
  const sorting = { sort: state.sort, dir: state.dir, pathname: PATH, params };

  return (
    <>
      <PageHeader title="Shipping" description="Delivery routes: areas, delivery days and order cutoff times." />
      <ShippingNav current="routes" />
      <div className="mb-4">
        <Notice tone="info" title="Routes schedule deliveries; zones set the charge">
          Shipping charges for new orders come from shipping zones. The route fees below are legacy values kept for reference (they priced older demo orders)
          and are not used for new quotes.
        </Notice>
      </div>
      <ListToolbar
        pathname={PATH}
        params={params}
        searchLabel="Search routes"
        searchPlaceholder="Route name or area"
        filters={[{ name: "active", label: "Status", options: activeOptions, allLabel: "All routes" }]}
        total={routes.total}
        page={routes.page}
        perPage={routes.perPage}
      />
      <div className="space-y-6">
        {routes.items.length ? (
          <Table caption="Delivery routes">
            <thead>
              <tr>
                <SortHeader label="Route" field="name" {...sorting} />
                <th scope="col">Areas</th>
                <th scope="col">Days</th>
                <SortHeader label="Cutoff" field="cutoff" {...sorting} />
                <SortHeader label="Legacy fee" field="fee" className="text-right" {...sorting} />
              </tr>
            </thead>
            <tbody>
              {routes.items.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">
                    {r.name} {!r.active && <Badge>Inactive</Badge>}
                  </td>
                  <td>{r.areas.join(", ")}</td>
                  <td>{r.deliveryDays.map(humanize).join(", ")}</td>
                  <td className="tabular-nums">{r.cutoffTime}</td>
                  <td className="text-right tabular-nums">
                    {r.shippingFee === 0 ? "Free" : formatMoney(r.shippingFee)}
                    {r.freeShippingThreshold && (
                      <span className="block text-xs text-muted">free over {formatMoney(r.freeShippingThreshold)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No routes match these filters" />
        )}
        <Pagination page={routes.page} totalPages={routes.totalPages} pathname={PATH} searchParams={params} />
        <PlannedFeatures items={["Create and edit routes", "Holiday and closure calendar"]} />
      </div>
    </>
  );
}
