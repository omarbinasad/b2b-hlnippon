"use client";

import { useState } from "react";

const stepButton = "grid size-7 place-items-center rounded-ui bg-brand-soft text-brand hover:bg-brand hover:text-brand-contrast disabled:opacity-40 disabled:hover:bg-brand-soft disabled:hover:text-brand";

/**
 * − / + quantity control for a cart line (cart page and cart panel). The number can also be typed; it is sent on
 * Enter or when leaving the field. 0 removes the line. The server re-checks every quantity.
 */
export function CartQuantityStepper({ name, quantity, min, max, step, disabled, invalid, onChange }: {
  name: string;
  quantity: number;
  min: number;
  max?: number;
  step: number;
  disabled: boolean;
  invalid?: boolean;
  onChange: (quantity: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const by = Math.max(1, step);

  const commit = () => {
    if (draft === null) return;
    const q = Number(draft);
    setDraft(null);
    if (draft.trim() !== "" && Number.isInteger(q) && q >= 0 && q !== quantity) onChange(q);
  };

  return (
    <div className={`inline-flex items-center gap-1 rounded-ui border p-0.5 focus-within:border-brand ${invalid ? "border-danger" : "border-line"}`}>
      <button type="button" className={stepButton} disabled={disabled || quantity - by < Math.max(1, min)} onClick={() => onChange(quantity - by)} aria-label={`Decrease quantity of ${name}`}>−</button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={by}
        value={draft ?? quantity}
        disabled={disabled}
        aria-label={`Quantity of ${name}`}
        aria-invalid={invalid || undefined}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit())}
        className="h-7 w-10 bg-transparent text-center text-base tabular-nums [appearance:textfield] focus:outline-none sm:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button type="button" className={stepButton} disabled={disabled || (max !== undefined && quantity + by > max)} onClick={() => onChange(quantity + by)} aria-label={`Increase quantity of ${name}`}>+</button>
    </div>
  );
}
