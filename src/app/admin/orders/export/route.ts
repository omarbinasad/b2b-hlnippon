import { getCapabilities } from "@/lib/auth/session";
import { allPages } from "@/lib/data/all-pages";
import { repositories } from "@/lib/data";
import { orderStatuses, paymentStatuses } from "@/lib/enums";
import { orderStatusLabels, paymentStatusLabels } from "@/lib/orders/status";
import { toCsv } from "@/lib/reports/aggregate";

const oneOf = <T extends string>(v: string | null, allowed: readonly T[]) => (allowed.includes(v as T) ? (v as T) : undefined);

/** DEMO CSV of the orders list, with the list's filters. Mock permission; the backend must authorize and generate real exports. */
export async function GET(request: Request) {
  if (!(await getCapabilities()).includes("orders.export")) return new Response("Your role can't export orders.", { status: 403 });
  const sp = new URL(request.url).searchParams;
  const status = sp.get("status");
  const rows = await allPages((page, perPage) =>
    repositories.orders.list({
      search: sp.get("q") ?? undefined,
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
      status: oneOf(status, orderStatuses),
      excludeCancelled: status === "active" || undefined,
      open: status === "open" || undefined,
      paymentStatus: oneOf(sp.get("payment"), paymentStatuses),
      customerId: sp.get("customer") ?? undefined,
      deliveryRouteId: sp.get("route") ?? undefined,
      orderType: oneOf(sp.get("type"), ["first", "repeat", "walk_in"] as const),
      page,
      perPage,
    }),
  );
  const csv = toCsv(
    ["Order", "Placed", "Customer", "Status", "Payment", "Total"],
    rows.map((o) => [o.number, o.placedAt, o.customerName, orderStatusLabels[o.status], paymentStatusLabels[o.paymentStatus], o.totals.netTotal]),
  );
  // A byte order mark so spreadsheet programs read non-English names correctly.
  return new Response(`﻿${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="orders.csv"', "Cache-Control": "private, no-store" } });
}
