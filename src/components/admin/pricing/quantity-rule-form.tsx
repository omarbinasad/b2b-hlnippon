"use client";

import { useState, useTransition } from "react";
import { saveQuantityRuleAction } from "@/app/admin/pricing/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import type { RuleProductOption } from "@/lib/data/repositories";
import { validateQuantityRule } from "@/lib/pricing/engine";
import type { Category, FieldErrors, ProductPick, QuantityLimitRule, RuleTarget } from "@/lib/types";
import { TargetPicker } from "./target-picker";

const optNum = (s: string) => (s.trim() === "" ? undefined : Number(s));

export function QuantityRuleForm({
  rule,
  categories,
  initialPicks,
  initialProduct,
}: {
  rule?: QuantityLimitRule;
  categories: Pick<Category, "id" | "name" | "parentId">[];
  initialPicks: ProductPick[];
  initialProduct: RuleProductOption | null;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [enabled, setEnabled] = useState((rule?.status ?? "active") === "active");
  const [target, setTarget] = useState<RuleTarget>(rule?.target ?? { type: "categories", categoryIds: [] });
  const [min, setMin] = useState(rule?.minQuantity !== undefined ? String(rule.minQuantity) : "");
  const [max, setMax] = useState(rule?.maxQuantity !== undefined ? String(rule.maxQuantity) : "");
  const [priority, setPriority] = useState(String(rule?.priority ?? 0));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const input = {
      name,
      status: enabled ? ("active" as const) : ("disabled" as const),
      target,
      minQuantity: optNum(min),
      maxQuantity: optNum(max),
      priority: priority.trim() === "" ? Number.NaN : Number(priority),
    };
    const local = validateQuantityRule(input);
    if (Object.keys(local).length) {
      setErrors(local);
      setMessage("Some fields need attention.");
      return;
    }
    startTransition(async () => {
      const result = await saveQuantityRuleAction(rule?.id ?? null, input);
      if (!result) return;
      if (!result.ok) {
        setErrors(result.errors);
        setMessage(result.message);
      }
    });
  };

  const num = (id: string, label: string, value: string, set: (v: string) => void, key: string, hint: string) => (
    <Field id={id} label={label} error={errors[key]} hint={hint}>
      <Input id={id} type="number" inputMode="numeric" min={1} step={1} value={value} onChange={(e) => set(e.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${id}-error` : `${id}-hint`} />
    </Field>
  );

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
          <Field id="qr-name" label="Name" required error={errors.name}>
            <Input id="qr-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-invalid={Boolean(errors.name)} />
          </Field>
          {num("qr-priority", "Priority", priority, setPriority, "priority", "Higher wins a tie.")}
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-4 accent-brand" />
          Enabled
        </label>
      </Card>

      <Card title="Products">
        <TargetPicker
          value={target}
          onChange={setTarget}
          categories={categories}
          initialPicks={initialPicks}
          initialProduct={initialProduct}
          error={errors.target}
          note="Limits apply to each order line separately. A category rule of “max 10” allows 10 of every product in the category — it does not limit the combined category quantity."
        />
      </Card>

      <Card title="Limits per order line" description="Leave a field empty for no limit. A more specific rule (variation > product > category > all) replaces broader ones completely.">
        <div className="grid gap-4 sm:grid-cols-2">
          {num("qr-min", "Minimum quantity", min, setMin, "minQuantity", "Empty = 1.")}
          {num("qr-max", "Maximum quantity", max, setMax, "maxQuantity", "Empty = no maximum.")}
        </div>
      </Card>

      <p role="alert" className="text-sm text-danger">{message}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <ButtonLink href="/admin/pricing/quantity" variant="secondary">Cancel</ButtonLink>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : rule ? "Save rule" : "Create rule"}</Button>
      </div>
    </form>
  );
}
