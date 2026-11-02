"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addToCartAction } from "@/app/(store)/actions";
import { StockBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { formatMoney } from "@/lib/format";
import type { Money, StockStatus } from "@/lib/types";

export interface AddToCartOption {
  variationId?: string;
  label: string;
  /** The customer's price at the minimum quantity (bulk tiers can lower it in the cart). */
  price: Money;
  available: boolean;
  stockStatus: StockStatus;
  min: number;
  max?: number;
}

/** Option + quantity picker for approved customers. The cart re-prices and re-checks everything on the server. */
export function AddToCart({ productId, unitLabel, step, options }: { productId: string; unitLabel: string; step: number; options: AddToCartOption[] }) {
  const [index, setIndex] = useState(() => Math.max(0, options.findIndex((o) => o.available)));
  const option = options[index];
  const [quantity, setQuantity] = useState(String(option.min));
  const [result, setResult] = useState<{ ok: boolean; message: string }>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3 rounded-ui border border-line bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await addToCartAction([{ productId, variationId: option.variationId, quantity: Number(quantity) }]);
          setResult({ ok: r.ok, message: r.message ?? "" });
        });
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-2xl font-semibold tabular-nums">{formatMoney(option.price)}</p>
        <span className="text-sm text-muted">per {unitLabel} · your price</span>
      </div>
      {options.length > 1 && (
        <Field id="atc-option" label="Option">
          <Select
            id="atc-option"
            value={index}
            onChange={(e) => {
              const next = Number(e.target.value);
              setIndex(next);
              setQuantity(String(options[next].min));
              setResult(undefined);
            }}
          >
            {options.map((o, i) => (
              <option key={o.variationId ?? i} value={i} disabled={!o.available}>
                {o.label} — {formatMoney(o.price)}{o.available ? "" : " (unavailable)"}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <StockBadge status={option.stockStatus} />
      <div className="flex items-end gap-3">
        <Field
          id="atc-qty"
          label={`Quantity (${unitLabel})`}
          hint={[`min ${option.min}`, option.max !== undefined && `max ${option.max}`, step > 1 && `multiples of ${step}`].filter(Boolean).join(" · ")}
        >
          <Input id="atc-qty" type="number" inputMode="numeric" min={option.min} max={option.max} step={step} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-28" />
        </Field>
        <Button type="submit" disabled={pending || !option.available} className="mb-[1.375rem] flex-1">
          {pending ? "Adding…" : "Add to cart"}
        </Button>
      </div>
      {result && (
        <p role="status" className={result.ok ? "text-sm text-success" : "text-sm text-danger"}>
          {result.message}{" "}
          {result.ok && <Link href="/cart" className="font-medium underline">View cart</Link>}
        </p>
      )}
    </form>
  );
}
