"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { checkoutPreviewAction, placeOrderAction } from "@/app/(store)/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cx } from "@/lib/cx";
import { formatAddressLines, formatMoney } from "@/lib/format";
import type { Address, CheckoutPaymentMethod, CheckoutPreview, FieldErrors } from "@/lib/types";

interface Props {
  shippingAddresses: Address[];
  billingAddresses: Address[];
  methods: CheckoutPaymentMethod[];
  /** Store calendar date (YYYY-MM-DD): the earliest delivery date. */
  today: string;
  /** One per checkout page view, so a repeated submission can't create a second order. */
  idempotencyKey: string;
}

/** Delivery, payment and confirmation. Totals come from the server (re-priced cart, shipping quote, tax snapshot). */
export function CheckoutForm({ shippingAddresses, billingAddresses, methods, today, idempotencyKey }: Props) {
  const [shippingAddressId, setShipping] = useState(() => (shippingAddresses.find((a) => a.isDefault) ?? shippingAddresses[0])?.id ?? "");
  const [billingAddressId, setBilling] = useState("");
  const [shippingMethodId, setMethod] = useState("");
  const [paymentMethod, setPayment] = useState(methods[0]?.id ?? "");
  const [requestedDeliveryDate, setDate] = useState("");
  const [customerNote, setNote] = useState("");
  const [preview, setPreview] = useState<CheckoutPreview>();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [loading, startPreview] = useTransition();
  const [placing, startPlacing] = useTransition();
  const [placed, setPlaced] = useState(false);
  const request = useRef(0);

  const input = { shippingMethodId, shippingAddressId, billingAddressId, paymentMethod, requestedDeliveryDate, customerNote };

  useEffect(() => {
    const n = ++request.current;
    startPreview(async () => {
      const r = await checkoutPreviewAction({ shippingMethodId, shippingAddressId, billingAddressId, paymentMethod, requestedDeliveryDate });
      if (n !== request.current) return;
      if (r.ok) {
        setPreview(r.value);
        setErrors({});
        setMessage("");
      } else {
        setPreview(undefined);
        setErrors(r.errors);
        setMessage(r.message);
      }
    });
  }, [shippingMethodId, shippingAddressId, billingAddressId, paymentMethod, requestedDeliveryDate]);

  const method = methods.find((m) => m.id === paymentMethod);
  const t = preview?.totals;

  return (
    <form
      noValidate
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start"
      onSubmit={(e) => {
        e.preventDefault();
        startPlacing(async () => {
          setPlaced(true);
          const r = await placeOrderAction({ ...input, idempotencyKey });
          if (!r) return; // redirected to the new order
          setPlaced(false);
          setErrors(r.errors);
          setMessage(r.message);
        });
      }}
    >
      <div className="space-y-6">
        <fieldset className="space-y-2">
          <legend className="font-semibold">Delivery address</legend>
          {shippingAddresses.map((a) => (
            <label key={a.id} className="flex cursor-pointer gap-3 rounded-ui border border-line bg-surface p-3 text-sm has-checked:border-brand has-checked:bg-brand-soft">
              <input type="radio" name="shippingAddressId" value={a.id} checked={shippingAddressId === a.id} onChange={() => setShipping(a.id)} className="mt-0.5 accent-brand" />
              <span>
                <span className="block font-medium">{a.label}{a.isDefault ? " (default)" : ""}</span>
                <span className="block text-muted">{[a.recipientName, ...formatAddressLines(a), a.phone].join(", ")}</span>
              </span>
            </label>
          ))}
          {errors.shippingAddressId && <p className="text-sm text-danger">{errors.shippingAddressId}</p>}
        </fieldset>

        {preview && preview.shippingOptions.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="font-semibold">Delivery method</legend>
            {preview.shippingOptions.map((o) => (
              <label key={o.methodId} className="flex cursor-pointer gap-3 rounded-ui border border-line bg-surface p-3 text-sm has-[:checked]:border-brand">
                <input type="radio" name="shippingMethodId" value={o.methodId} checked={(shippingMethodId || preview.selectedMethodId) === o.methodId} onChange={() => setMethod(o.methodId)} />
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between gap-2 font-medium"><span>{o.name}</span><span className="tabular-nums">{o.cost ? formatMoney(o.cost) : "Free"}</span></span>
                  {o.detail && <span className="block text-xs text-muted">{o.detail}</span>}
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {billingAddresses.length > 0 && (
          <Field id="co-billing" label="Billing address" error={errors.billingAddressId}>
            <Select id="co-billing" value={billingAddressId} onChange={(e) => setBilling(e.target.value)}>
              <option value="">Default billing address</option>
              {billingAddresses.map((a) => <option key={a.id} value={a.id}>{a.label} — {formatAddressLines(a).join(", ")}</option>)}
            </Select>
          </Field>
        )}

        <Field id="co-date" label="Preferred delivery date" hint="Optional. We confirm the actual date with your delivery route." error={errors.requestedDeliveryDate}>
          <Input id="co-date" type="date" min={today} value={requestedDeliveryDate} onChange={(e) => setDate(e.target.value)} className="sm:w-56" />
        </Field>

        <fieldset className="space-y-2">
          <legend className="font-semibold">Payment</legend>
          {methods.length === 0 && <p className="text-sm text-danger">No payment method is available. Contact us to place your order.</p>}
          {methods.map((m) => (
            <label key={m.id} className="flex cursor-pointer gap-3 rounded-ui border border-line bg-surface p-3 text-sm has-checked:border-brand has-checked:bg-brand-soft">
              <input type="radio" name="paymentMethod" value={m.id} checked={paymentMethod === m.id} onChange={() => setPayment(m.id)} className="mt-0.5 accent-brand" />
              <span>
                <span className="block font-medium">{m.title}</span>
                <span className="block text-muted">{m.description}</span>
              </span>
            </label>
          ))}
          {method?.instructions && <p className="text-xs text-muted">{method.instructions}</p>}
          {errors.paymentMethod && <p className="text-sm text-danger">{errors.paymentMethod}</p>}
        </fieldset>

        <Field id="co-note" label="Note for this order" hint="Optional: delivery instructions, gate code, contact on arrival." error={errors.customerNote}>
          <Textarea id="co-note" value={customerNote} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
      </div>

      <aside className="space-y-3 rounded-ui border border-line bg-surface p-4 lg:sticky lg:top-24">
        <h2 className="font-semibold">Order summary</h2>
        <div className={cx("space-y-3", loading && "opacity-60 transition-opacity")} aria-busy={loading}>
          {preview ? (
            <>
              <ul className="space-y-2 text-sm">
                {preview.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3">
                    <span className="min-w-0">
                      {i.name}
                      <span className="block text-xs text-muted">{i.quantity} × {formatMoney(i.unitPrice)}{i.attributes ? ` · ${Object.values(i.attributes).join(", ")}` : ""}</span>
                    </span>
                    <span className="tabular-nums">{formatMoney(i.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              <dl className="space-y-1.5 border-t border-line pt-3 text-sm [&_dd]:tabular-nums [&>div]:flex [&>div]:justify-between [&>div]:gap-3">
                <div><dt>Items</dt><dd>{formatMoney(t!.itemsSubtotal)}</dd></div>
                {t!.discountTotal > 0 && <div><dt>{preview.coupon ? `Coupon ${preview.coupon.code}` : "Discounts"}</dt><dd>−{formatMoney(t!.discountTotal)}</dd></div>}
                <div><dt>Delivery ({preview.shipping.label})</dt><dd>{t!.shippingTotal ? formatMoney(t!.shippingTotal) : "Free"}</dd></div>
                {preview.taxes.map((tax) => (
                  <div key={tax.rateId ?? tax.taxClass}><dt className="text-muted">{tax.rateName ?? "Tax"} {tax.rate}% (fictional demo rate){t!.taxIncluded ? " included" : ""}</dt><dd>{formatMoney(tax.taxAmount)}</dd></div>
                ))}
                <div className="border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatMoney(t!.total)}</dd></div>
              </dl>
              {preview.items.some((i) => i.pricedByWeight) && <p className="text-xs text-muted">Items priced by weight are adjusted to the actual packed weight; you&apos;ll see both weights on the order and invoice.</p>}
            </>
          ) : (
            <p className="text-sm text-muted">{loading ? "Calculating…" : "Totals appear once the details are complete."}</p>
          )}
        </div>
        <p role="alert" className="text-sm text-danger">{message}</p>
        <Button type="submit" className="w-full" disabled={placing || placed || !preview}>
          {placing || placed ? "Placing order…" : "Place order"}
        </Button>
        <p className="text-xs text-muted">No payment is taken on this site. Demo order: kept on this demo server only.</p>
      </aside>
    </form>
  );
}
