import type { Metadata } from "next";
import Link from "next/link";
import { ActionNotice, DemoEditingNotice, MockPermissionNote } from "@/components/admin/demo-notice";
import { PricePrecedence } from "@/components/admin/pricing/precedence";
import { RulesNav } from "@/components/admin/pricing/rules-nav";
import { Badge, type Tone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { ListToolbar, SortHeader } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";
import type { PriceRuleListItem, PriceRuleSortField } from "@/lib/data/repositories";
import { formatDate, formatMoney } from "@/lib/format";
import { flatParams, listHref, listState, oneOf, param } from "@/lib/list-params";
import { adjustmentLabel, tierLabel } from "@/lib/pricing/engine";
import { togglePriceRuleAction } from "./actions";

export const metadata: Metadata = { title: "Pricing rules" };

const PATH = "/admin/pricing";
const SORTS = ["audience", "name", "target", "priority", "updated"] as const satisfies readonly PriceRuleSortField[];

const audienceTone: Record<PriceRuleListItem["audience"]["type"], Tone> = { customer: "brand", group: "info", all: "neutral" };
const audienceText = { customer: "Customer", group: "Group", all: "All customers" } as const;
const targetText = { all: "All products", categories: "Category", products: "Product", variations: "Variation" } as const;

function Tiers({ rule }: { rule: PriceRuleListItem }) {
  const plain = rule.tiers.length === 1 && rule.tiers[0].minQuantity === 1 && rule.tiers[0].maxQuantity === undefined;
  if (plain) return <span className="whitespace-nowrap">{adjustmentLabel(rule.tiers[0].adjustment, formatMoney)}</span>;
  return (
    <ul className="space-y-0.5 text-xs">
      {rule.tiers.map((t) => (
        <li key={t.minQuantity} className="whitespace-nowrap">
          <span className="text-muted">Qty {tierLabel(t)}:</span> {adjustmentLabel(t.adjustment, formatMoney)}
        </li>
      ))}
    </ul>
  );
}

export default async function PricingRulesPage({ searchParams }: PageProps<"/admin/pricing">) {
  const sp = await searchParams;
  const state = listState(sp, SORTS, "audience");
  const rules = await repositories.pricing.listRules({
    ...state,
    audienceType: oneOf(param(sp, "audience"), ["customer", "group", "all"] as const),
    targetType: oneOf(param(sp, "target"), ["all", "categories", "products", "variations"] as const),
    status: oneOf(param(sp, "status"), ["active", "disabled"] as const),
    withConflicts: param(sp, "conflicts") === "yes" || undefined,
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
          <ButtonLink href="/admin/pricing/new">
            <Icon name="plus" className="size-4" /> New pricing rule
          </ButtonLink>
        }
      />
      <RulesNav current="price" />
      <ActionNotice notice={notice} />
      <div className="mb-4">
        <PricePrecedence />
      </div>
      <ListToolbar
        pathname={PATH}
        params={params}
        searchLabel="Search rules"
        searchPlaceholder="Rule, customer, group, product or category"
        filters={[
          { name: "audience", label: "Customers", options: [{ value: "customer", label: "One customer" }, { value: "group", label: "Group" }, { value: "all", label: "All customers" }], allLabel: "Any" },
          { name: "target", label: "Products", options: [{ value: "variations", label: "Variations" }, { value: "products", label: "Products" }, { value: "categories", label: "Categories" }, { value: "all", label: "All products" }], allLabel: "Any" },
          { name: "status", label: "Status", options: [{ value: "active", label: "Enabled" }, { value: "disabled", label: "Disabled" }], allLabel: "Any" },
          { name: "conflicts", label: "Overlaps", options: [{ value: "yes", label: "Overlapping only" }], allLabel: "All rules" },
        ]}
        total={rules.total}
        page={rules.page}
        perPage={rules.perPage}
      />
      <div className="space-y-6">
        {rules.items.length ? (
          <Table caption="Pricing rules">
            <thead>
              <tr>
                <SortHeader label="Rule" field="name" {...sorting} />
                <SortHeader label="Customers" field="audience" defaultDir="desc" {...sorting} />
                <SortHeader label="Products" field="target" defaultDir="desc" {...sorting} />
                <th scope="col">Price</th>
                <SortHeader label="Priority" field="priority" defaultDir="desc" className="text-right" {...sorting} />
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rules.items.map((r) => (
                <tr key={r.id}>
                  <td className="min-w-52">
                    <Link href={`/admin/pricing/${r.id}`} className="font-medium text-brand hover:underline">{r.name}</Link>
                    <span className="block text-xs text-muted">
                      {r.id}
                      {r.legacyWooId && ` · legacy #${r.legacyWooId}`}
                      {(r.validFrom || r.validTo) && ` · ${r.validFrom ? formatDate(r.validFrom) : "now"} – ${r.validTo ? formatDate(r.validTo) : "no end"}`}
                    </span>
                    {r.conflicts.length > 0 && (
                      <span className="mt-1 block text-xs">
                        <Badge tone={r.conflicts.some((c) => c.kind === "conflict") ? "warning" : "info"}>
                          {r.conflicts.some((c) => c.kind === "conflict") ? "Conflict" : "Overlap"}
                        </Badge>{" "}
                        <span className="text-muted">with {r.conflicts.map((c) => c.otherName).join(", ")}</span>
                      </span>
                    )}
                  </td>
                  <td className="min-w-40">
                    <Badge tone={audienceTone[r.audience.type]}>{audienceText[r.audience.type]}</Badge>
                    <span className="mt-0.5 block text-sm">{r.audienceName}</span>
                  </td>
                  <td className="min-w-44">
                    <span className="text-xs text-muted">{targetText[r.target.type]}</span>
                    <span className="block text-sm">{r.targetName}</span>
                  </td>
                  <td className="tabular-nums"><Tiers rule={r} /></td>
                  <td className="text-right tabular-nums">{r.priority}</td>
                  <td><Badge tone={r.status === "active" ? "success" : "neutral"}>{r.status === "active" ? "Enabled" : "Disabled"}</Badge></td>
                  <td>
                    <form action={togglePriceRuleAction}>
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
          <EmptyState title="No pricing rules match these filters" action={<ButtonLink href={PATH} variant="secondary">Clear filters</ButtonLink>} />
        )}
        <Pagination page={rules.page} totalPages={rules.totalPages} pathname={PATH} searchParams={params} />
        <p className="text-xs text-muted">
          Default order follows precedence (customer → group → all; then target and priority). Overlap = another enabled rule for the same customers, products, dates
          and quantities, decided by priority; conflict = same priority, decided by age.
        </p>
        <MockPermissionNote permission="pricing.manage" />
        <DemoEditingNotice />
      </div>
    </>
  );
}
