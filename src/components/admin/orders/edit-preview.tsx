"use client";

import { useEffect, useState } from "react";
import { previewOrderEditAction } from "@/app/admin/orders/actions";
import { formatMoney } from "@/lib/format";
import type { OrderEditPreview } from "@/lib/types";

type PreviewState = { key: string; preview?: OrderEditPreview; message?: string };

/**
 * Server-calculated before/after totals for an order edit (same validation and calculation as saving),
 * refreshed shortly after the input stops changing. `edit` null = nothing to preview yet.
 */
export function useEditPreview(orderId: string, edit: object | null) {
  const key = edit ? JSON.stringify(edit) : "";
  const [state, setState] = useState<PreviewState>({ key: "" });

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const r = await previewOrderEditAction(orderId, JSON.parse(key));
      if (!cancelled) setState(r.ok ? { key, preview: r.preview } : { key, message: r.message });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderId, key]);

  const current = key && state.key === key ? state : undefined;
  return { preview: current?.preview, message: current?.message, loading: Boolean(key) && !current };
}

/** Preview box shown in every order edit dialog. */
export function EditPreview({ id, preview, message, loading, lineLabel = "Line total", idle }: {
  id: string;
  preview?: OrderEditPreview;
  message?: string;
  loading: boolean;
  lineLabel?: string;
  /** Shown before there is anything to preview. */
  idle: string;
}) {
  return (
    <section aria-labelledby={id} aria-live="polite" className="rounded-ui border border-line bg-surface-muted p-3 text-sm">
      <h3 id={id} className="font-medium">Preview</h3>
      {preview ? (
        <dl className="mt-2 space-y-1 tabular-nums [&>div]:flex [&>div]:justify-between [&>div]:gap-4">
          {preview.lineTotal !== undefined && <div><dt>{lineLabel}</dt><dd>{formatMoney(preview.lineTotal)}</dd></div>}
          {preview.orderDiscount > 0 && <div><dt>Order discount</dt><dd>−{formatMoney(preview.orderDiscount)}</dd></div>}
          <div><dt>Order total (incl. tax)</dt><dd>{formatMoney(preview.totalBefore)} → <strong>{formatMoney(preview.totalAfter)}</strong></dd></div>
          <div>
            <dt>Difference</dt>
            <dd className={preview.difference < 0 ? "text-danger" : undefined}>{preview.difference > 0 ? "+" : ""}{formatMoney(preview.difference)}</dd>
          </div>
          {preview.balanceAfter !== undefined && preview.balanceAfter !== 0 && (
            <div>
              <dt>{preview.balanceAfter > 0 ? "Still to collect (already paid)" : "Overpaid — refund due"}</dt>
              <dd className="font-medium">{formatMoney(Math.abs(preview.balanceAfter))}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="mt-1 text-muted">{loading ? "Calculating…" : message ?? idle}</p>
      )}
      <p className="mt-2 text-xs text-muted">The server recalculates and stores the final amounts when you save. Nothing is charged or refunded.</p>
    </section>
  );
}
