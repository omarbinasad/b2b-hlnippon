"use client";

import { useCan } from "@/components/admin/capabilities-context";
import { useEffect, useRef, useState, useTransition } from "react";
import { createOrderAction, getOrderableProductAction, getOrderCustomerAction, quoteOrderLineAction, quoteOrderShippingAction, type OrderShippingSuggestion } from "@/app/admin/orders/actions";
import { ProductSearch } from "@/components/admin/products/product-search";
import { Badge, StockBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { formatMoney, formatWeight, humanize } from "@/lib/format";
import { isValidAmount, lineAmounts, amountStep } from "@/lib/orders/calc";
import { previewTaxAction } from "@/app/admin/tax/actions";
import type { TaxPreviewResult } from "@/lib/data/repositories";
import { siteConfig } from "@/config/site";
import { paymentMethodLabels } from "@/lib/orders/status";
import type { FieldErrors, OrderableProduct, OrderLineQuote, OrderAddressInput, OrderCustomerContext, PaymentMethod, ProductPick } from "@/lib/types";
import { AddressEditor, emptyAddress, toAddressInput } from "./address-editor";
import { CustomerPicker } from "./customer-picker";

interface Line {
  key: string;
  product: OrderableProduct;
  option: number;
  quantity: string;
  unitPrice: string;
  discount: string;
  /** Staff typed their own price; quantity changes then keep it instead of re-applying the rule price. */
  priceEdited: boolean;
  /** Latest rule outcome for this option and quantity (DEMO calculation). */
  quote?: OrderLineQuote;
}

const PAYMENT_METHODS = Object.keys(paymentMethodLabels) as PaymentMethod[];
const amount = (v: string) => (v.trim() === "" ? Number.NaN : Number(v));
let lineSeq = 0;

export function CreateOrderForm({ today }: { today: string }) {
  const can = useCan();
  // "walk_in" = no customer account: catalog prices, email/phone optional, store pickup or delivery.
  const [mode, setMode] = useState<"account" | "walk_in">("account");
  const [walkIn, setWalkIn] = useState({ name: "", companyName: "", email: "", phone: "" });
  const [fulfilment, setFulfilment] = useState<"delivery" | "pickup">("delivery");
  const [customer, setCustomer] = useState<OrderCustomerContext | null>(null);
  const [shippingAddress, setShippingAddress] = useState<OrderAddressInput>(emptyAddress);
  const [billingAddress, setBillingAddress] = useState<OrderAddressInput>(emptyAddress);
  const [billingSame, setBillingSame] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
  // Shipping: "suggested" uses the shipping rules' charge; "manual" is an agreed charge with a reason.
  const [shippingMode, setShippingMode] = useState<"suggested" | "manual">("suggested");
  const [shippingLabel, setShippingLabel] = useState("");
  const [shippingAmount, setShippingAmount] = useState("");
  const [shippingReason, setShippingReason] = useState("");
  const [shipQuote, setShipQuote] = useState<OrderShippingSuggestion | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash_on_delivery");
  const [deliveryDate, setDeliveryDate] = useState<string | undefined>();
  const [customerNote, setCustomerNote] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [lookupMessage, setLookupMessage] = useState("");
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();
  const walkInMode = mode === "walk_in";
  const pickup = walkInMode && fulfilment === "pickup";
  /** Who prices the lines: the customer, or nobody (walk-in → catalog prices). */
  const pricingId = walkInMode ? undefined : customer?.id;
  const buyerReady = walkInMode || Boolean(customer);
  const switchMode = (next: "account" | "walk_in") => {
    if (next === mode) return;
    setMode(next);
    setFulfilment(next === "walk_in" ? "pickup" : "delivery");
    setCustomer(null);
    setShippingAddress(emptyAddress);
    setBillingAddress(emptyAddress);
    setBillingSame(true);
    setShippingMode("suggested");
    setShipQuote(null);
    // Prices differ between customers and walk-in buyers, so lines are cleared.
    setLines([]);
    setErrors({});
  };

  const pickCustomer = (customerId: string) =>
    startLoading(async () => {
      const ctx = await getOrderCustomerAction(customerId);
      if (!ctx) {
        setLookupMessage("That customer can't be ordered for (not found or not approved).");
        return;
      }
      setLookupMessage("");
      setCustomer(ctx);
      const ship = ctx.addresses.find((a) => a.type === "shipping" && a.isDefault) ?? ctx.addresses.find((a) => a.type === "shipping") ?? ctx.addresses[0];
      const bill = ctx.addresses.find((a) => a.type === "billing" && a.isDefault) ?? ctx.addresses.find((a) => a.type === "billing");
      setShippingAddress(ship ? toAddressInput(ship) : { ...emptyAddress, recipientName: ctx.contactName ?? "", phone: ctx.phone ?? "" });
      setBillingAddress(bill ? toAddressInput(bill) : ship ? toAddressInput(ship) : emptyAddress);
      setBillingSame(!bill);
      setShippingMode("suggested");
      setShippingReason("");
      setShipQuote(null);
      // Prices are customer-specific, so lines from another customer are cleared.
      setLines([]);
      setErrors({});
    });

  const addProduct = (pick: ProductPick) => {
    if (!buyerReady) return;
    startLoading(async () => {
      const product = await getOrderableProductAction(pick.id, pricingId);
      if (!product) {
        setLookupMessage(`${pick.name} can't be ordered (no price or not available).`);
        return;
      }
      setLookupMessage(`${product.name} added.`);
      const option = Math.max(0, product.options.findIndex((o) => o.available));
      const opt = product.options[option];
      const line: Line = { key: `l${++lineSeq}`, product, option, quantity: String(opt.minQuantity), unitPrice: String(opt.customerPrice), discount: "0", priceEdited: false };
      setLines((ls) => [...ls, line]);
      requote(line, line.quantity);
    });
  };

  const updateLine = (key: string, change: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...change } : l)));

  // Re-quote a line when its option or quantity changes: bulk tiers can change the rule price.
  const quoteTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const timers = quoteTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);
  const requote = (line: Pick<Line, "key" | "product" | "option">, quantity: string) => {
    if (!buyerReady) return;
    const timers = quoteTimers.current;
    clearTimeout(timers.get(line.key));
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) return;
    timers.set(
      line.key,
      setTimeout(async () => {
        const quote = await quoteOrderLineAction(pricingId, line.product.productId, line.product.options[line.option].variationId, qty);
        if (!quote) return;
        setLines((ls) =>
          ls.map((l) =>
            l.key === line.key && l.quantity === quantity && l.option === line.option
              ? { ...l, quote, unitPrice: l.priceEdited ? l.unitPrice : String(quote.unitPrice) }
              : l,
          ),
        );
      }, 250),
    );
  };

  // Live preview with the shared pure calculator; the server recalculates on save.
  const parsed = lines.map((l) => {
    const o = l.product.options[l.option];
    const quantity = Number(l.quantity);
    return {
      valid: Number.isInteger(quantity) && quantity > 0 && isValidAmount(amount(l.unitPrice)) && isValidAmount(amount(l.discount)),
      quantity,
      unitPrice: amount(l.unitPrice),
      discount: amount(l.discount),
      pricedByWeight: l.product.pricedByWeight,
      orderedWeight: { value: o.weight.value * (quantity || 0), unit: o.weight.unit },
      taxClass: o.taxClass,
    };
  });
  const effectiveShipping = pickup ? 0 : shippingMode === "suggested" ? (shipQuote?.amount ?? Number.NaN) : amount(shippingAmount);
  const effectiveLabel = pickup ? "Collected in store" : shippingMode === "suggested" ? (shipQuote?.label ?? "") : shippingLabel;
  const previewable = parsed.length > 0 && parsed.every((p) => p.valid && p.discount <= p.quantity * p.unitPrice) && isValidAmount(effectiveShipping);
  // Tax and totals come from the server's tax engine with current settings (DEMO, fictional rates);
  // the order stores this snapshot on save.
  const [taxPreview, setTaxPreview] = useState<TaxPreviewResult | null>(null);
  const taxKey = JSON.stringify([previewable, pricingId, mode, pickup, shippingAddress.prefecture, shippingAddress.city, shippingAddress.postalCode, effectiveShipping, lines.map((l) => [l.product.productId, l.product.options[l.option].variationId, l.quantity, l.unitPrice, l.discount])]);
  useEffect(() => {
    if (!previewable || !buyerReady) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const r = await previewTaxAction({
        // Store pickup is taxed at the store's location (the server fills it in).
        pickup,
        address: { prefecture: shippingAddress.prefecture, city: shippingAddress.city, postalCode: shippingAddress.postalCode },
        customerId: pricingId,
        shippingAmount: effectiveShipping,
        lines: lines.map((l) => ({ productId: l.product.productId, variationId: l.product.options[l.option].variationId, quantity: Number(l.quantity), unitPrice: amount(l.unitPrice), discount: amount(l.discount) })),
      });
      if (!cancelled) setTaxPreview(r);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // taxKey captures every input that changes the calculation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxKey]);
  const totals = previewable ? taxPreview?.calc : undefined;

  // Re-quote shipping when the delivery address or the lines change (debounced).
  const shipKey = JSON.stringify([
    pricingId,
    mode,
    pickup,
    shippingAddress.prefecture,
    shippingAddress.city,
    shippingAddress.postalCode,
    lines.map((l) => [l.product.productId, l.product.options[l.option].variationId, l.quantity, l.unitPrice, l.discount]),
  ]);
  useEffect(() => {
    if (!buyerReady || pickup || !lines.length) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const q = await quoteOrderShippingAction({
        address: { prefecture: shippingAddress.prefecture, city: shippingAddress.city, postalCode: shippingAddress.postalCode },
        items: lines.map((l) => ({
          productId: l.product.productId,
          variationId: l.product.options[l.option].variationId,
          quantity: Number(l.quantity),
          unitPrice: amount(l.unitPrice),
          discount: amount(l.discount),
        })),
      });
      if (!cancelled) setShipQuote(q);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // shipKey captures every input that changes the quote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipKey]);

  const submit = () =>
    startSaving(async () => {
      setMessage("");
      const result = await createOrderAction({
        customerId: walkInMode ? undefined : customer?.id ?? "",
        walkIn: walkInMode ? walkIn : undefined,
        fulfilment: pickup ? "pickup" : "delivery",
        shippingAddress: pickup ? undefined : shippingAddress,
        billingAddress: pickup ? undefined : billingSame ? shippingAddress : billingAddress,
        items: lines.map((l) => ({
          productId: l.product.productId,
          variationId: l.product.options[l.option].variationId,
          quantity: Number(l.quantity),
          unitPrice: amount(l.unitPrice),
          discount: amount(l.discount),
        })),
        shipping: { label: effectiveLabel, amount: effectiveShipping, mode: shippingMode, reason: shippingMode === "manual" ? shippingReason : undefined },
        paymentMethod,
        requestedDeliveryDate: deliveryDate,
        customerNote,
        adminNote,
      });
      if (!result) return; // redirected to the new order
      if (!result.ok) {
        const errs = billingSame
          ? Object.fromEntries(Object.entries(result.errors).filter(([k]) => !k.startsWith("billingAddress.")))
          : result.errors;
        setErrors(errs);
        setMessage(result.message);
      }
    });

  const err = (k: string) => errors[k];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]"
    >
      <div className="min-w-0 space-y-6">
        <Card title="1. Customer">
          <fieldset className="mb-4">
            <legend className="sr-only">Order for</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ["account", "Registered customer", "Customer prices and saved addresses."],
                ["walk_in", "Walk-in customer", "No account needed. Catalog prices; email and phone optional."],
              ] as const).map(([m, label, text]) => (
                <label key={m} className="flex cursor-pointer gap-3 rounded-ui border border-line p-3 has-checked:border-brand has-checked:bg-brand-soft">
                  <input type="radio" name="order-for" checked={mode === m} onChange={() => switchMode(m)} className="mt-0.5 accent-brand" />
                  <span>
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-xs text-muted">{text}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {walkInMode ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="walkin-name" label="Buyer's name" required error={err("walkIn.name")}>
                <Input id="walkin-name" value={walkIn.name} onChange={(e) => setWalkIn({ ...walkIn, name: e.target.value })} maxLength={200} autoComplete="off" aria-invalid={Boolean(err("walkIn.name"))} aria-describedby={err("walkIn.name") ? "walkin-name-error" : undefined} />
              </Field>
              <Field id="walkin-company" label="Company" error={err("walkIn.companyName")}>
                <Input id="walkin-company" value={walkIn.companyName} onChange={(e) => setWalkIn({ ...walkIn, companyName: e.target.value })} maxLength={200} autoComplete="off" />
              </Field>
              <Field id="walkin-phone" label="Phone (optional)" error={err("walkIn.phone")}>
                <Input id="walkin-phone" type="tel" inputMode="tel" value={walkIn.phone} onChange={(e) => setWalkIn({ ...walkIn, phone: e.target.value })} maxLength={40} autoComplete="off" aria-invalid={Boolean(err("walkIn.phone"))} aria-describedby={err("walkIn.phone") ? "walkin-phone-error" : undefined} />
              </Field>
              <Field id="walkin-email" label="Email (optional)" error={err("walkIn.email")}>
                <Input id="walkin-email" type="email" value={walkIn.email} onChange={(e) => setWalkIn({ ...walkIn, email: e.target.value })} maxLength={200} autoComplete="off" aria-invalid={Boolean(err("walkIn.email"))} aria-describedby={err("walkIn.email") ? "walkin-email-error" : undefined} />
              </Field>
              <p className="text-xs text-muted sm:col-span-2">No customer account or login is created. The order is saved with these details only.</p>
            </div>
          ) : customer ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{customer.companyName}</p>
                <p className="text-sm text-muted">{[customer.contactName, customer.phone].filter(Boolean).join(" · ")}</p>
                <p className="text-sm break-all text-muted">{customer.email}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setCustomer(null);
                  setLines([]);
                }}
              >
                Change customer
              </Button>
            </div>
          ) : (
            <CustomerPicker id="order-customer" onPick={pickCustomer} error={err("customerId")} />
          )}
        </Card>

        <Card
          title="2. Products"
          description={
            walkInMode
              ? "Walk-in buyers get the catalog price (sale price when active) — customer price rules need an account. You can agree a different price."
              : customer
                ? "Prices default to this customer's price (including group and customer price rules). You can agree a different price."
                : undefined
          }
        >
          {!buyerReady ? (
            <p className="text-sm text-muted">Choose a customer first — prices depend on the customer.</p>
          ) : (
            <div className="space-y-4">
              {lines.length > 0 && (
                <ul className="divide-y divide-line rounded-ui border border-line">
                  {lines.map((l, i) => {
                    const o = l.product.options[l.option];
                    const p = `items.${i}.`;
                    const fid = (f: string) => `line-${l.key}-${f}`;
                    const lineValid = parsed[i].valid;
                    return (
                      <li key={l.key} className="space-y-3 p-3">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{l.product.name}</p>
                            <p className="text-xs text-muted">
                              {o.sku} · per {l.product.unitLabel} · {formatWeight(o.weight)}
                              {l.product.pricedByWeight && " · priced by weight"} · {humanize(o.taxClass)} tax
                            </p>
                            {(err(`${p}productId`) || err(`${p}variationId`)) && (
                              <p className="text-xs text-danger">{err(`${p}productId`) ?? err(`${p}variationId`)}</p>
                            )}
                          </div>
                          <StockBadge status={o.stock.status} />
                          <button
                            type="button"
                            onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                            className="grid size-8 shrink-0 place-items-center rounded-ui text-muted hover:bg-surface-muted hover:text-danger"
                            aria-label={`Remove ${l.product.name}`}
                          >
                            <Icon name="trash" className="size-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {l.product.type === "variable" && (
                            <div className="col-span-2 sm:col-span-4">
                              <Field id={fid("option")} label="Option" required>
                                <Select
                                  id={fid("option")}
                                  value={l.option}
                                  onChange={(e) => {
                                    const option = Number(e.target.value);
                                    updateLine(l.key, { option, unitPrice: String(l.product.options[option].customerPrice), priceEdited: false, quote: undefined });
                                    requote({ ...l, option }, l.quantity);
                                  }}
                                >
                                  {l.product.options.map((opt, oi) => (
                                    <option key={opt.variationId} value={oi} disabled={!opt.available}>
                                      {opt.label} — {formatMoney(opt.customerPrice)}{opt.available ? "" : " (disabled)"}
                                    </option>
                                  ))}
                                </Select>
                              </Field>
                            </div>
                          )}
                          <Field id={fid("qty")} label="Quantity" required error={err(`${p}quantity`)}>
                            <Input
                              id={fid("qty")}
                              type="number"
                              inputMode="numeric"
                              min={o.minQuantity}
                              max={o.maxQuantity}
                              step={1}
                              value={l.quantity}
                              onChange={(e) => {
                                updateLine(l.key, { quantity: e.target.value });
                                requote(l, e.target.value);
                              }}
                              aria-invalid={Boolean(err(`${p}quantity`))}
                              aria-describedby={err(`${p}quantity`) ? `${fid("qty")}-error` : `${fid("qty")}-limits`}
                            />
                            {!err(`${p}quantity`) && (
                              <p id={`${fid("qty")}-limits`} className={l.quote?.quantityError ? "text-xs text-danger" : "text-xs text-muted"}>
                                {l.quote?.quantityError ?? `Min ${o.minQuantity}${o.maxQuantity !== undefined ? `, max ${o.maxQuantity}` : ""} per line`}
                              </p>
                            )}
                          </Field>
                          <Field id={fid("price")} label={`Unit price (${siteConfig.currencySymbol})`} required error={err(`${p}unitPrice`)}>
                            <Input
                              id={fid("price")}
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step={amountStep()}
                              disabled={!can("order_prices.edit")}
                              value={l.unitPrice}
                              onChange={(e) => updateLine(l.key, { unitPrice: e.target.value, priceEdited: true })}
                              aria-invalid={Boolean(err(`${p}unitPrice`))}
                              aria-describedby={err(`${p}unitPrice`) ? `${fid("price")}-error` : `${fid("price")}-note`}
                            />
                          </Field>
                          <Field id={fid("discount")} label={`Discount (${siteConfig.currencySymbol})`} error={err(`${p}discount`)}>
                            <Input
                              id={fid("discount")}
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step={amountStep()}
                              disabled={!can("order_discounts.edit")}
                              value={l.discount}
                              onChange={(e) => updateLine(l.key, { discount: e.target.value })}
                              aria-invalid={Boolean(err(`${p}discount`))}
                              aria-describedby={err(`${p}discount`) ? `${fid("discount")}-error` : undefined}
                            />
                          </Field>
                          <div className="space-y-1.5">
                            <p className="text-sm font-medium">Line</p>
                            <p className="flex h-10 items-center font-medium tabular-nums">
                              {lineValid ? formatMoney(lineAmounts(parsed[i]).total) : "—"}
                            </p>
                          </div>
                        </div>
                        <p id={`${fid("price")}-note`} className="text-xs text-muted">
                          Regular {formatMoney(o.catalogPrice)} · suggested {formatMoney(l.quote?.unitPrice ?? o.customerPrice)}
                          {l.quote && (l.quote.ruleName ? ` from “${l.quote.ruleName}”${l.quote.tierLabel ? ` (qty ${l.quote.tierLabel})` : ""}` : l.quote.priceSource === "sale" ? " (no rule — sale price)" : " (no rule — regular price)")}
                          {l.quote?.priceSource === "sale" && l.quote.rulePrice !== undefined && (
                            <> · <Badge tone="info">Sale price won</Badge> sale {formatMoney(l.quote.salePrice!)} is lower than the rule price {formatMoney(l.quote.rulePrice)}</>
                          )}
                          {l.quote?.priceSource === "rule" && l.quote.salePrice !== undefined && (
                            <> · <Badge tone="success">Rule price won</Badge> sale {formatMoney(l.quote.salePrice)} is not lower</>
                          )}
                          {amount(l.unitPrice) !== (l.quote?.unitPrice ?? o.customerPrice) && isValidAmount(amount(l.unitPrice)) && (
                            <>
                              {" "}· <Badge tone="warning">Agreed price</Badge>{" "}
                              <button
                                type="button"
                                className="text-brand hover:underline"
                                onClick={() => {
                                  updateLine(l.key, { priceEdited: false, unitPrice: String(l.quote?.unitPrice ?? o.customerPrice) });
                                  requote(l, l.quantity);
                                }}
                              >
                                Use rule price
                              </button>
                            </>
                          )}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
              {err("items") && <p className="text-sm text-danger">{err("items")}</p>}
              <ProductSearch id="order-product" label="Add product" excludeIds={[]} onPick={addProduct} />
            </div>
          )}
          <p role="status" className="mt-2 text-xs text-muted">{loading ? "Loading…" : lookupMessage}</p>
        </Card>

        {walkInMode && (
          <Card title="3. Collection or delivery">
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ["pickup", "Collect in store", "No delivery charge; tax at the store's location."],
                ["delivery", "Deliver", "Enter a delivery address (phone optional)."],
              ] as const).map(([m, label, text]) => (
                <label key={m} className="flex cursor-pointer gap-3 rounded-ui border border-line p-3 has-checked:border-brand has-checked:bg-brand-soft">
                  <input type="radio" name="fulfilment" checked={fulfilment === m} onChange={() => setFulfilment(m)} className="mt-0.5 accent-brand" />
                  <span>
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-xs text-muted">{text}</span>
                  </span>
                </label>
              ))}
            </div>
            {err("fulfilment") && <p className="mt-2 text-xs text-danger">{err("fulfilment")}</p>}
          </Card>
        )}

        {((customer && !walkInMode) || (walkInMode && !pickup)) && (
          <Card title={walkInMode ? "Addresses" : "3. Addresses"}>
            <div className="space-y-6">
              <AddressEditor
                key={`ship-${customer?.id ?? "walk-in"}`}
                id="ship"
                legend="Delivery address"
                saved={customer?.addresses ?? []}
                phoneOptional={walkInMode}
                value={shippingAddress}
                onChange={setShippingAddress}
                errors={errors}
                errorPrefix="shippingAddress"
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={billingSame} onChange={(e) => setBillingSame(e.target.checked)} className="size-4 accent-brand" />
                Billing address is the same as delivery
              </label>
              {!billingSame && (
                <AddressEditor
                  key={`bill-${customer?.id ?? "walk-in"}`}
                  id="bill"
                  legend="Billing address"
                  saved={customer?.addresses ?? []}
                  phoneOptional={walkInMode}
                  value={billingAddress}
                  onChange={setBillingAddress}
                  errors={errors}
                  errorPrefix="billingAddress"
                />
              )}
            </div>
          </Card>
        )}

        {buyerReady && (
          <Card title={pickup ? "4. Payment and notes" : "4. Delivery, payment and notes"}>
            <div className="grid gap-4 sm:grid-cols-2">
              {!pickup && <fieldset className="space-y-3 sm:col-span-2">
                <legend className="text-sm font-medium">Shipping charge</legend>
                <div className="rounded-ui border border-line bg-surface-muted p-3 text-sm" role="status">
                  {!lines.length ? (
                    <p className="text-muted">Add products to get a suggested charge.</p>
                  ) : !shipQuote ? (
                    <p className="text-muted">Calculating…</p>
                  ) : (
                    <>
                      <p>
                        {shipQuote.amount !== undefined ? (
                          <>
                            Suggested <strong>{formatMoney(shipQuote.amount)}</strong> · {shipQuote.methodName} · zone “{shipQuote.zoneName}”
                          </>
                        ) : (
                          <>No suggested charge for zone “{shipQuote.zoneName ?? "none"}”.</>
                        )}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {shipQuote.totalKg} kg · subtotal {formatMoney(shipQuote.subtotal)}. {shipQuote.explanation} Sample demo rates.
                      </p>
                    </>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(["suggested", "manual"] as const).map((m) => (
                    <label key={m} className="flex cursor-pointer gap-3 rounded-ui border border-line p-3 has-checked:border-brand has-checked:bg-brand-soft">
                      <input
                        type="radio"
                        name="ship-mode"
                        checked={shippingMode === m}
                        disabled={m === "suggested" && shipQuote !== null && shipQuote.amount === undefined}
                        onChange={() => {
                          setShippingMode(m);
                          if (m === "manual" && !shippingLabel) setShippingLabel(shipQuote?.label ?? "Delivery");
                          if (m === "manual" && !shippingAmount && shipQuote?.amount !== undefined) setShippingAmount(String(shipQuote.amount));
                        }}
                        className="mt-0.5 accent-brand"
                      />
                      <span>
                        <span className="block text-sm font-medium">{m === "suggested" ? "Use the suggested charge" : "Agreed charge"}</span>
                        <span className="block text-xs text-muted">{m === "suggested" ? "From the shipping zones; re-checked when you save." : "Enter the amount agreed with the customer and why."}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {err("shipping.amount") && shippingMode === "suggested" && <p className="text-xs text-danger">{err("shipping.amount")}</p>}
                {shippingMode === "manual" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="ship-label" label="Delivery description" required error={err("shipping.label")}>
                      <Input id="ship-label" value={shippingLabel} onChange={(e) => setShippingLabel(e.target.value)} maxLength={120} aria-invalid={Boolean(err("shipping.label"))} />
                    </Field>
                    <Field id="ship-amount" label={`Agreed charge (${siteConfig.currencySymbol})`} required error={err("shipping.amount")}>
                      <Input
                        id="ship-amount"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={amountStep()}
                        value={shippingAmount}
                        onChange={(e) => setShippingAmount(e.target.value)}
                        aria-invalid={Boolean(err("shipping.amount"))}
                        aria-describedby={err("shipping.amount") ? "ship-amount-error" : undefined}
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field id="ship-reason" label="Reason" required hint="Saved with the order, e.g. “Delivered with another order this week”." error={err("shipping.reason")}>
                        <Input id="ship-reason" value={shippingReason} onChange={(e) => setShippingReason(e.target.value)} maxLength={300} aria-invalid={Boolean(err("shipping.reason"))} aria-describedby={err("shipping.reason") ? "ship-reason-error" : "ship-reason-hint"} />
                      </Field>
                    </div>
                  </div>
                )}
              </fieldset>}
              <Field id="pay-method" label="Payment method" required hint="Recorded only — no payment is taken." error={err("paymentMethod")}>
                <Select id="pay-method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} aria-describedby="pay-method-hint">
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{paymentMethodLabels[m]}</option>)}
                </Select>
              </Field>
              <Field id="delivery-date" label={pickup ? "Collection date" : "Requested delivery date"} error={err("requestedDeliveryDate")}>
                <DatePicker id="delivery-date" value={deliveryDate} onChange={setDeliveryDate} min={today} placeholder="No preference" />
              </Field>
              <div className="sm:col-span-2">
                <Field id="customer-note" label="Customer's note" hint={walkInMode ? "Printed with the order." : "Visible to the customer on their order."} error={err("customerNote")}>
                  <Textarea id="customer-note" value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} maxLength={1000} className="min-h-20" aria-describedby="customer-note-hint" />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field id="admin-note" label="Internal note" hint="Admins only." error={err("adminNote")}>
                  <Textarea id="admin-note" value={adminNote} onChange={(e) => setAdminNote(e.target.value)} maxLength={1000} className="min-h-20" aria-describedby="admin-note-hint" />
                </Field>
              </div>
            </div>
          </Card>
        )}
      </div>

      <div className="min-w-0">
        <div className="space-y-4 xl:sticky xl:top-20">
          <Card title="Review totals">
            {totals ? (
              <dl className="space-y-1.5 text-sm [&_dd]:tabular-nums [&>div]:flex [&>div]:justify-between [&>div]:gap-4">
                <div><dt>Items</dt><dd>{formatMoney(totals.itemsSubtotal)}</dd></div>
                {totals.discountTotal > 0 && <div><dt>Discounts</dt><dd>−{formatMoney(totals.discountTotal)}</dd></div>}
                <div><dt>{pickup ? "Collected in store" : "Delivery"}</dt><dd>{formatMoney(totals.shippingTotal)}</dd></div>
                {totals.groups.map((g) => (
                  <div key={g.rate.rateId}>
                    <dt className="text-muted">{g.rate.name} {g.rate.percent}%{totals.pricesIncludeTax ? " included" : ""} on {formatMoney(g.taxableAmount)}</dt>
                    <dd>{formatMoney(g.taxAmount)}</dd>
                  </div>
                ))}
                {!totals.enabled && <div><dt className="text-muted">Tax</dt><dd className="text-muted">Off</dd></div>}
                <div className="border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatMoney(totals.total)}</dd></div>
                {totals.enabled && <div className="text-muted"><dt>Excluding tax</dt><dd>{formatMoney(totals.netTotal)}</dd></div>}
              </dl>
            ) : (
              <p className="text-sm text-muted">{!lines.length ? "Add products to see totals." : previewable ? "Calculating…" : "Fix the highlighted amounts to see totals."}</p>
            )}
            <p className="mt-3 text-xs text-muted">
              Demo calculation: fictional tax rates (Tax settings) and demo price rules. Discounts come off before tax. On save the server recalculates, stores the
              tax settings and matched rates with the order, and records which rule priced each line. Weight-priced items are finalised when packed.
            </p>
          </Card>
          <p role="alert" className="text-sm text-danger">{message}</p>
          <Button type="submit" size="lg" className="w-full" disabled={saving || !buyerReady}>
            {saving ? "Creating order…" : "Create order"}
          </Button>
          <p className="text-xs text-muted">Creates a demo order with status “Order received”. No confirmation is sent to the customer.</p>
        </div>
      </div>
    </form>
  );
}
