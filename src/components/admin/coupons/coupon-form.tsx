"use client";

import { useCan } from "@/components/admin/capabilities-context";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { couponTargetSearchAction, deleteCouponAction, saveCouponAction, setCouponEnabledAction } from "@/app/admin/coupons/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { siteConfig } from "@/config/site";
import { amountStep } from "@/lib/orders/calc";
import type { Coupon, CouponType, FieldErrors } from "@/lib/types";

export interface Named {
  id: string;
  label: string;
}

/** Server-side search that adds chosen items as removable chips. */
function SearchPicker({ id, kind, label, hint, value, onChange }: { id: string; kind: "product" | "customer"; label: string; hint: string; value: Named[]; onChange: (v: Named[]) => void }) {
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<Named[] | null>(null);
  const [pending, start] = useTransition();
  return (
    <fieldset>
      <legend className="text-sm font-medium">{label}</legend>
      <p className="text-xs text-muted">{hint}</p>
      <div className="mt-2 flex gap-2">
        <div className="min-w-0 flex-1"><Input id={id} aria-label={`Search ${label.toLowerCase()}`} value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); start(async () => setHits(await couponTargetSearchAction(kind, term))); } }} /></div>
        <Button variant="secondary" disabled={pending || !term.trim()} onClick={() => start(async () => setHits(await couponTargetSearchAction(kind, term)))}>Search</Button>
      </div>
      {hits && (
        <ul className="mt-2 divide-y divide-line rounded-ui border border-line">
          {hits.length ? hits.map((h) => (
            <li key={h.id}><button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-muted" onClick={() => { if (!value.some((v) => v.id === h.id)) onChange([...value, h]); setHits(null); setTerm(""); }}>{h.label}</button></li>
          )) : <li className="px-3 py-2 text-sm text-muted">Nothing found.</li>}
        </ul>
      )}
      {value.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {value.map((v) => (
            <li key={v.id} className="flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1 text-xs">
              {v.label}
              <button type="button" aria-label={`Remove ${v.label}`} className="text-muted hover:text-danger" onClick={() => onChange(value.filter((x) => x.id !== v.id))}><Icon name="close" className="size-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

function Checks({ legend, hint, options, value, onChange }: { legend: string; hint: string; options: Named[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      <p className="text-xs text-muted">{hint}</p>
      <ul className="scrollbar-thin mt-2 grid max-h-44 gap-1 overflow-y-auto sm:grid-cols-2">
        {options.map((o) => (
          <li key={o.id}>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-brand" checked={value.includes(o.id)} onChange={(e) => onChange(e.target.checked ? [...value, o.id] : value.filter((x) => x !== o.id))} />
              {o.label}
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

const asText = (n?: number) => (n === undefined ? "" : String(n));

export function CouponForm({ coupon, categories, groups, names }: { coupon?: Coupon; categories: Named[]; groups: Named[]; names: { products: Named[]; excluded: Named[]; customers: Named[] } }) {
  const can = useCan();
  const router = useRouter();
  const [code, setCode] = useState(coupon?.code ?? "");
  const [description, setDescription] = useState(coupon?.description ?? "");
  const [type, setType] = useState<CouponType>(coupon?.type ?? "percent");
  const [amount, setAmount] = useState(asText(coupon?.amount));
  const [minSpend, setMinSpend] = useState(asText(coupon?.minSpend));
  const [maxSpend, setMaxSpend] = useState(asText(coupon?.maxSpend));
  const [products, setProducts] = useState(names.products);
  const [excluded, setExcluded] = useState(names.excluded);
  const [customers, setCustomers] = useState(names.customers);
  const [categorySlugs, setCategorySlugs] = useState(coupon?.categorySlugs ?? []);
  const [groupIds, setGroupIds] = useState(coupon?.groupIds ?? []);
  const [startsOn, setStartsOn] = useState(coupon?.startsOn ?? "");
  const [expiresOn, setExpiresOn] = useState(coupon?.expiresOn ?? "");
  const [usageLimit, setUsageLimit] = useState(asText(coupon?.usageLimit));
  const [perCustomer, setPerCustomer] = useState(asText(coupon?.usageLimitPerCustomer));
  const [enabled, setEnabled] = useState(coupon?.enabled ?? true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const sym = siteConfig.currencySymbol;

  const num = (id: string, label: string, value: string, set: (v: string) => void, err?: string, hint?: string, step?: string) => (
    <Field id={id} label={label} error={err} hint={hint}>
      <Input id={id} type="number" min={0} step={step} value={value} onChange={(e) => set(e.target.value)} aria-invalid={Boolean(err)} aria-describedby={err ? `${id}-error` : hint ? `${id}-hint` : undefined} />
    </Field>
  );

  const save = () =>
    start(async () => {
      const r = await saveCouponAction(coupon?.id ?? null, { code, description, type, amount, minSpend, maxSpend, productIds: products.map((p) => p.id), excludedProductIds: excluded.map((p) => p.id), customerIds: customers.map((c) => c.id), categorySlugs, groupIds, startsOn, expiresOn, usageLimit, usageLimitPerCustomer: perCustomer, enabled });
      if (!r.ok) {
        setErrors(r.errors);
        setMessage(r.message);
        return;
      }
      setErrors({});
      setMessage("Saved to the demo store.");
      if (!coupon) router.replace(`/admin/coupons/${r.value.id}` as Route);
      else router.refresh();
    });

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); save(); }} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-6">
        <Card title="Discount">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="cp-code" label="Coupon code" required error={errors.code} hint="What the customer types. Not case-sensitive.">
              <Input id="cp-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-invalid={Boolean(errors.code)} aria-describedby={errors.code ? "cp-code-error" : "cp-code-hint"} />
            </Field>
            <Field id="cp-type" label="Discount type">
              <Select id="cp-type" value={type} onChange={(e) => setType(e.target.value as CouponType)}>
                <option value="percent">Percentage discount</option>
                <option value="fixed_cart">Fixed cart discount</option>
                <option value="fixed_product">Fixed product discount (per unit)</option>
              </Select>
            </Field>
            {num("cp-amount", type === "percent" ? "Percentage off" : `Amount off (${sym})`, amount, setAmount, errors.amount, undefined, type === "percent" ? "0.01" : amountStep())}
            <div className="sm:col-span-2"><Field id="cp-description" label="Description" error={errors.description} hint="For staff only."><Textarea id="cp-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field></div>
          </div>
        </Card>
        <Card title="Usage restrictions" description="Leave empty to apply to everything.">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {num("cp-min", `Minimum spend (${sym})`, minSpend, setMinSpend, errors.minSpend, undefined, amountStep())}
              {num("cp-max", `Maximum spend (${sym})`, maxSpend, setMaxSpend, errors.maxSpend, undefined, amountStep())}
            </div>
            <SearchPicker id="cp-products" kind="product" label="Products" hint="Only these products get the discount." value={products} onChange={setProducts} />
            <SearchPicker id="cp-excluded" kind="product" label="Excluded products" hint="These never get the discount." value={excluded} onChange={setExcluded} />
            <Checks legend="Categories" hint="Includes their subcategories." options={categories} value={categorySlugs} onChange={setCategorySlugs} />
            <SearchPicker id="cp-customers" kind="customer" label="Customers" hint="Only these customers can use it." value={customers} onChange={setCustomers} />
            <Checks legend="Customer groups" hint="Members of these groups can use it." options={groups} value={groupIds} onChange={setGroupIds} />
          </div>
        </Card>
      </div>
      <aside className="space-y-4">
        <Card title="Status">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-brand" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enabled</label>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save coupon"}</Button>
            {coupon && can("coupons.delete") && <Button variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => setConfirming(true)}>Delete</Button>}
          </div>
          <p role="status" className={Object.keys(errors).length ? "mt-2 text-sm text-danger" : "mt-2 text-sm text-muted"}>{message}</p>
        </Card>
        <Card title="Dates">
          <div className="space-y-3">
            <Field id="cp-start" label="Starts on"><Input id="cp-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} /></Field>
            <Field id="cp-expires" label="Expires after" error={errors.expiresOn}><Input id="cp-expires" type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} aria-invalid={Boolean(errors.expiresOn)} aria-describedby={errors.expiresOn ? "cp-expires-error" : undefined} /></Field>
          </div>
        </Card>
        <Card title="Usage limits" description={coupon ? `Used ${coupon.usedCount} time${coupon.usedCount === 1 ? "" : "s"} so far.` : undefined}>
          <div className="space-y-3">
            {num("cp-limit", "Total uses", usageLimit, setUsageLimit, errors.usageLimit, undefined, "1")}
            {num("cp-per", "Uses per customer", perCustomer, setPerCustomer, errors.usageLimitPerCustomer, undefined, "1")}
          </div>
        </Card>
      </aside>
      <Dialog open={confirming} onClose={() => setConfirming(false)} title={`Delete ${code}?`} description="Past orders keep their discount. To stop it for now, untick Enabled instead.">
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(false)}>Keep it</Button>
          <Button variant="danger" disabled={pending} onClick={() => start(async () => { if (coupon) await deleteCouponAction(coupon.id); router.push("/admin/coupons"); })}>Delete</Button>
        </div>
      </Dialog>
    </form>
  );
}

export function CouponToggle({ id, enabled, code }: { id: string; enabled: boolean; code: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="inline-flex items-center gap-1.5 text-sm">
      <input type="checkbox" aria-label={`${code} enabled`} className="size-4 accent-brand" disabled={pending} checked={enabled} onChange={(e) => start(async () => { await setCouponEnabledAction(id, e.target.checked); router.refresh(); })} />
      {enabled ? "On" : "Off"}
    </label>
  );
}
