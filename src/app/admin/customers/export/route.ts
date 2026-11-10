import { getCapabilities } from "@/lib/auth/session";
import { allPages } from "@/lib/data/all-pages";
import { repositories } from "@/lib/data";
import { accountStatuses } from "@/lib/enums";
import { accountStatusLabels } from "@/lib/customers/status";
import { toCsv } from "@/lib/reports/aggregate";
import type { AccountStatus } from "@/lib/types";

/** DEMO CSV of the customers list, with the list's filters. Personal data: the backend must authorize and log real exports. */
export async function GET(request: Request) {
  if (!(await getCapabilities()).includes("customers.export")) return new Response("Your role can't export customers.", { status: 403 });
  const sp = new URL(request.url).searchParams;
  const status = sp.get("status");
  const orders = sp.get("orders");
  const rows = await allPages((page, perPage) =>
    repositories.customers.list({
      search: sp.get("q") ?? undefined,
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
      status: accountStatuses.includes(status as AccountStatus) ? (status as AccountStatus) : undefined,
      groupId: sp.get("group") ?? undefined,
      prefecture: sp.get("prefecture") ?? undefined,
      hasOrders: orders === "yes" ? true : orders === "none" ? false : undefined,
      page,
      perPage,
    }),
  );
  const csv = toCsv(
    ["Company", "Contact", "Email", "Phone", "Status", "Group", "Orders", "Total spend"],
    rows.map((c) => [c.companyName, c.contactName, c.email, c.phone, accountStatusLabels[c.status], c.groupName, c.orderCount, c.totalSpend]),
  );
  return new Response(`﻿${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="customers.csv"', "Cache-Control": "private, no-store" } });
}
