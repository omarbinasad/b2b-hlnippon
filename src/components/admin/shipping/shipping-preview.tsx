"use client";

import { addressLabels, regionNames } from "@/lib/locations";
import { useState, useTransition } from "react";
import { getOrderCustomerAction } from "@/app/admin/orders/actions";
import { productOptionAction } from "@/app/admin/pricing/actions";
import { previewShippingAction } from "@/app/admin/shipping/actions";
import { CustomerPicker } from "@/components/admin/orders/customer-picker";
import { ProductSearch } from "@/components/admin/products/product-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { Table } from "@/components/ui/table";
import { cx } from "@/lib/cx";
import type { RuleProductOption, ShippingQuoteResult } from "@/lib/data/repositories";
import { formatMoney } from "@/lib/format";
import { RegionField } from "@/components/ui/region-field";
import { matchLevelLabel, methodTypeLabel } from "@/lib/shipping/engine";
import type { OrderCustomerContext, ShippingClass } from "@/lib/types";

interface CartLine {
  key: string;
  product: RuleProductOption;
  variationId: string;
  quantity: string;
}

export interface PreviewExample {
  label: string;
  address: { prefecture: string; city: string; postalCode: string };
  lines: { product: RuleProductOption; variationId?: string; quantity: number }[];
}

let seq = 0;
const kg = (grams: number) => `${(grams / 1000).toLocaleString("en-IN", { maximumFractionDigits: 3 })} kg`;
const priceSourceText = { given: "entered", rule: "B2B rule", sale: "sale price", regular: "regular price" } as const;

export function ShippingPreview({ classes, examples, groups }: { classes: ShippingClass[]; examples: PreviewExample[]; groups: { id: string; name: string }[] }) {
  const [customer, setCustomer] = useState<OrderCustomerContext | null>(null);
  const [address, setAddress] = useState({ prefecture: regionNames()[0] ?? "", city: "", postalCode: "" });
  const [lines, setLines] = useState<CartLine[]>([]);
  const [coupon, setCoupon] = useState("");
  const [groupId, setGroupId] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [subtotalOverride, setSubtotal] = useState("");
  const [result, setResult] = useState<ShippingQuoteResult | null>(null);
  const [pending, startTransition] = useTransition();
  const className = (id?: string) => (id ? (classes.find((c) => c.id === id)?.name ?? id) : "—");

  const calculate = (addr = address, cart = lines, customerId = customer?.id) =>
    startTransition(async () => {
      setResult(
        await previewShippingAction({
          address: addr,
          customerId,
          couponCode: coupon,
          customerGroupId: groupId,
          grams: weightKg === "" ? undefined : Number(weightKg) * 1000,
          subtotal: subtotalOverride === "" ? undefined : Number(subtotalOverride),
          items: cart.map((l) => ({ productId: l.product.productId, variationId: l.variationId || undefined, quantity: Number(l.quantity) })),
        }),
      );
    });

  const q = result?.quote;

  return (
    <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
      <div className="space-y-6">
        <Card title="Examples">
          <ul className="space-y-1.5 text-sm">
            {examples.map((e) => (
              <li key={e.label}>
                <button
                  type="button"
                  className="text-left text-brand hover:underline"
                  onClick={() => {
                    const cart = e.lines.map((l) => ({ key: `l${++seq}`, product: l.product, variationId: l.variationId ?? "", quantity: String(l.quantity) }));
                    setCustomer(null);
                    setAddress(e.address);
                    setLines(cart);
                    calculate(e.address, cart, undefined);
                  }}
                >
                  {e.label}
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Address">
          <div className="space-y-3">
            {customer ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-ui border border-line p-3 text-sm">
                  <span className="font-medium">{customer.companyName}</span>
                  <Button size="sm" variant="secondary" onClick={() => setCustomer(null)}>Change</Button>
                </div>
                {customer.addresses.length > 0 && (
                  <Field id="pv-saved" label="Saved address">
                    <Select
                      id="pv-saved"
                      defaultValue=""
                      onChange={(e) => {
                        const a = customer.addresses.find((x) => x.id === e.target.value);
                        if (a) setAddress({ prefecture: a.prefecture, city: a.city, postalCode: a.postalCode });
                      }}
                    >
                      <option value="" disabled>Choose…</option>
                      {customer.addresses.map((a) => <option key={a.id} value={a.id}>{a.label} — {a.city}, {a.postalCode}</option>)}
                    </Select>
                  </Field>
                )}
                <p className="text-xs text-muted">Item prices use this customer&apos;s B2B / sale prices.</p>
              </div>
            ) : (
              <CustomerPicker id="pv-customer" onPick={(id) => startTransition(async () => setCustomer(await getOrderCustomerAction(id)))} />
            )}
            <p className="text-xs text-muted">Or enter an address by hand — a postcode is optional.</p>
            <Field id="pv-prefecture" label={addressLabels().region}>
              <RegionField id="pv-prefecture" value={address.prefecture} onChange={(e) => setAddress({ ...address, prefecture: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="pv-city" label="City">
                <Input id="pv-city" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} placeholder="e.g. Gazipur" />
              </Field>
              <Field id="pv-postcode" label={addressLabels().postcode}>
                <Input id="pv-postcode" inputMode="numeric" maxLength={4} value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value.replace(/\D/g, "") })} />
              </Field>
            </div>
          </div>
        </Card>

        <Card title="Cart">
          <div className="space-y-3">
            {lines.map((l) => (
              <div key={l.key} className="space-y-2 rounded-ui border border-line p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{l.product.name}</p>
                  <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="text-muted hover:text-danger" aria-label={`Remove ${l.product.name}`}>
                    <Icon name="trash" className="size-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {l.product.variations.length > 0 && (
                    <Select aria-label={`${l.product.name} option`} value={l.variationId} onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, variationId: e.target.value } : x)))} className="w-44">
                      {l.product.variations.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                    </Select>
                  )}
                  <Input
                    aria-label={`${l.product.name} quantity`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={l.quantity}
                    onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, quantity: e.target.value } : x)))}
                    className="w-24"
                  />
                </div>
              </div>
            ))}
            <ProductSearch
              id="pv-product"
              label="Add product"
              excludeIds={[]}
              onPick={(p) =>
                startTransition(async () => {
                  const option = await productOptionAction(p.id);
                  if (option) setLines((ls) => [...ls, { key: `l${++seq}`, product: option, variationId: option.variations[0]?.id ?? "", quantity: "1" }]);
                })
              }
            />
            <div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
              <Field id="pv-group" label="Customer group">
                <Select id="pv-group" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                  <option value="">Any</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </Select>
              </Field>
              <Field id="pv-coupon" label="Coupon code"><Input id="pv-coupon" value={coupon} onChange={(e) => setCoupon(e.target.value)} /></Field>
              <Field id="pv-weight" label="Cart weight (kg)" hint="Optional: test without choosing products."><Input id="pv-weight" type="number" min={0} step="any" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} /></Field>
              <Field id="pv-subtotal" label="Subtotal" hint="Optional."><Input id="pv-subtotal" type="number" min={0} value={subtotalOverride} onChange={(e) => setSubtotal(e.target.value)} /></Field>
            </div>
            <Button onClick={() => calculate()} disabled={pending || (!lines.length && weightKg === "" && subtotalOverride === "")}>{pending ? "Calculating…" : "Calculate shipping"}</Button>
          </div>
        </Card>
      </div>

      <div className="min-w-0 space-y-6" aria-live="polite">
        {!q ? (
          <Card title="Result">
            <p className="text-sm text-muted">Choose an example, or enter an address and cart items, then calculate.</p>
          </Card>
        ) : (
          <>
            <Card title="Result">
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Matched zone", q.match.zone ? q.match.zone.name : "None"],
                  ["Matched by", q.match.level ? matchLevelLabel[q.match.level] : "—"],
                  ["Total weight", kg(q.metrics.totalGrams)],
                  ["Items subtotal", formatMoney(q.metrics.subtotal)],
                  ["Suggested method", q.selected ? q.selected.method.name : "None available"],
                  ["Shipping charge", q.selected ? formatMoney(q.selected.cost!) : "—"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-ui border border-line p-3">
                    <dt className="text-xs text-muted">{k}</dt>
                    <dd className="mt-1 font-semibold tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
              {q.charge && (
                <dl className="mt-4 space-y-1 rounded-ui border border-line p-3 text-sm [&>div]:flex [&>div]:justify-between [&>div]:gap-3" aria-label="How the charge was decided">
                  <div><dt>Base charge</dt><dd className="tabular-nums">{formatMoney(q.charge.base)}</dd></div>
                  {q.charge.surcharges.map((x) => <div key={x.label}><dt>{x.label}</dt><dd className="tabular-nums">+{formatMoney(x.amount)}</dd></div>)}
                  <div><dt>Free shipping</dt><dd>{q.charge.free ? "Yes" : "No"}</dd></div>
                  <div className="border-t border-line pt-1 font-semibold"><dt>Final charge</dt><dd className="tabular-nums">{formatMoney(q.charge.final)}</dd></div>
                </dl>
              )}
              {q.rulesApplied.length > 0 && <p className="mt-3 text-sm"><span className="font-medium">Rules applied:</span> {q.rulesApplied.join(", ")}</p>}
              <p className="mt-4 text-sm">{q.explanation}</p>
              {result.skipped.length > 0 && <p className="mt-2 text-sm text-danger">Skipped: {result.skipped.join("; ")}</p>}
              <p className="mt-2 text-xs text-muted">Demo calculation with sample rates. The backend must calculate and enforce shipping at cart, checkout and order creation.</p>
            </Card>

            <Card title="Methods in this zone">
              {q.options.length ? (
                <Table caption="Methods in the matched zone" density="compact">
                  <thead>
                    <tr>
                      <th scope="col">Method</th>
                      <th scope="col">Calculation</th>
                      <th scope="col" className="text-right">Charge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.options.map((o) => {
                      const chosen = q.selected?.method.id === o.method.id;
                      return (
                        <tr key={o.method.id} className={cx(chosen && "bg-brand-soft")}>
                          <td className="min-w-40">
                            <span className="font-medium">{o.method.name}</span>{" "}
                            {chosen && <Badge tone="success">Suggested</Badge>}
                            {o.method.type === "local_pickup" && o.available && <Badge tone="info">Option</Badge>}
                            <span className="block text-xs text-muted">{methodTypeLabel[o.method.type]}</span>
                          </td>
                          <td className="text-xs">{o.available ? o.breakdown.join(" · ") : <span className="text-muted">{o.reason}</span>}</td>
                          <td className="text-right whitespace-nowrap tabular-nums">{o.available ? formatMoney(o.cost!) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              ) : (
                <p className="text-sm text-muted">This zone has no methods. Orders here need an agreed charge.</p>
              )}
            </Card>

            <Card title="Items">
              <Table caption="Items used for the calculation" density="compact">
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col" className="text-right">Qty</th>
                    <th scope="col">Unit weight</th>
                    <th scope="col">Class</th>
                    <th scope="col" className="text-right">Unit price</th>
                  </tr>
                </thead>
                <tbody>
                  {result.lines.map((l, i) => (
                    <tr key={`${l.productId}-${l.variationId}-${i}`}>
                      <td className="min-w-40">
                        {l.name}
                        {l.variationLabel && <span className="block text-xs">{l.variationLabel}</span>}
                        <span className="block text-xs text-muted">{l.sku}</span>
                      </td>
                      <td className="text-right tabular-nums">{l.quantity}</td>
                      <td className="whitespace-nowrap">
                        {kg(l.unitGrams)}
                        <span className="block text-xs text-muted">{l.weightFrom === "variation" ? "variation's own weight" : "product weight"}</span>
                      </td>
                      <td className="text-sm">{className(l.shippingClassId)}</td>
                      <td className="text-right whitespace-nowrap tabular-nums">
                        {formatMoney(l.unitPrice)}
                        <span className="block text-xs text-muted">{priceSourceText[l.priceSource]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
