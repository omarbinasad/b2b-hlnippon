"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addToCartAction } from "@/app/(store)/actions";
import { StockBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
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

const stepButton = "grid size-10 shrink-0 place-items-center text-muted hover:text-brand disabled:opacity-35 disabled:hover:text-muted";

/** Option + quantity picker for approved customers. The cart re-prices and re-checks everything on the server. */
export function AddToCart({ productId, unitLabel, step, options }: { productId: string; unitLabel: string; step: number; options: AddToCartOption[] }) {
  const [index, setIndex] = useState(() => Math.max(0, options.findIndex((o) => o.available)));
  const option = options[index];
  const [quantity, setQuantity] = useState(String(option.min));
  const [result, setResult] = useState<{ ok: boolean; message: string }>();
  const [pending, startTransition] = useTransition();
  const by = Math.max(1, step);
  // − / + move by the multiple and stay within the option's limits; a typed number is checked by the server.
  const change = (delta: number) => {
    const current = Number(quantity);
    const base = Number.isFinite(current) && current >= option.min ? current : option.min;
    const next = Math.max(option.min, base + delta);
    setQuantity(String(option.max !== undefined ? Math.min(option.max, next) : next));
    setResult(undefined);
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await addToCartAction([{ productId, variationId: option.variationId, quantity: Number(quantity) }]);
          setResult({ ok: r.ok, message: r.message ?? "" });
        });
      }}
    >
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-2xl font-semibold tabular-nums">{formatMoney(option.price)}</span>
        <span className="text-sm text-muted">per {unitLabel} · your price</span>
      </p>
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
      {/* The page shows the product's stock; with options, each one's own stock shows here. */}
      {options.length > 1 && <StockBadge status={option.stockStatus} />}
      <div className="flex items-end gap-2">
        <Field
          id="atc-qty"
          label={`Quantity (${unitLabel})`}
          hint={[`min ${option.min}`, option.max !== undefined && `max ${option.max}`, step > 1 && `multiples of ${step}`].filter(Boolean).join(" · ")}
        >
          <div className="inline-flex h-10 items-center rounded-ui border border-line bg-surface focus-within:border-brand">
            <button type="button" aria-label="Decrease quantity" className={stepButton} disabled={!(Number(quantity) - by >= option.min)} onClick={() => change(-by)}>
              <Icon name="minus" className="size-4" />
            </button>
            <input
              id="atc-qty"
              type="number"
              inputMode="numeric"
              min={option.min}
              max={option.max}
              step={step}
              value={quantity}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setQuantity(e.target.value)}
              aria-describedby="atc-qty-hint"
              className="h-full w-12 bg-transparent text-center text-base tabular-nums [appearance:textfield] focus:outline-none sm:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button type="button" aria-label="Increase quantity" className={stepButton} disabled={option.max !== undefined && Number(quantity) + by > option.max} onClick={() => change(by)}>
              <Icon name="plus" className="size-4" />
            </button>
          </div>
        </Field>
        <Button type="submit" disabled={pending || !option.available} className="mb-[1.375rem] px-6">
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
