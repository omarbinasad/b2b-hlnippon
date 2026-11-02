import type { Metadata } from "next";
import { OrderTable } from "@/components/order/order-table";
import { EmptyState } from "@/components/ui/feedback";
import { ListToolbar } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { getPortalCustomerId } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import type { OrderSortField } from "@/lib/data/repositories";
import { orderStatuses, orderStatusOptions, paymentStatuses, paymentStatusOptions } from "@/lib/enums";
import { flatParams, listState, oneOf, param } from "@/lib/list-params";

export const metadata: Metadata = { title: "Orders" };

const PATH = "/account/orders";
const SORTS = ["placed", "number", "total", "status"] as const satisfies readonly OrderSortField[];

export default async function AccountOrdersPage({ searchParams }: PageProps<"/account/orders">) {
  const sp = await searchParams;
  const state = listState(sp, SORTS, "placed");
  const orders = await repositories.orders.list({
    ...state,
    // Always scoped to the signed-in customer (mock: the demo customer).
    customerId: await getPortalCustomerId(),
    status: oneOf(param(sp, "status"), orderStatuses),
    paymentStatus: oneOf(param(sp, "payment"), paymentStatuses),
  });
  const params = flatParams(sp);

  return (
    <>
      <PageHeader title="Orders" description="Order history, delivery status and invoices." />
      <ListToolbar
        pathname={PATH}
        params={params}
        searchLabel="Search orders"
        searchPlaceholder="Order number"
        filters={[
          { name: "status", label: "Status", options: orderStatusOptions, allLabel: "All statuses" },
          { name: "payment", label: "Payment", options: paymentStatusOptions, allLabel: "All payments" },
        ]}
        dates={{ fromLabel: "Placed from", toLabel: "Placed to" }}
        total={orders.total}
        page={orders.page}
        perPage={orders.perPage}
      />
      {orders.items.length ? (
        <OrderTable orders={orders.items} linkToDetail sorting={{ sort: state.sort, dir: state.dir, pathname: PATH, params }} />
      ) : (
        <EmptyState title="No orders found" description="Try a different search, status or date range." />
      )}
      <Pagination page={orders.page} totalPages={orders.totalPages} pathname={PATH} searchParams={params} />
    </>
  );
}
