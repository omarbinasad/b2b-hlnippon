"use client";

import { useState, useTransition } from "react";
import { getOrderCustomerAction } from "@/app/admin/orders/actions";
import { productOptionAction } from "@/app/admin/pricing/actions";
import { previewTaxAction } from "@/app/admin/tax/actions";
import { CustomerPicker } from "@/components/admin/orders/customer-picker";
import { ProductSearch } from "@/components/admin/products/product-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { Table } from "@/components/ui/table";
import { siteConfig } from "@/config/site";
import type { RuleProductOption, TaxPreviewResult } from "@/lib/data/repositories";
import { formatMoney, humanize } from "@/lib/format";
import { JP_PREFECTURES } from "@/lib/locations";
import type { OrderCustomerContext } from "@/lib/types";
import { AMOUNT_STEP } from "@/lib/orders/calc";

interface CartLine {
  key: string;
  product: RuleProductOption;
  variationId: string;
  quantity: string;
  discount: string;
}

export interface TaxPreviewExample {
  label: string;
  customerId?: string;
  address: { prefecture: string; city: string; postalCode: string };
  lines: { product: RuleProductOption; variationId?: string; quantity: number; discount?: number }[];
}

let seq = 0;
const priceSourceText = { given: "entered", rule: "B2B rule", sale: "sale price", regular: "regular price" } as const;

export function TaxPreview({ examples }: { examples: TaxPreviewExample[] }) {
  const [customer, setCustomer] = useState<OrderCustomerContext | null>(null);
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [address, setAddress] = useState({ prefecture: "Tokyo", city: "Shinjuku-ku", postalCode: "" });
  const [lines, setLines] = useState<CartLine[]>([]);
  const [shippingMethodId, setShippingMethodId] = useState("auto");
  const [result, setResult] = useState<TaxPreviewResult | null>(null);
  const [pending, startTransition] = useTransition();

  const calculate = (opts: { addr?: typeof address; cart?: CartLine[]; cid?: string; method?: string } = {}) =>
    startTransition(async () => {
      const cart = opts.cart ?? lines;
      setResult(
        await previewTaxAction({
          address: opts.addr ?? address,
          customerId: "cid" in opts ? opts.cid : (customer?.id ?? customerId),
          shippingMethodId: opts.method ?? shippingMethodId,
          lines: cart.map((l) => ({ productId: l.product.productId, variationId: l.variationId || undefined, quantity: Number(l.quantity), discount: l.discount.trim() ? Number(l.discount) : undefined })),
        }),
      );
    });

  const c = result?.calc;
  const lineByIndex = (i: number) => c?.lines[i];

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
                    const cart = e.lines.map((l) => ({ key: `l${++seq}`, product: l.product, variationId: l.variationId ?? "", quantity: String(l.quantity), discount: l.discount ? String(l.discount) : "" }));
                    setCustomer(null);
                    setCustomerId(e.customerId);
                    setAddress(e.address);
                    setLines(cart);
                    setShippingMethodId("auto");
                    calculate({ addr: e.address, cart, cid: e.customerId, method: "auto" });
                  }}
                >
                  {e.label}
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Customer and address">
          <div className="space-y-3">
            {customer ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-ui border border-line p-3 text-sm">
                  <span className="font-medium">{customer.companyName}</span>
                  <Button size="sm" variant="secondary" onClick={() => setCustomer(null)}>Change</Button>
                </div>
                {customer.addresses.length > 0 && (
                  <Field id="tx-saved" label="Saved address">
                    <Select
                      id="tx-saved"
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
              </>
            ) : (
              <CustomerPicker
                id="tx-customer"
                onPick={(id) =>
                  startTransition(async () => {
                    setCustomer(await getOrderCustomerAction(id));
                    setCustomerId(id);
                  })
                }
              />
            )}
            <p className="text-xs text-muted">Without a customer, catalog (sale or regular) prices are used. Address can be entered by hand.</p>
            <Field id="tx-prefecture" label="Prefecture">
              <Select id="tx-prefecture" value={address.prefecture} onChange={(e) => setAddress({ ...address, prefecture: e.target.value })}>
                {JP_PREFECTURES.map((d) => <option key={d} value={d}>{d}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="tx-city" label="City">
                <Input id="tx-city" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
              </Field>
              <Field id="tx-postcode" label="Postcode">
                <Input id="tx-postcode" inputMode="numeric" maxLength={4} value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value.replace(/\D/g, "") })} />
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
                    <Select aria-label={`${l.product.name} option`} value={l.variationId} onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, variationId: e.target.value } : x)))} className="w-40">
                      {l.product.variations.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                    </Select>
                  )}
                  <Input aria-label={`${l.product.name} quantity`} type="number" inputMode="numeric" min={1} value={l.quantity} onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, quantity: e.target.value } : x)))} className="w-20" />
                  <Input aria-label={`${l.product.name} line discount (${siteConfig.currencySymbol})`} type="number" inputMode="decimal" min={0} step={AMOUNT_STEP} placeholder={`Discount ${siteConfig.currencySymbol}`} value={l.discount} onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, discount: e.target.value } : x)))} className="w-32" />
                </div>
              </div>
            ))}
            <ProductSearch
              id="tx-product"
              label="Add product"
              excludeIds={[]}
              onPick={(p) =>
                startTransition(async () => {
                  const option = await productOptionAction(p.id);
                  if (option) setLines((ls) => [...ls, { key: `l${++seq}`, product: option, variationId: option.variations[0]?.id ?? "", quantity: "1", discount: "" }]);
                })
              }
            />
            <Field id="tx-shipping" label="Shipping method" hint={result?.shipping.zoneName ? `Zone: ${result.shipping.zoneName}` : "Methods appear after the first calculation."}>
              <Select id="tx-shipping" value={shippingMethodId} onChange={(e) => setShippingMethodId(e.target.value)} aria-describedby="tx-shipping-hint">
                <option value="auto">Suggested method</option>
                <option value="none">No shipping</option>
                {result?.shipping.options.map((o) => (
                  <option key={o.id} value={o.id} disabled={!o.available}>
                    {o.name}{o.available ? ` — ${formatMoney(o.cost ?? 0)}` : " (not available)"}
                  </option>
                ))}
              </Select>
            </Field>
            <Button onClick={() => calculate()} disabled={pending || !lines.length}>{pending ? "Calculating…" : "Calculate tax"}</Button>
          </div>
        </Card>
      </div>

      <div className="min-w-0 space-y-6" aria-live="polite">
        {!c || !result ? (
          <Card title="Result">
            <p className="text-sm text-muted">Choose an example, or enter an address and cart items, then calculate.</p>
          </Card>
        ) : (
          <>
            <Card title="Result">
              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                <Badge tone={c.enabled ? "success" : "neutral"}>{c.enabled ? "Tax on" : "Tax off"}</Badge>
                {c.enabled && <Badge tone="info">{c.pricesIncludeTax ? "Prices include tax" : "Tax added to prices"}</Badge>}
                {c.enabled && <Badge tone={result.snapshot.shippingTaxable ? "info" : "neutral"}>{result.snapshot.shippingTaxable ? "Shipping taxable" : "Shipping not taxed"}</Badge>}
              </div>
              <dl className="space-y-1.5 text-sm [&_dd]:tabular-nums [&>div]:flex [&>div]:justify-between [&>div]:gap-4">
                <div><dt>Items</dt><dd>{formatMoney(c.itemsSubtotal)}</dd></div>
                {c.discountTotal > 0 && <div><dt>Discounts (before tax)</dt><dd>−{formatMoney(c.discountTotal)}</dd></div>}
                <div><dt>Shipping</dt><dd>{formatMoney(c.shippingTotal)}</dd></div>
                {c.groups.map((g) => (
                  <div key={g.rate.rateId}>
                    <dt className="text-muted">{g.rate.name} {g.rate.percent}%{c.pricesIncludeTax ? " included" : ""} on {formatMoney(g.taxableAmount)}</dt>
                    <dd>{formatMoney(g.taxAmount)}</dd>
                  </div>
                ))}
                <div className="border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatMoney(c.total)}</dd></div>
                <div className="text-muted"><dt>Total excluding tax</dt><dd>{formatMoney(c.netTotal)}</dd></div>
              </dl>
              {result.skipped.length > 0 && <p className="mt-2 text-sm text-danger">Skipped: {result.skipped.join("; ")}</p>}
              <p className="mt-3 text-xs text-muted">Demo calculation with fictional rates. The backend performs the authoritative tax calculation.</p>
            </Card>

            <Card title="Lines">
              <Table caption="Tax per line" density="compact">
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col" className="text-right">Qty × price</th>
                    <th scope="col" className="text-right">Discount</th>
                    <th scope="col" className="text-right">Amount</th>
                    <th scope="col">Class</th>
                    <th scope="col">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {result.lines.map((l, i) => {
                    const t = lineByIndex(i);
                    return (
                      <tr key={`${l.productId}-${l.variationId}-${i}`}>
                        <td className="min-w-40">
                          {l.name}
                          {l.variationLabel && <span className="block text-xs">{l.variationLabel}</span>}
                          <span className="block text-xs text-muted">{l.sku}{l.taxable ? "" : " · not taxable"}</span>
                        </td>
                        <td className="text-right whitespace-nowrap tabular-nums">
                          {l.quantity} × {formatMoney(l.unitPrice)}
                          <span className="block text-xs text-muted">{priceSourceText[l.priceSource]}</span>
                        </td>
                        <td className="text-right tabular-nums">{t && t.discount ? `−${formatMoney(t.discount)}` : "—"}</td>
                        <td className="text-right whitespace-nowrap tabular-nums">{t ? formatMoney(t.amount) : "—"}</td>
                        <td className="text-sm whitespace-nowrap">
                          {humanize(l.taxClass)}
                          <span className="block text-xs text-muted">{l.classFrom === "variation" ? "variation override" : "from product"}</span>
                        </td>
                        <td className="text-xs">{t?.note}</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td>Shipping{result.shipping.zoneName && <span className="block text-xs text-muted">{result.shipping.options.find((o) => o.id === result.shipping.selectedId)?.name ?? "none"} · {result.shipping.zoneName}</span>}</td>
                    <td />
                    <td />
                    <td className="text-right tabular-nums">{formatMoney(c.shipping.amount)}</td>
                    <td className="text-sm">{c.shipping.taxable ? humanize(result.snapshot.shippingRate?.taxClass ?? "") || "—" : "—"}</td>
                    <td className="text-xs">{c.shipping.note}</td>
                  </tr>
                </tbody>
              </Table>
            </Card>

            <Card title="Rate matched per class for this address">
              <ul className="space-y-1 text-sm">
                {result.matches.map((m) => (
                  <li key={m.taxClass}><span className="font-medium">{humanize(m.taxClass)}:</span> <span className="text-muted">{m.explanation}</span></li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
