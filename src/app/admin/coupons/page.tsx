import { Can, WriteGuard } from "@/components/admin/capabilities-context";
import type { Metadata } from "next";
import Link from "next/link";
import { CouponToggle } from "@/components/admin/coupons/coupon-form";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { ListToolbar } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";
import { formatCalendarDate, formatMoney, formatNumber } from "@/lib/format";
import { flatParams, oneOf, param } from "@/lib/list-params";
import type { Coupon } from "@/lib/types";

export const metadata: Metadata = { title: "Coupons" };

const PATH = "/admin/coupons";
const worth = (c: Coupon) => (c.type === "percent" ? `${c.amount}% off` : c.type === "fixed_cart" ? `${formatMoney(c.amount)} off the cart` : `${formatMoney(c.amount)} off per unit`);

export default async function CouponsPage({ searchParams }: PageProps<"/admin/coupons">) {
  const sp = await searchParams;
  const result = await repositories.coupons.list({ search: param(sp, "q") || undefined, status: oneOf(param(sp, "status"), ["active", "disabled", "expired"] as const), page: Number(param(sp, "page")) || 1, perPage: 20 });
  const params = flatParams(sp);
  return (
    <>
      <PageHeader title="Coupons" description="Codes customers enter at the cart. Separate from discounts staff add to an order." actions={<Can cap="coupons.create"><ButtonLink href="/admin/coupons/new"><Icon name="plus" className="size-4" /> Add coupon</ButtonLink></Can>} />
      <ListToolbar pathname={PATH} params={params} searchLabel="Search coupons" searchPlaceholder="Code or description" filters={[{ name: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "disabled", label: "Disabled" }, { value: "expired", label: "Expired" }], allLabel: "All" }]} total={result.total} page={result.page} perPage={result.perPage} />
      <div className="space-y-6">
        {result.items.length ? (
          <Table caption="Coupons">
            <thead><tr><th scope="col">Code</th><th scope="col">Discount</th><th scope="col">Used</th><th scope="col">Expires</th><th scope="col">Enabled</th></tr></thead>
            <tbody>
              {result.items.map((c) => (
                <tr key={c.id}>
                  <td className="min-w-40"><Link href={`/admin/coupons/${c.id}`} className="font-medium text-brand hover:underline">{c.code}</Link>{c.description && <span className="block text-xs text-muted">{c.description}</span>}</td>
                  <td className="whitespace-nowrap">{worth(c)}</td>
                  <td className="tabular-nums">{formatNumber(c.usedCount)}{c.usageLimit !== undefined ? ` / ${formatNumber(c.usageLimit)}` : ""}</td>
                  <td className="whitespace-nowrap">{c.expiresOn ? formatCalendarDate(c.expiresOn) : <span className="text-muted">Never</span>}</td>
                  <td><WriteGuard cap="coupons.edit"><CouponToggle id={c.id} code={c.code} enabled={c.enabled} /></WriteGuard></td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <EmptyState title="No coupons found" action={<Can cap="coupons.create"><ButtonLink href="/admin/coupons/new">Add coupon</ButtonLink></Can>} />}
        <Pagination page={result.page} totalPages={result.totalPages} pathname={PATH} searchParams={params} />
        <DemoEditingNotice />
      </div>
    </>
  );
}
