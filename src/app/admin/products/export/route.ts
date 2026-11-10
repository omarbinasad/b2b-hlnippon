import { getCapabilities } from "@/lib/auth/session";
import { allPages } from "@/lib/data/all-pages";
import { repositories } from "@/lib/data";
import { productStatuses, stockStatuses } from "@/lib/enums";
import { toCsv } from "@/lib/reports/aggregate";

const oneOf = <T extends string>(v: string | null, allowed: readonly T[]) => (allowed.includes(v as T) ? (v as T) : undefined);

/** DEMO CSV of the product list, with the list's filters. Mock permission; the backend must authorize and generate real exports. */
export async function GET(request: Request) {
  if (!(await getCapabilities()).includes("products.export")) return new Response("Your role can't export products.", { status: 403 });
  const sp = new URL(request.url).searchParams;
  const rows = await allPages((page, perPage) =>
    repositories.products.adminList({
      search: sp.get("q") ?? undefined,
      categorySlug: sp.get("category") ?? undefined,
      type: oneOf(sp.get("type"), ["simple", "variable"] as const),
      stockStatus: oneOf(sp.get("stock"), stockStatuses),
      status: oneOf(sp.get("status"), productStatuses),
      pricing: oneOf(sp.get("pricing"), ["missing", "set"] as const),
      page,
      perPage,
    }),
  );
  const csv = toCsv(
    ["Name", "SKU", "Type", "Status", "Categories", "Lowest price", "Highest price", "Stock status", "Stock"],
    rows.map((p) => [p.name, p.sku, p.type, p.status, p.categoryNames.join("; "), p.price?.min, p.price?.max, p.stock.status, p.stock.quantity]),
  );
  return new Response(`﻿${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="products.csv"', "Cache-Control": "private, no-store" } });
}
