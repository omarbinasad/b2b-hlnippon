"use client";

import { useState, useTransition } from "react";
import { refundOrderAction } from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { formatMoney } from "@/lib/format";
import { AMOUNT_STEP, fromMinor, toMinor } from "@/lib/orders/calc";
import { suggestedLineAmount, type RefundSummary } from "@/lib/orders/refund";
import type { FieldErrors, RefundKind } from "@/lib/types";

const n = (v: string) => (v.trim() === "" ? 0 : Number(v));

/**
 * WooCommerce-style refund: quantities and amounts per item, shipping and another amount, optional restock.
 * DEMO: the refund is recorded on the order only — no money is returned; the payment backend processes refunds.
 * `kind="overpayment"` returns money paid above the current total (one amount, nothing restocked).
 */
export function RefundButton({ orderId, summary, kind = "order" }: { orderId: string; summary: RefundSummary; kind?: RefundKind }) {
  const over = kind === "overpayment";
  const blank = () => Object.fromEntries(summary.lines.map((l) => [l.itemId, { quantity: "", amount: "" }]));
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Record<string, { quantity: string; amount: string }>>(blank);
  const [shipping, setShipping] = useState("");
  const [other, setOther] = useState(over ? String(summary.overpaid) : "");
  const [restock, setRestock] = useState(true);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const p = `refund-${kind}-${orderId}`;

  const parts = [...summary.lines.map((l) => n(lines[l.itemId]?.amount ?? "")), n(shipping), n(other)];
  const total = parts.every(Number.isFinite) ? fromMinor(parts.reduce((s, x) => s + toMinor(x), 0)) : Number.NaN;
  const anyQuantity = summary.lines.some((l) => n(lines[l.itemId]?.quantity ?? "") > 0);

  const setQuantity = (itemId: string, value: string) => {
    const line = summary.lines.find((l) => l.itemId === itemId)!;
    const q = n(value);
    // Like WooCommerce, the amount follows the quantity (editable afterwards).
    const amount = Number.isInteger(q) && q > 0 ? String(suggestedLineAmount(line, q)) : "";
    setLines((s) => ({ ...s, [itemId]: { quantity: value, amount } }));
  };
  const close = () => {
    setOpen(false);
    setLines(blank());
    setShipping("");
    setOther(over ? String(summary.overpaid) : "");
    setRestock(true);
    setReason("");
    setErrors({});
    setMessage("");
  };
  const save = () =>
    startTransition(async () => {
      const r = await refundOrderAction(orderId, {
        kind,
        lines: over ? [] : summary.lines.map((l) => ({ orderItemId: l.itemId, quantity: n(lines[l.itemId].quantity), amount: n(lines[l.itemId].amount) })),
        shipping: over ? 0 : n(shipping),
        other: n(other),
        reason,
        restock: !over && restock && anyQuantity,
      });
      if (r.ok) close();
      else {
        setErrors(r.errors);
        setMessage(r.message);
      }
    });
  const err = (key: string) => errors[key];
  const aria = (key: string, id: string) => ({ "aria-invalid": Boolean(err(key)), "aria-describedby": err(key) ? `${id}-error` : undefined });

  return (
    <>
      <Button variant={over ? "primary" : "secondary"} size="sm" onClick={() => setOpen(true)}>{over ? `Refund overpayment (${formatMoney(summary.overpaid)})` : "Refund"}</Button>
      <Dialog
        open={open}
        onClose={close}
        className="w-[min(48rem,calc(100vw-2rem))]"
        title={over ? "Refund overpayment" : "Refund"}
        description={
          over
            ? `The customer paid ${formatMoney(summary.overpaid)} more than the current total. This refund returns money only; the order value stays the same.`
            : `Paid and not yet refunded: ${formatMoney(summary.refundable)}. Refunded items and amounts lower the order value.`
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4" noValidate>
          {!over && (
            <>
              <div className="-mx-1 overflow-x-auto px-1">
                <table className="w-full min-w-[34rem] text-sm">
                  <caption className="sr-only">Items to refund</caption>
                  <thead className="text-left text-xs text-muted">
                    <tr>
                      <th scope="col" className="py-2 pr-3 font-medium">Item</th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">Line total</th>
                      <th scope="col" className="w-24 py-2 pr-3 font-medium">Refund qty</th>
                      <th scope="col" className="w-36 py-2 font-medium">Refund amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {summary.lines.map((l, i) => {
                      const left = l.quantity - l.refundedQuantity;
                      const qId = `${p}-q-${i}`;
                      const aId = `${p}-a-${i}`;
                      return (
                        <tr key={l.itemId} className="align-top">
                          <td className="py-2 pr-3">
                            <span className="font-medium">{l.name}</span>
                            <span className="block text-xs text-muted">
                              {l.sku} · ordered {l.quantity} {l.unitLabel}
                              {l.refundedQuantity > 0 && ` · ${l.refundedQuantity} refunded`}
                              {l.refundedAmount > 0 && ` · ${formatMoney(l.refundedAmount)} refunded`}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(l.gross)}</td>
                          <td className="py-2 pr-3">
                            <label htmlFor={qId} className="sr-only">Refund quantity for {l.name}</label>
                            <Input id={qId} type="number" inputMode="numeric" min={0} max={left} step={1} placeholder="0" disabled={left <= 0} value={lines[l.itemId].quantity} onChange={(e) => setQuantity(l.itemId, e.target.value)} {...aria(`lines.${i}.quantity`, qId)} />
                            {err(`lines.${i}.quantity`) && <p id={`${qId}-error`} className="mt-1 text-xs text-danger">{err(`lines.${i}.quantity`)}</p>}
                          </td>
                          <td className="py-2">
                            <label htmlFor={aId} className="sr-only">Refund amount for {l.name}</label>
                            <Input id={aId} type="number" inputMode="numeric" min={0} step={AMOUNT_STEP} placeholder="0" disabled={l.maxAmount <= 0} value={lines[l.itemId].amount} onChange={(e) => setLines((s) => ({ ...s, [l.itemId]: { ...s[l.itemId], amount: e.target.value } }))} {...aria(`lines.${i}.amount`, aId)} />
                            <p id={err(`lines.${i}.amount`) ? `${aId}-error` : undefined} className={err(`lines.${i}.amount`) ? "mt-1 text-xs text-danger" : "mt-1 text-xs text-muted"}>
                              {err(`lines.${i}.amount`) ?? `Max ${formatMoney(l.maxAmount)}`}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id={`${p}-shipping`} label="Delivery charge" hint={`Max ${formatMoney(summary.shipping.maxAmount)}${summary.shipping.refunded > 0 ? ` (${formatMoney(summary.shipping.refunded)} already refunded)` : ""}.`} error={err("shipping")}>
                  <Input id={`${p}-shipping`} type="number" inputMode="numeric" min={0} step={AMOUNT_STEP} placeholder="0" disabled={summary.shipping.maxAmount <= 0} value={shipping} onChange={(e) => setShipping(e.target.value)} {...aria("shipping", `${p}-shipping`)} />
                </Field>
                <Field id={`${p}-other`} label="Other amount" hint="Not tied to an item, e.g. a goodwill credit." error={err("other")}>
                  <Input id={`${p}-other`} type="number" inputMode="numeric" min={0} step={AMOUNT_STEP} placeholder="0" value={other} onChange={(e) => setOther(e.target.value)} {...aria("other", `${p}-other`)} />
                </Field>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="mt-0.5 size-4 accent-brand" />
                <span>
                  Return refunded quantities to stock
                  <span className="block text-xs text-muted">Counted stock only; status-managed items are skipped. Shown in each product&apos;s stock history.</span>
                </span>
              </label>
            </>
          )}
          {over && (
            <Field id={`${p}-other`} label="Amount" required hint={`Max ${formatMoney(summary.overpaid)}.`} error={err("other")}>
              <Input id={`${p}-other`} type="number" inputMode="numeric" min={0} step={AMOUNT_STEP} value={other} onChange={(e) => setOther(e.target.value)} {...aria("other", `${p}-other`)} />
            </Field>
          )}
          <Field id={`${p}-reason`} label="Reason" required hint="Required. Shown in the order's refund history." error={err("reason")}>
            <Textarea id={`${p}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder={over ? "e.g. Order reduced after weighing" : "e.g. 2 cases returned damaged"} {...aria("reason", `${p}-reason`)} />
          </Field>
          <dl className="rounded-ui border border-line bg-surface-muted p-3 text-sm tabular-nums [&>div]:flex [&>div]:justify-between [&>div]:gap-4">
            <div><dt>Paid and kept</dt><dd>{formatMoney(summary.kept)}</dd></div>
            <div><dt className="font-medium">Refund total</dt><dd className="font-medium">{Number.isFinite(total) ? formatMoney(total) : "—"}</dd></div>
            {err("amount") && <p className="pt-1 text-xs text-danger">{err("amount")}</p>}
          </dl>
          <p className="text-xs text-muted">
            Demo: this records the refund on the order only. No money is returned to the customer — the payment backend processes real refunds.
          </p>
          <p role="alert" className="text-sm text-danger">{message}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={pending || !(total > 0)}>
              {pending ? "Recording…" : `Record refund${total > 0 ? ` of ${formatMoney(total)}` : ""}`}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
