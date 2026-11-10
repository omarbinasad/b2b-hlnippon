"use client";

import { useState, useTransition } from "react";
import { applyCouponAction, removeCouponAction } from "@/app/(store)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { formatMoney } from "@/lib/format";
import type { Cart } from "@/lib/types";

/** Enter or remove a coupon. The discount is worked out on the server. */
export function CouponField({ coupon, onChange }: { coupon: Cart["coupon"]; onChange: (cart: Cart) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const apply = () =>
    start(async () => {
      const r = await applyCouponAction(code);
      if (!r.ok) return setError(r.message);
      setError("");
      setCode("");
      onChange(r.cart);
    });
  if (coupon) {
    return (
      <div className="space-y-1 rounded-ui bg-surface-muted p-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span>Coupon <strong>{coupon.code}</strong></span>
          {coupon.discount !== undefined && <span className="font-semibold tabular-nums">−{formatMoney(coupon.discount)}</span>}
        </div>
        {coupon.error && <p role="alert" className="text-xs text-danger">{coupon.error}</p>}
        <button type="button" disabled={pending} onClick={() => start(async () => { const r = await removeCouponAction(); if (r.ok) onChange(r.cart); })} className="text-xs font-medium text-brand hover:underline">Remove coupon</button>
      </div>
    );
  }
  return (
    <div>
      <label htmlFor="coupon-code" className="mb-1 block text-sm font-medium">Coupon code</label>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1"><Input id="coupon-code" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } }} aria-invalid={Boolean(error)} aria-describedby={error ? "coupon-error" : undefined} /></div>
        <Button variant="secondary" disabled={pending || !code.trim()} onClick={apply}>Apply</Button>
      </div>
      {error && <p id="coupon-error" role="alert" className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
