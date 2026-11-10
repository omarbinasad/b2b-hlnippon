"use client";

import { useState } from "react";
import { QuickAddButton } from "./quick-add-button";

/**
 * Quantity on a product card: − / number / +, then the round add button adds that many. It follows the product's
 * quantity rule (minimum, maximum, pack size), so the number shown is one the cart will accept. The server checks again.
 */
export function CardQuantity({ productId, name, min, max, step, addClassName }: { productId: string; name: string; min: number; max?: number; step: number; addClassName: string }) {
  const by = Math.max(1, step);
  // The smallest amount that meets both the minimum and the pack size.
  const first = Math.max(by, Math.ceil(Math.max(1, min) / by) * by);
  const last = max === undefined ? undefined : Math.floor(max / by) * by;
  const valid = (q: number) => {
    const snapped = Math.max(first, Math.ceil(q / by) * by);
    return last !== undefined ? Math.min(snapped, Math.max(first, last)) : snapped;
  };
  const [quantity, setQuantity] = useState(first);
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    setDraft(null);
    if (draft.trim() !== "" && Number.isFinite(n)) setQuantity(valid(Math.round(n)));
  };
  const button = "grid size-7 sm:size-8 shrink-0 place-items-center rounded-ui text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 sm:gap-2">
      <div className="flex min-w-0 items-center gap-1">
        <button type="button" onClick={() => setQuantity(valid(quantity - by))} disabled={quantity <= first} aria-label={`Decrease quantity of ${name}`} className={`${button} bg-brand-soft text-brand hover:bg-brand/20`}>
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={first}
          max={last}
          step={by}
          value={draft ?? quantity}
          aria-label={`Quantity of ${name}`}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit())}
          className="h-7 w-full min-w-0 max-w-14 flex-1 rounded-ui sm:h-8 border border-line bg-surface text-center text-base font-semibold tabular-nums [appearance:textfield] focus:border-brand focus:outline-none sm:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button type="button" onClick={() => setQuantity(valid(quantity + by))} disabled={last !== undefined && quantity + by > last} aria-label={`Increase quantity of ${name}`} className={`${button} bg-brand text-brand-contrast hover:bg-brand-hover`}>
          +
        </button>
      </div>
      <QuickAddButton productId={productId} name={name} quantity={quantity} className={addClassName} icon="cart" />
    </div>
  );
}
