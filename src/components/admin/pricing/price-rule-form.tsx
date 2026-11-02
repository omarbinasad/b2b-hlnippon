"use client";

import { useState, useTransition } from "react";
import { getOrderCustomerAction } from "@/app/admin/orders/actions";
import { savePriceRuleAction } from "@/app/admin/pricing/actions";
import { CustomerPicker } from "@/components/admin/orders/customer-picker";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, Input, Select } from "@/components/ui/field";
import type { RuleProductOption } from "@/lib/data/repositories";
import { validatePriceRule } from "@/lib/pricing/engine";
import type { Category, CustomerGroup, FieldErrors, PriceRule, PriceRuleAudience, ProductPick, RuleTarget } from "@/lib/types";
import { TargetPicker } from "./target-picker";
import { TiersEditor, tierDraft, toTier, type TierDraft } from "./tiers-editor";
import { siteConfig } from "@/config/site";

const AUDIENCES: { value: PriceRuleAudience["type"]; label: string; help: string }[] = [
  { value: "customer", label: "One customer", help: "Highest precedence — overrides group and all-customer rules." },
  { value: "group", label: "Customer group", help: "Every approved customer in the group." },
  { value: "all", label: "All approved customers", help: "Lowest precedence." },
];

const day = (iso?: string) => iso?.slice(0, 10);

export function PriceRuleForm({
  rule,
  groups,
  categories,
  initialPicks,
  initialProduct,
  initialCustomerName,
}: {
  rule?: PriceRule;
  groups: CustomerGroup[];
  categories: Pick<Category, "id" | "name" | "parentId">[];
  initialPicks: ProductPick[];
  initialProduct: RuleProductOption | null;
  initialCustomerName?: string;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [enabled, setEnabled] = useState((rule?.status ?? "active") === "active");
  const [audience, setAudience] = useState<PriceRuleAudience>(rule?.audience ?? { type: "group", groupId: groups[0]?.id ?? "" });
  const [customerName, setCustomerName] = useState(initialCustomerName ?? "");
  const [target, setTarget] = useState<RuleTarget>(rule?.target ?? { type: "categories", categoryIds: [] });
  const [tiers, setTiers] = useState<TierDraft[]>(rule ? rule.tiers.map(tierDraft) : [tierDraft()]);
  const [priority, setPriority] = useState(String(rule?.priority ?? 0));
  const [validFrom, setValidFrom] = useState(day(rule?.validFrom));
  const [validTo, setValidTo] = useState(day(rule?.validTo));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const input = () => ({
    name,
    status: enabled ? ("active" as const) : ("disabled" as const),
    audience,
    target,
    tiers: tiers.map(toTier),
    priority: priority.trim() === "" ? Number.NaN : Number(priority),
    validFrom,
    validTo,
  });

  const submit = () => {
    const i = input();
    // Instant feedback with the shared validator; the server re-validates (plus negative-price checks).
    const local = validatePriceRule({ ...i, validFrom: i.validFrom && `${i.validFrom}T00:00:00${siteConfig.utcOffset}`, validTo: i.validTo && `${i.validTo}T23:59:59${siteConfig.utcOffset}` });
    if (Object.keys(local).length) {
      setErrors(local);
      setMessage("Some fields need attention.");
      return;
    }
    startTransition(async () => {
      const result = await savePriceRuleAction(rule?.id ?? null, i);
      if (!result) return; // saved → redirected
      if (!result.ok) {
        setErrors(result.errors);
        setMessage(result.message);
      }
    });
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-6"
    >
      <Card title="Rule">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Field id="rule-name" label="Name" required error={errors.name} hint="Shown in the rule list, test panel and on order lines.">
            <Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "rule-name-error" : "rule-name-hint"} />
          </Field>
          <Field id="rule-priority" label="Priority" error={errors.priority} hint="Higher wins a tie.">
            <Input id="rule-priority" type="number" inputMode="numeric" step={1} value={priority} onChange={(e) => setPriority(e.target.value)} aria-invalid={Boolean(errors.priority)} aria-describedby={errors.priority ? "rule-priority-error" : "rule-priority-hint"} />
          </Field>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-4 accent-brand" />
          Enabled
        </label>
      </Card>

      <Card title="Customers">
        <fieldset id="rule-audience" tabIndex={-1} className="space-y-3">
          <legend className="sr-only">Applies to customers</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {AUDIENCES.map((a) => (
              <label key={a.value} className="flex cursor-pointer gap-3 rounded-ui border border-line p-3 has-checked:border-brand has-checked:bg-brand-soft">
                <input
                  type="radio"
                  name="audience"
                  checked={audience.type === a.value}
                  onChange={() =>
                    setAudience(a.value === "all" ? { type: "all" } : a.value === "group" ? { type: "group", groupId: groups[0]?.id ?? "" } : { type: "customer", customerId: "" })
                  }
                  className="mt-0.5 accent-brand"
                />
                <span>
                  <span className="block text-sm font-medium">{a.label}</span>
                  <span className="block text-xs text-muted">{a.help}</span>
                </span>
              </label>
            ))}
          </div>
          {audience.type === "group" && (
            <Field id="rule-group" label="Group" error={errors.audience}>
              <Select id="rule-group" value={audience.groupId} onChange={(e) => setAudience({ type: "group", groupId: e.target.value })}>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
            </Field>
          )}
          {audience.type === "customer" &&
            (audience.customerId ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-ui border border-line p-3">
                <p className="text-sm font-medium">{customerName || audience.customerId}</p>
                <Button variant="secondary" size="sm" onClick={() => setAudience({ type: "customer", customerId: "" })}>Change customer</Button>
              </div>
            ) : (
              <CustomerPicker
                id="rule-customer"
                error={errors.audience}
                onPick={(id) =>
                  startTransition(async () => {
                    const c = await getOrderCustomerAction(id);
                    setCustomerName(c?.companyName ?? id);
                    setAudience({ type: "customer", customerId: id });
                  })
                }
              />
            ))}
          <p className="text-xs text-muted">Only approved customers receive rule prices. Pending, rejected and suspended customers never do.</p>
        </fieldset>
      </Card>

      <Card title="Products">
        <TargetPicker value={target} onChange={setTarget} categories={categories} initialPicks={initialPicks} initialProduct={initialProduct} error={errors.target} />
      </Card>

      <Card title="Price">
        <TiersEditor tiers={tiers} onChange={setTiers} errors={errors} />
      </Card>

      <Card title="Valid dates" description="Optional. Store time zone; the end date is inclusive.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="rule-validFrom" label="From">
            <DatePicker id="rule-validFrom" value={validFrom} onChange={setValidFrom} placeholder="Immediately" />
          </Field>
          <Field id="rule-validTo" label="Until" error={errors.validTo}>
            <DatePicker id="rule-validTo" value={validTo} onChange={setValidTo} min={validFrom} placeholder="No end date" />
          </Field>
        </div>
      </Card>

      <p role="alert" className="text-sm text-danger">{message}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <ButtonLink href="/admin/pricing" variant="secondary">Cancel</ButtonLink>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : rule ? "Save rule" : "Create rule"}</Button>
      </div>
    </form>
  );
}
