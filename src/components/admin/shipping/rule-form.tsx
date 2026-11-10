"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteRuleAction, saveRuleAction } from "@/app/admin/shipping/extras-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { siteConfig } from "@/config/site";
import { formatMoney } from "@/lib/format";
import { addressLabels, regionNames } from "@/lib/locations";
import { amountStep } from "@/lib/orders/calc";
import { describeRule, FIELD_WORDS, isNumberField, type ConditionField, type ConditionOp, type RuleAction, type RuleCondition, type ShippingRule } from "@/lib/shipping/rules";
import type { FieldErrors } from "@/lib/types";

export interface Option {
  value: string;
  label: string;
}

export interface RuleOptions {
  categories: Option[];
  classes: Option[];
  groups: Option[];
  zones: Option[];
}

const BASIC_FIELDS: ConditionField[] = ["subtotal", "weight", "region"];
const ALL_FIELDS = Object.keys(FIELD_WORDS) as ConditionField[];

const blankCondition = (field: ConditionField = "subtotal"): RuleCondition => (isNumberField(field) ? { field, op: "lt", value: 0 } : { field, op: "in", value: [] });

function ConditionRow({ c, i, set, remove, options, error, advanced }: { c: RuleCondition; i: number; set: (c: RuleCondition) => void; remove: () => void; options: RuleOptions; error?: string; advanced: boolean }) {
  const number = isNumberField(c.field);
  const choices: Option[] | undefined =
    c.field === "category" ? options.categories
    : c.field === "shipping_class" ? options.classes
    : c.field === "customer_group" ? options.groups
    : c.field === "region" && regionNames().length ? regionNames().map((r) => ({ value: r, label: r }))
    : undefined;
  const values = Array.isArray(c.value) ? c.value : [];
  const fields = advanced ? ALL_FIELDS : BASIC_FIELDS;
  return (
    <li className="rounded-ui border border-line p-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1fr)_auto] sm:items-start">
        <Select aria-label={`Condition ${i + 1} field`} value={c.field} onChange={(e) => set(blankCondition(e.target.value as ConditionField))}>
          {!fields.includes(c.field) && <option value={c.field}>{FIELD_WORDS[c.field]}</option>}
          {fields.map((f) => <option key={f} value={f}>{f === "region" ? addressLabels().region : FIELD_WORDS[f]}</option>)}
        </Select>
        <Select aria-label={`Condition ${i + 1} comparison`} value={c.op} onChange={(e) => set({ ...c, op: e.target.value as ConditionOp })}>
          {number ? (
            <>
              <option value="lt">is below</option>
              <option value="lte">is up to</option>
              <option value="gt">is above</option>
              <option value="gte">is at least</option>
            </>
          ) : (
            <>
              <option value="in">is</option>
              <option value="not_in">is not</option>
            </>
          )}
        </Select>
        <div>
          {number ? (
            <Input aria-label={`Condition ${i + 1} value`} type="number" min={0} step={c.field === "subtotal" ? amountStep() : "any"} value={String(c.value)} onChange={(e) => set({ ...c, value: e.target.value === "" ? Number.NaN : Number(e.target.value) })} aria-invalid={Boolean(error)} />
          ) : choices ? (
            <Select aria-label={`Condition ${i + 1} value`} value={values[0] ?? ""} onChange={(e) => set({ ...c, value: e.target.value ? [e.target.value] : [] })} aria-invalid={Boolean(error)}>
              <option value="">Choose…</option>
              {choices.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          ) : (
            <Input aria-label={`Condition ${i + 1} value`} placeholder="Separate several with commas" value={values.join(", ")} onChange={(e) => set({ ...c, value: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} aria-invalid={Boolean(error)} />
          )}
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>
        <Button variant="ghost" aria-label={`Remove condition ${i + 1}`} onClick={remove}><Icon name="trash" className="size-4" /></Button>
      </div>
    </li>
  );
}

const NEW_RULE: Omit<ShippingRule, "id"> = { name: "", enabled: true, priority: 10, match: "all", conditions: [blankCondition()], action: { type: "set_charge", amount: 0 }, zoneIds: [] };

export function RuleForm({ rule, options }: { rule?: ShippingRule; options: RuleOptions }) {
  const router = useRouter();
  const [v, setV] = useState<Omit<ShippingRule, "id">>(rule ?? NEW_RULE);
  const [advanced, setAdvanced] = useState(Boolean(rule && (rule.match === "any" || rule.zoneIds.length || rule.conditions.some((c) => !BASIC_FIELDS.includes(c.field)) || !["set_charge", "free"].includes(rule.action.type))));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const sym = siteConfig.currencySymbol;
  const a = v.action;
  const setAction = (type: RuleAction["type"]) =>
    setV({ ...v, action: type === "free" ? { type } : type === "tiers" ? { type, basis: "weight", tiers: [{ from: 0, cost: 0 }] } : type === "hide_method" ? { type, methodType: "flat_rate" } : { type, amount: 0 } });
  const nameOf = (field: ConditionField, value: string) => {
    const list = field === "category" ? options.categories : field === "shipping_class" ? options.classes : field === "customer_group" ? options.groups : [];
    return list.find((o) => o.value === value)?.label ?? value;
  };

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveRuleAction(rule?.id ?? null, v);
          if (!r.ok) {
            setErrors(r.errors);
            setMessage(r.message);
            return;
          }
          router.push("/admin/shipping/rules");
        });
      }}
    >
      <Card title="Rule">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Field id="rule-name" label="Name" required error={errors.name}><Input id="rule-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "rule-name-error" : undefined} /></Field>
          <Field id="rule-priority" label="Priority" error={errors.priority} hint="Lower runs first."><Input id="rule-priority" type="number" min={0} value={String(v.priority)} onChange={(e) => setV({ ...v, priority: Number(e.target.value) })} aria-invalid={Boolean(errors.priority)} /></Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-brand" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} /> Enabled</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-brand" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} /> Advanced options</label>
        </div>
      </Card>

      <Card title="When" description="All conditions must be true unless you choose otherwise. With none, the rule always applies.">
        {advanced && (
          <div className="mb-3 max-w-xs">
            <Field id="rule-match" label="Match">
              <Select id="rule-match" value={v.match} onChange={(e) => setV({ ...v, match: e.target.value === "any" ? "any" : "all" })}>
                <option value="all">All conditions (AND)</option>
                <option value="any">Any condition (OR)</option>
              </Select>
            </Field>
          </div>
        )}
        <ul className="space-y-2">
          {v.conditions.map((c, i) => (
            <ConditionRow key={i} c={c} i={i} advanced={advanced} options={options} error={errors[`conditions.${i}`]} set={(next) => setV({ ...v, conditions: v.conditions.map((x, j) => (j === i ? next : x)) })} remove={() => setV({ ...v, conditions: v.conditions.filter((_, j) => j !== i) })} />
          ))}
        </ul>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => setV({ ...v, conditions: [...v.conditions, blankCondition()] })}><Icon name="plus" className="size-4" /> Add condition</Button>
      </Card>

      <Card title="Then">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="rule-action" label="Action">
            <Select id="rule-action" value={a.type} onChange={(e) => setAction(e.target.value as RuleAction["type"])}>
              <option value="set_charge">Set the shipping charge</option>
              <option value="free">Make delivery free</option>
              {(advanced || a.type === "surcharge") && <option value="surcharge">Add a surcharge</option>}
              {(advanced || a.type === "tiers") && <option value="tiers">Use rate tiers</option>}
              {(advanced || a.type === "hide_method") && <option value="hide_method">Hide a method type</option>}
            </Select>
          </Field>
          {(a.type === "set_charge" || a.type === "surcharge") && (
            <Field id="rule-amount" label={`Amount (${sym})`} required error={errors["action.amount"]}>
              <Input id="rule-amount" type="number" min={0} step={amountStep()} value={Number.isNaN(a.amount) ? "" : String(a.amount)} onChange={(e) => setV({ ...v, action: { ...a, amount: e.target.value === "" ? Number.NaN : Number(e.target.value) } })} aria-invalid={Boolean(errors["action.amount"])} aria-describedby={errors["action.amount"] ? "rule-amount-error" : undefined} />
            </Field>
          )}
          {a.type === "hide_method" && (
            <Field id="rule-hide" label="Method type">
              <Select id="rule-hide" value={a.methodType} onChange={(e) => setV({ ...v, action: { ...a, methodType: e.target.value as typeof a.methodType } })}>
                <option value="flat_rate">Flat rate</option>
                <option value="weight_tiers">Weight-based</option>
                <option value="subtotal_tiers">Order amount-based</option>
                <option value="free_shipping">Free shipping</option>
                <option value="local_pickup">Local pickup</option>
              </Select>
            </Field>
          )}
          {a.type === "tiers" && (
            <div className="sm:col-span-2">
              <Field id="rule-basis" label="Based on">
                <Select id="rule-basis" value={a.basis} onChange={(e) => setV({ ...v, action: { ...a, basis: e.target.value === "subtotal" ? "subtotal" : "weight" } })}>
                  <option value="weight">Cart weight (grams)</option>
                  <option value="subtotal">Order subtotal</option>
                </Select>
              </Field>
              <ul className="mt-2 space-y-2">
                {a.tiers.map((t, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                    <span>From</span>
                    <div className="w-28"><Input aria-label={`Tier ${i + 1} from`} type="number" min={0} value={String(t.from)} onChange={(e) => setV({ ...v, action: { ...a, tiers: a.tiers.map((x, j) => (j === i ? { ...x, from: Number(e.target.value) } : x)) } })} /></div>
                    <span>charge {sym}</span>
                    <div className="w-28"><Input aria-label={`Tier ${i + 1} charge`} type="number" min={0} value={String(t.cost)} onChange={(e) => setV({ ...v, action: { ...a, tiers: a.tiers.map((x, j) => (j === i ? { ...x, cost: Number(e.target.value) } : x)) } })} /></div>
                    <Button variant="ghost" aria-label={`Remove tier ${i + 1}`} onClick={() => setV({ ...v, action: { ...a, tiers: a.tiers.filter((_, j) => j !== i) } })}><Icon name="trash" className="size-4" /></Button>
                  </li>
                ))}
              </ul>
              <Button variant="secondary" size="sm" className="mt-2" onClick={() => setV({ ...v, action: { ...a, tiers: [...a.tiers, { from: (a.tiers.at(-1)?.from ?? 0) + 1000, cost: 0 }] } })}><Icon name="plus" className="size-4" /> Add tier</Button>
              {errors["action.tiers"] && <p className="mt-1 text-sm text-danger">{errors["action.tiers"]}</p>}
            </div>
          )}
        </div>
      </Card>

      {advanced && (
        <Card title="Zones" description="Leave all unticked to apply in every zone.">
          <ul className="grid gap-1 sm:grid-cols-2">
            {options.zones.map((z) => (
              <li key={z.value}><label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-brand" checked={v.zoneIds.includes(z.value)} onChange={(e) => setV({ ...v, zoneIds: e.target.checked ? [...v.zoneIds, z.value] : v.zoneIds.filter((x) => x !== z.value) })} /> {z.label}</label></li>
            ))}
          </ul>
        </Card>
      )}

      <div className="rounded-ui border border-brand bg-brand-soft p-4 text-sm" aria-label="Rule summary">{describeRule({ ...v, conditions: v.conditions.filter((c) => !Number.isNaN(c.value)) }, formatMoney, nameOf)}</div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save rule"}</Button>
        {rule && <Button variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => setConfirming(true)}>Delete rule</Button>}
        <p role="status" className="text-sm text-danger">{message}</p>
      </div>
      <Dialog open={confirming} onClose={() => setConfirming(false)} title={`Delete "${v.name}"?`} description="Past orders keep their shipping charge.">
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(false)}>Keep it</Button>
          <Button variant="danger" disabled={pending} onClick={() => start(async () => { if (rule) await deleteRuleAction(rule.id); router.push("/admin/shipping/rules"); })}>Delete rule</Button>
        </div>
      </Dialog>
    </form>
  );
}
