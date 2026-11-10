import { getCapabilities } from "@/lib/auth/session";
import { siteConfig } from "@/config/site";
import { repositories } from "@/lib/data";
import { addDays, todayIn, validRange } from "@/lib/date-range";
import { toCsv, type ReportRow } from "@/lib/reports/aggregate";

const rows = (first: string, list: ReportRow[]) => toCsv([first, "Orders", "Units", "Net sales"], list.map((r) => [r.label, r.orders, r.units, r.sales]));

/** DEMO CSV of the sample figures. Mock permission; the backend must authorize and generate real exports. */
export async function GET(request: Request) {
  if (!(await getCapabilities()).includes("reports.export")) return new Response("Your role can't export reports.", { status: 403 });
  const url = new URL(request.url);
  const today = todayIn(siteConfig.timeZone);
  const range = validRange(url.searchParams.get("from"), url.searchParams.get("to"), today) ?? { from: addDays(today, -29), to: today };
  const data = await repositories.analytics.report(range);
  const kind = url.searchParams.get("kind") ?? "summary";
  let csv: string;
  switch (kind) {
    case "monthly": csv = rows("Month", data.monthly); break;
    case "products": csv = rows("Product", data.topProducts); break;
    case "categories": csv = rows("Category", data.categories); break;
    case "customers": csv = rows("Customer", data.topCustomers); break;
    case "groups": csv = rows("Group", data.groups); break;
    case "locations": csv = rows("Location", data.locations); break;
    case "statuses": csv = toCsv(["Status", "Orders"], data.statuses.map((s) => [s.status, s.count])); break;
    default: csv = toCsv(["Metric", "Value"], Object.entries(data.summary));
  }
  const safeKind = kind.replace(/[^a-z]/g, "") || "summary";
  // A byte order mark so spreadsheet programs read non-English names correctly.
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report-${safeKind}-${range.from}-to-${range.to}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
