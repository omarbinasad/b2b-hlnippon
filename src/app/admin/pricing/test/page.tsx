import type { Metadata, Route } from "next";
import Link from "next/link";
import { PricePrecedence, QuantityPrecedence } from "@/components/admin/pricing/precedence";
import { RuleTester } from "@/components/admin/pricing/rule-tester";
import { RulesNav } from "@/components/admin/pricing/rules-nav";
import { AccountStatusBadge, Badge, type Tone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";
import { formatMoney } from "@/lib/format";
import { param } from "@/lib/list-params";
import { adjustmentLabel, audienceLabel, targetLevelLabel, tierLabel, type CandidateOutcome } from "@/lib/pricing/engine";

export const metadata: Metadata = { title: "Test rules" };

const outcomeTone: Record<CandidateOutcome, Tone> = { winner: "success", outranked: "neutral", skipped: "warning" };
const outcomeText: Record<CandidateOutcome, string> = { winner: "Applied", outranked: "Outranked", skipped: "Not eligible" };

const sourceText = { rule: "B2B rule price", sale: "Sale price", regular: "Regular price (no rule, no sale)" } as const;

const href = (q: Record<string, string | undefined>) =>
  `/admin/pricing/test?${new URLSearchParams(Object.entries(q).filter((e): e is [string, string] => Boolean(e[1])))}` as Route;

export default async function TestRulesPage({ searchParams }: PageProps<"/admin/pricing/test">) {
  const sp = await searchParams;
  const productId = param(sp, "product");
  const customerId = param(sp, "customer");
  const variationId = param(sp, "variation");
  const quantity = Math.max(1, Math.min(100_000, Math.trunc(Number(param(sp, "qty") ?? 1)) || 1));

  const [result, option, customer, restaurants] = await Promise.all([
    productId ? repositories.pricing.testRules({ customerId, productId, variationId, quantity }) : Promise.resolve(null),
    productId ? repositories.pricing.productOption(productId) : Promise.resolve(null),
    customerId ? repositories.customers.getById(customerId) : Promise.resolve(null),
    repositories.customers.list({ groupId: "grp-restaurant", status: "approved", sort: "company", perPage: 5 }),
  ]);
  const restaurant = restaurants.items.find((c) => c.id !== "cus-001");

  const examples = [
    restaurant && { label: `Group price: ${restaurant.companyName} (Restaurants) · basmati 5 kg × 1`, q: { customer: restaurant.id, product: "p-001", variation: "p-001-5", qty: "1" } },
    restaurant && { label: `Group bulk tier: same customer · basmati 5 kg × 10`, q: { customer: restaurant.id, product: "p-001", variation: "p-001-5", qty: "10" } },
    { label: "Customer override: Sample Kitchen Shinjuku · basmati 20 kg × 10", q: { customer: "cus-001", product: "p-001", variation: "p-001-20", qty: "10" } },
    { label: "Sale lower than rule: Example Mart Agrabad · mango juice × 12 (bulk tiers + conflict)", q: { customer: "cus-002", product: "p-013", qty: "12" } },
    { label: "No rule → sale price: Example Mart Agrabad · mango juice × 1", q: { customer: "cus-002", product: "p-013", qty: "1" } },
    { label: "No rule → sale price: Example Mart Agrabad · basmati 20 kg × 1", q: { customer: "cus-002", product: "p-001", variation: "p-001-20", qty: "1" } },
    restaurant && { label: "Percentage rule uses the regular price, not the sale: " + restaurant.companyName + " · basmati 20 kg × 1", q: { customer: restaurant.id, product: "p-001", variation: "p-001-20", qty: "1" } },
    { label: "Higher tier: Example Mart Agrabad · mango juice × 25", q: { customer: "cus-002", product: "p-013", qty: "25" } },
    { label: "Quantity limit: ground cumin × 1 (minimum 2)", q: { customer: "cus-001", product: "p-011", qty: "1" } },
    { label: "Variation max: Sample Kitchen · basmati 20 kg × 25", q: { customer: "cus-001", product: "p-001", variation: "p-001-20", qty: "25" } },
    { label: "Not approved: Demo Kebab Corner (pending) · basmati 5 kg × 10", q: { customer: "cus-003", product: "p-001", variation: "p-001-5", qty: "10" } },
  ].filter((e): e is NonNullable<typeof e> => Boolean(e));

  const price = result?.price;

  return (
    <>
      <PageHeader title="Pricing & quantity rules" description="B2B prices for customers and groups, bulk tiers, and per-line quantity limits." />
      <RulesNav current="test" />
      <Notice tone="warning" title="Demo calculation">
        This panel runs the frontend&apos;s reference rule engine on demo data. Percentage and amount-off rules use the regular price; a fixed rule uses its own amount. The customer pays the lower of the rule price and the active sale price — compared, never combined. The future backend must calculate and enforce prices and quantity limits at cart and
        checkout; nothing here is charged or saved.
      </Notice>

      <div className="mt-6 grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card title="Test a line">
            <RuleTester
              key={`${customerId}-${productId}-${variationId}-${quantity}`}
              initialCustomer={customer ? { id: customer.id, companyName: customer.companyName, status: customer.status } : undefined}
              initialProduct={option}
              initialVariationId={variationId}
              initialQuantity={quantity}
            />
          </Card>
          <Card title="Examples">
            <ul className="space-y-2 text-sm">
              {examples.map((e) => (
                <li key={e.label}>
                  <Link href={href(e.q)} className="text-brand hover:underline">{e.label}</Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          {!result ? (
            <EmptyState title={productId ? "Product or variation not found" : "Choose a product to test"} description="Or open one of the examples." />
          ) : (
            <>
              <Card title="Result">
                <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                  {result.customer ? (
                    <>
                      <span className="font-medium">{result.customer.companyName}</span>
                      <AccountStatusBadge status={result.customer.status} />
                      <span className="text-muted">{result.customer.groupName ? `Group: ${result.customer.groupName}` : "No group"}</span>
                    </>
                  ) : (
                    <span className="text-muted">No customer — quantity limits only</span>
                  )}
                  <span aria-hidden className="text-muted">·</span>
                  <span>
                    {result.product.name}
                    {result.product.variationLabel && ` — ${result.product.variationLabel}`} × {quantity}
                  </span>
                </div>
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["Regular price", price ? formatMoney(price.basePrice) : "—"],
                    ["Active sale price", price?.salePrice !== undefined ? formatMoney(price.salePrice) : price ? "None" : "—"],
                    ["Winning rule", price?.rule ? price.rule.name : price ? "None" : "—"],
                    ["Rule price", price?.rulePrice !== undefined ? formatMoney(price.rulePrice) : "—"],
                    [
                      "Price that won",
                      price
                        ? price.priceSource === "sale" && price.rulePrice !== undefined
                          ? "Sale price (lower than the rule price)"
                          : price.priceSource === "sale"
                            ? "Sale price (no rule applies)"
                            : price.priceSource === "rule" && price.salePrice !== undefined
                              ? "B2B rule price (not above the sale price)"
                              : sourceText[price.priceSource]
                        : "—",
                    ],
                    ["Tier", price?.tier ? `${tierLabel(price.tier)} · ${adjustmentLabel(price.tier.adjustment, formatMoney)}` : "—"],
                    ["Unit price", price ? formatMoney(price.unitPrice) : "—"],
                    ["Line total", price ? formatMoney(price.lineTotal) : "—"],
                    ["Quantity limits", `min ${result.limits.min}${result.limits.max !== undefined ? ` · max ${result.limits.max}` : " · no max"} per line`],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-ui border border-line p-3">
                      <dt className="text-xs text-muted">{k}</dt>
                      <dd className="mt-1 font-semibold tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
                {result.quantityError && (
                  <p role="alert" className="mt-3 rounded-ui bg-danger-soft px-3 py-2 text-sm text-danger">
                    Quantity {quantity} is not allowed: {result.quantityError}
                  </p>
                )}
                {price && <p className="mt-4 text-sm"><strong>Why:</strong> {price.explanation}</p>}
                <p className="mt-2 text-sm"><strong>Quantity:</strong> {result.limits.explanation}</p>
              </Card>

              {price && (
                <Card title="Price rules considered" description="Rules whose customers and products match this line, winner first.">
                  {price.candidates.length ? (
                    <Table caption="Price rules considered" density="compact">
                      <thead>
                        <tr>
                          <th scope="col">Rule</th>
                          <th scope="col">Level</th>
                          <th scope="col" className="text-right">Priority</th>
                          <th scope="col" className="text-right">Would give</th>
                          <th scope="col">Outcome</th>
                        </tr>
                      </thead>
                      <tbody>
                        {price.candidates.map((c) => (
                          <tr key={c.rule.id}>
                            <td className="min-w-48">
                              <Link href={`/admin/pricing/${c.rule.id}`} className="font-medium text-brand hover:underline">{c.rule.name}</Link>
                              <span className="block text-xs text-muted">{c.reason}</span>
                            </td>
                            <td className="text-xs whitespace-nowrap">{audienceLabel[c.rule.audience.type]}<span className="block text-muted">{targetLevelLabel[c.rule.target.type]}</span></td>
                            <td className="text-right tabular-nums">{c.rule.priority}</td>
                            <td className="text-right whitespace-nowrap tabular-nums">{c.unitPrice !== undefined ? formatMoney(c.unitPrice) : "—"}</td>
                            <td><Badge tone={outcomeTone[c.outcome]}>{outcomeText[c.outcome]}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted">No price rule targets this customer and product.</p>
                  )}
                </Card>
              )}

              <Card title="Quantity rules considered">
                {result.limits.candidates.length ? (
                  <ul className="space-y-2 text-sm">
                    {result.limits.candidates.map((c) => (
                      <li key={c.rule.id} className="flex flex-wrap items-start gap-2">
                        <Badge tone={outcomeTone[c.outcome]}>{outcomeText[c.outcome]}</Badge>
                        <span>
                          <Link href={`/admin/pricing/quantity/${c.rule.id}`} className="font-medium text-brand hover:underline">{c.rule.name}</Link>{" "}
                          <span className="text-muted">
                            ({targetLevelLabel[c.rule.target.type]}: min {c.rule.minQuantity ?? "—"}, max {c.rule.maxQuantity ?? "—"}) — {c.reason}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">No quantity rule matches this product.</p>
                )}
              </Card>
            </>
          )}
          <PricePrecedence />
          <QuantityPrecedence />
        </div>
      </div>
    </>
  );
}
