"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { siteConfig } from "@/config/site";
import { cx } from "@/lib/cx";
import { formatMoney } from "@/lib/format";
import { adjustedPrice, tierFor, tierLabel } from "@/lib/pricing/engine";
import type { FieldErrors, PriceAdjustment, PriceTier } from "@/lib/types";
import { AMOUNT_STEP } from "@/lib/orders/calc";

/** Editable tier row (strings while typing). */
export interface TierDraft {
  key: string;
  minQuantity: string;
  maxQuantity: string;
  type: PriceAdjustment["type"];
  value: string;
}

let seq = 0;
export const tierDraft = (t?: PriceTier): TierDraft => ({
  key: `t${++seq}`,
  minQuantity: t ? String(t.minQuantity) : "1",
  maxQuantity: t?.maxQuantity !== undefined ? String(t.maxQuantity) : "",
  type: t?.adjustment.type ?? "percent_off",
  value: t ? String(t.adjustment.type === "percent_off" ? t.adjustment.percent : t.adjustment.amount) : "",
});

const n = (s: string) => (s.trim() === "" ? Number.NaN : Number(s));

export function toTier(d: TierDraft): PriceTier {
  const value = n(d.value);
  const adjustment: PriceAdjustment = d.type === "percent_off" ? { type: d.type, percent: value } : { type: d.type, amount: value };
  return { minQuantity: n(d.minQuantity), maxQuantity: d.maxQuantity.trim() === "" ? undefined : n(d.maxQuantity), adjustment };
}

const TYPE_LABELS: Record<PriceAdjustment["type"], string> = { fixed_price: "Fixed unit price", amount_off: "Amount off", percent_off: "Percent off" };

/** Quantity tiers with a live preview of the tier that applies and the resulting price. */
export function TiersEditor({ tiers, onChange, errors, examplePrice }: { tiers: TierDraft[]; onChange: (t: TierDraft[]) => void; errors: FieldErrors; examplePrice?: number }) {
  const [base, setBase] = useState(String(examplePrice ?? 1000));
  const [qty, setQty] = useState("1");
  const update = (key: string, change: Partial<TierDraft>) => onChange(tiers.map((t) => (t.key === key ? { ...t, ...change } : t)));
  const parsed = tiers.map(toTier);
  const baseNum = n(base);
  const qtyNum = n(qty);
  const active = Number.isInteger(qtyNum) && qtyNum > 0 ? tierFor(parsed, qtyNum) : undefined;
  const preview = (t: PriceTier) => {
    if (!Number.isFinite(baseNum) || baseNum < 0) return undefined;
    const v = t.adjustment.type === "percent_off" ? t.adjustment.percent : t.adjustment.amount;
    if (!Number.isFinite(v)) return undefined;
    try {
      return adjustedPrice(baseNum, t.adjustment);
    } catch {
      return undefined;
    }
  };

  return (
    <fieldset id="rule-tiers" tabIndex={-1} className="space-y-3">
      <legend className="text-sm font-semibold">Price and quantity tiers</legend>
      <p className="text-xs text-muted">
        One tier from 1 with no maximum is a plain price. Add tiers for bulk pricing: ranges must not overlap and only the last tier may be open-ended.
        Below the first tier the rule does not apply.
      </p>
      {errors.tiers && <p className="text-xs text-danger">{errors.tiers}</p>}
      <ol className="space-y-2">
        {tiers.map((t, i) => {
          const e = (f: string) => errors[`tiers.${i}.${f}`];
          const id = (f: string) => `tier-${t.key}-${f}`;
          return (
            <li key={t.key} className="rounded-ui border border-line p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[6rem_6rem_minmax(0,1fr)_8rem_auto] sm:items-end">
                <div>
                  <label htmlFor={id("min")} className="block text-xs font-medium">From qty</label>
                  <Input id={id("min")} type="number" inputMode="numeric" min={1} value={t.minQuantity} onChange={(ev) => update(t.key, { minQuantity: ev.target.value })} aria-invalid={Boolean(e("minQuantity"))} />
                </div>
                <div>
                  <label htmlFor={id("max")} className="block text-xs font-medium">To qty</label>
                  <Input id={id("max")} type="number" inputMode="numeric" min={1} placeholder="and above" value={t.maxQuantity} onChange={(ev) => update(t.key, { maxQuantity: ev.target.value })} aria-invalid={Boolean(e("maxQuantity"))} />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label htmlFor={id("type")} className="block text-xs font-medium">Price type</label>
                  <Select id={id("type")} value={t.type} onChange={(ev) => update(t.key, { type: ev.target.value as PriceAdjustment["type"] })}>
                    {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                </div>
                <div>
                  <label htmlFor={id("value")} className="block text-xs font-medium">{t.type === "percent_off" ? "Percent" : `Amount (${siteConfig.currencySymbol})`}</label>
                  <Input id={id("value")} type="number" inputMode="decimal" min={0} step={t.type === "percent_off" ? "0.01" : AMOUNT_STEP} value={t.value} onChange={(ev) => update(t.key, { value: ev.target.value })} aria-invalid={Boolean(e("value"))} />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-end"
                  disabled={tiers.length === 1}
                  onClick={() => onChange(tiers.filter((x) => x.key !== t.key))}
                  aria-label={`Remove tier ${i + 1}`}
                >
                  <Icon name="trash" className="size-4" />
                </Button>
              </div>
              {(e("minQuantity") || e("maxQuantity") || e("value")) && (
                <p className="mt-1.5 text-xs text-danger">{[e("minQuantity"), e("maxQuantity"), e("value")].filter(Boolean).join(" ")}</p>
              )}
            </li>
          );
        })}
      </ol>
      <Button
        variant="secondary"
        size="sm"
        disabled={tiers.length >= 10}
        onClick={() => {
          const last = parsed[parsed.length - 1];
          const next = last && Number.isInteger(last.maxQuantity) ? String(last.maxQuantity! + 1) : last && Number.isInteger(last.minQuantity) ? String(last.minQuantity + 10) : "1";
          onChange([...tiers, { ...tierDraft(), minQuantity: next }]);
        }}
      >
        <Icon name="plus" className="size-4" /> Add tier
      </Button>

      <section aria-labelledby="tier-preview" className="rounded-ui border border-line bg-surface-muted p-3 text-sm">
        <h3 id="tier-preview" className="font-medium">Preview</h3>
        <div className="mt-2 flex flex-wrap gap-3">
          <label className="text-xs">
            Example base price ({siteConfig.currencySymbol})
            <Input type="number" inputMode="decimal" min={0} step={AMOUNT_STEP} value={base} onChange={(e) => setBase(e.target.value)} className="mt-1 w-32" />
          </label>
          <label className="text-xs">
            Quantity
            <Input type="number" inputMode="numeric" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className="mt-1 w-24" />
          </label>
        </div>
        <table className="mt-3 w-full text-left text-xs">
          <thead>
            <tr className="text-muted">
              <th scope="col" className="py-1 font-medium">Qty</th>
              <th scope="col" className="py-1 font-medium">Rule</th>
              <th scope="col" className="py-1 text-right font-medium">Unit price</th>
            </tr>
          </thead>
          <tbody>
            {parsed.map((t, i) => {
              const price = preview(t);
              const on = active === t;
              return (
                <tr key={tiers[i].key} className={cx("border-t border-line", on && "font-semibold text-brand")}>
                  <td className="py-1">{Number.isFinite(t.minQuantity) ? tierLabel(t) : "—"}{on && " ← applies"}</td>
                  <td className="py-1">{TYPE_LABELS[t.adjustment.type]}</td>
                  <td className="py-1 text-right tabular-nums">{price === undefined ? "—" : price === null ? "negative — invalid" : formatMoney(price)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p role="status" className="mt-2 text-xs">
          {active ? `At quantity ${qtyNum}: tier ${tierLabel(active)} applies.` : Number.isInteger(qtyNum) && qtyNum > 0 ? `At quantity ${qtyNum}: no tier applies, so this rule is skipped (another rule or the base price is used).` : ""}
        </p>
        <p className="mt-1 text-xs text-muted">Demo calculation for checking the tiers — real prices are calculated and enforced by the backend.</p>
      </section>
    </fieldset>
  );
}
