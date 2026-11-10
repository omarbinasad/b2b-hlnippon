"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";
import type { Money } from "@/lib/types";

/** Slider step for a price span: fine for small ranges, coarser for large ones. */
const stepFor = (span: number) => (span <= 5_000 ? 10 : span <= 50_000 ? 100 : 1_000);

/**
 * Two-handle price slider for the shop's GET filter form. Hidden inputs carry `min` / `max`, left out when a handle is
 * at the end of the range (no limit on that side). The bounds and the filtering itself come from the server.
 */
export function PriceRange({ bounds, min, max }: { bounds: { min: Money; max: Money }; min?: number; max?: number }) {
  const step = stepFor(bounds.max - bounds.min);
  const lowest = Math.floor(bounds.min / step) * step;
  const highest = Math.max(Math.ceil(bounds.max / step) * step, lowest + step);
  const clamp = (v: number) => Math.min(highest, Math.max(lowest, v));
  const [low, setLow] = useState(clamp(min ?? lowest));
  const [high, setHigh] = useState(clamp(max ?? highest));
  const percent = (v: number) => ((v - lowest) / (highest - lowest)) * 100;

  return (
    <div>
      <p className="flex items-center justify-between text-sm font-semibold tabular-nums" aria-live="polite">
        <span>{formatMoney(low)}</span>
        <span className="text-xs font-normal text-muted">to</span>
        <span>{formatMoney(high)}</span>
      </p>
      <div className="price-range relative mt-3 h-5">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line" />
        <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand" style={{ left: `${percent(low)}%`, right: `${100 - percent(high)}%` }} />
        <input
          type="range"
          aria-label="Minimum price"
          aria-valuetext={formatMoney(low)}
          min={lowest}
          max={highest}
          step={step}
          value={low}
          onChange={(e) => setLow(Math.min(Number(e.target.value), high))}
          // When both handles meet at the top end, the minimum handle must stay reachable.
          className={low >= highest ? "z-20" : "z-10"}
        />
        <input
          type="range"
          aria-label="Maximum price"
          aria-valuetext={formatMoney(high)}
          min={lowest}
          max={highest}
          step={step}
          value={high}
          onChange={(e) => setHigh(Math.max(Number(e.target.value), low))}
          className="z-10"
        />
      </div>
      {low > lowest && <input type="hidden" name="min" value={low} />}
      {high < highest && <input type="hidden" name="max" value={high} />}
    </div>
  );
}
