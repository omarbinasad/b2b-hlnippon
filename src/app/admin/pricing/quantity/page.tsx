import type { Metadata } from "next";
import Link from "next/link";
import { ActionNotice, DemoEditingNotice, MockPermissionNote } from "@/components/admin/demo-notice";
import { QuantityPrecedence } from "@/components/admin/pricing/precedence";
import { RulesNav } from "@/components/admin/pricing/rules-nav";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { ListToolbar, SortHeader } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";
import type { QuantityRuleSortField } from "@/lib/data/repositories";
import { flatParams, listHref, listState, oneOf, param } from "@/lib/list-params";
import { toggleQuantityRuleAction } from "../actions";

export const metadata: Metadata = { title: "Quantity rules" };

const PATH = "/admin/pricing/quantity";
const SORTS = ["target", "name", "priority", "updated"] as const satisfies readonly QuantityRuleSortField[];
const targetText = { all: "All products", categories: "Category", products: "Product", variations: "Variation" } as const;

export default async function QuantityRulesPage({ searchParams }: PageProps<"/admin/pricing/quantity">) {
  const sp = await searchParams;
  const state = listState(sp, SORTS, "target");
  const rules = await repositories.quantityRules.list({
    ...state,
    targetType: oneOf(param(sp, "target"), ["all", "categories", "products", "variations"] as const),
    status: oneOf(param(sp, "status"), ["active", "disabled"] as const),
    perPage: 20,
  });
  const { notice, ...params } = flatParams(sp);
  const sorting = { sort: state.sort, dir: state.dir, pathname: PATH, params };
  const returnTo = listHref(PATH, params, {});

  return (
    <>
      <PageHeader
        title="Pricing & quantity rules"
        description="B2B prices for customers and groups, bulk tiers, and per-line quantity limits."
        actions={
          <ButtonLink href="/admin/pricing/quantity/new">
            <Icon name="plus" className="size-4" /> New quantity rule
          </ButtonLink>
        }
      />
      <RulesNav current="quantity" />
      <ActionNotice notice={notice} />
      <div className="mb-4 space-y-3">
        <Notice tone="info" title="Limits are per order line">
          A rule on a category applies to each matching product line separately. “Max 10” on Spices allows 10 cumin and 10 garam masala in the same order — it never
          limits the combined category quantity.
        </Notice>
        <QuantityPrecedence />
      </div>
      <ListToolbar
        pathname={PATH}
        params={params}
        searchLabel="Search quantity rules"
        searchPlaceholder="Rule, product or category"
        filters={[
          { name: "target", label: "Products", options: [{ value: "variations", label: "Variations" }, { value: "products", label: "Products" }, { value: "categories", label: "Categories" }, { value: "all", label: "All products" }], allLabel: "Any" },
          { name: "status", label: "Status", options: [{ value: "active", label: "Enabled" }, { value: "disabled", label: "Disabled" }], allLabel: "Any" },
        ]}
        total={rules.total}
        page={rules.page}
        perPage={rules.perPage}
      />
      <div className="space-y-6">
        {rules.items.length ? (
          <Table caption="Quantity rules">
            <thead>
              <tr>
                <SortHeader label="Rule" field="name" {...sorting} />
                <SortHeader label="Products" field="target" defaultDir="desc" {...sorting} />
                <th scope="col" className="text-right">Min / line</th>
                <th scope="col" className="text-right">Max / line</th>
                <SortHeader label="Priority" field="priority" defaultDir="desc" className="text-right" {...sorting} />
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rules.items.map((r) => (
                <tr key={r.id}>
                  <td className="min-w-48">
                    <Link href={`/admin/pricing/quantity/${r.id}`} className="font-medium text-brand hover:underline">{r.name}</Link>
                    <span className="block text-xs text-muted">{r.id}{r.legacyWooId && ` · legacy #${r.legacyWooId}`}</span>
                    {r.conflicts.length > 0 && (
                      <span className="mt-1 block text-xs">
                        <Badge tone={r.conflicts.some((c) => c.kind === "conflict") ? "warning" : "info"}>{r.conflicts.some((c) => c.kind === "conflict") ? "Conflict" : "Overlap"}</Badge>{" "}
                        <span className="text-muted">with {r.conflicts.map((c) => c.otherName).join(", ")}</span>
                      </span>
                    )}
                  </td>
                  <td className="min-w-44">
                    <span className="text-xs text-muted">{targetText[r.target.type]}</span>
                    <span className="block text-sm">{r.targetName}</span>
                  </td>
                  <td className="text-right tabular-nums">{r.minQuantity ?? <span className="text-muted">1</span>}</td>
                  <td className="text-right tabular-nums">{r.maxQuantity ?? <span className="text-muted">—</span>}</td>
                  <td className="text-right tabular-nums">{r.priority}</td>
                  <td><Badge tone={r.status === "active" ? "success" : "neutral"}>{r.status === "active" ? "Enabled" : "Disabled"}</Badge></td>
                  <td>
                    <form action={toggleQuantityRuleAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value={r.status === "active" ? "disabled" : "active"} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <button type="submit" className="rounded-ui border border-line px-2 py-1 text-xs font-medium whitespace-nowrap hover:bg-surface-muted" aria-label={`${r.status === "active" ? "Disable" : "Enable"} ${r.name}`}>
                        {r.status === "active" ? "Disable" : "Enable"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No quantity rules match these filters" action={<ButtonLink href={PATH} variant="secondary">Clear filters</ButtonLink>} />
        )}
        <Pagination page={rules.page} totalPages={rules.totalPages} pathname={PATH} searchParams={params} />
        <p className="text-sm">
          To see the effective limit for one product or variation, use{" "}
          <Link href="/admin/pricing/test" className="font-medium text-brand hover:underline">Test rules</Link>.
        </p>
        <MockPermissionNote permission="pricing.manage" />
        <DemoEditingNotice />
      </div>
    </>
  );
}
