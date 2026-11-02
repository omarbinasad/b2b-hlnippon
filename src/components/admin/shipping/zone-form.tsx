"use client";

import { useState, useTransition } from "react";
import { saveZoneAction } from "@/app/admin/shipping/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { siteConfig } from "@/config/site";
import { JP_PREFECTURES } from "@/lib/locations";
import { methodTypeLabel, validateZone } from "@/lib/shipping/engine";
import type { ClassAdjustment, FieldErrors, ShippingClass, ShippingMethod, ShippingZone, ZoneLocation } from "@/lib/types";
import { AMOUNT_STEP } from "@/lib/orders/calc";

/* Drafts keep typed strings; they are converted (kg → grams, text → numbers) on save. */
type LocationDraft = { key: string; type: ZoneLocation["type"]; prefecture: string; city: string; postalCode: string };
type TierDraft = { key: string; from: string; cost: string };
type AdjDraft = { key: string; shippingClassId: string; amount: string; per: ClassAdjustment["per"] };
type MethodDraft = {
  key: string;
  id: string;
  type: ShippingMethod["type"];
  name: string;
  enabled: boolean;
  cost: string;
  minSubtotal: string;
  instructions: string;
  tiers: TierDraft[];
  adjustments: AdjDraft[];
};

let seq = 0;
const k = () => `k${++seq}`;
const n = (s: string) => (s.trim() === "" ? Number.NaN : Number(s));

const toLocationDraft = (l: ZoneLocation): LocationDraft => ({
  key: k(),
  type: l.type,
  prefecture: l.type === "postcode" ? "" : l.prefecture,
  city: l.type === "city" ? l.city : "",
  postalCode: l.type === "postcode" ? l.postalCode : "",
});

function toMethodDraft(m: ShippingMethod): MethodDraft {
  const weight = m.type === "weight_tiers";
  return {
    key: k(),
    id: m.id,
    type: m.type,
    name: m.name,
    enabled: m.enabled,
    cost: "cost" in m ? String(m.cost) : "0",
    minSubtotal: m.type === "free_shipping" ? String(m.minSubtotal) : "",
    instructions: m.type === "local_pickup" ? (m.instructions ?? "") : "",
    tiers: "tiers" in m ? m.tiers.map((t) => ({ key: k(), from: String(weight ? t.from / 1000 : t.from), cost: String(t.cost) })) : [{ key: k(), from: "0", cost: "" }],
    adjustments: "classAdjustments" in m ? m.classAdjustments.map((a) => ({ key: k(), shippingClassId: a.shippingClassId, amount: String(a.amount), per: a.per })) : [],
  };
}

const newMethod = (type: ShippingMethod["type"]): MethodDraft => ({
  key: k(),
  id: "",
  type,
  name: methodTypeLabel[type],
  enabled: true,
  cost: type === "local_pickup" ? "0" : "",
  minSubtotal: "",
  instructions: "",
  tiers: [{ key: k(), from: "0", cost: "" }],
  adjustments: [],
});

function fromLocationDraft(l: LocationDraft): ZoneLocation {
  if (l.type === "postcode") return { type: "postcode", postalCode: l.postalCode.trim() };
  if (l.type === "city") return { type: "city", prefecture: l.prefecture, city: l.city.trim() };
  return { type: "prefecture", prefecture: l.prefecture };
}

function fromMethodDraft(m: MethodDraft): ShippingMethod {
  const base = { id: m.id, name: m.name, enabled: m.enabled };
  const adj = m.adjustments.map((a) => ({ shippingClassId: a.shippingClassId, amount: n(a.amount), per: a.per }));
  const tiers = m.tiers.map((t) => ({ from: m.type === "weight_tiers" ? Math.round(n(t.from) * 1000) : n(t.from), cost: n(t.cost) }));
  switch (m.type) {
    case "flat_rate":
      return { ...base, type: m.type, cost: n(m.cost), classAdjustments: adj };
    case "weight_tiers":
    case "subtotal_tiers":
      return { ...base, type: m.type, tiers, classAdjustments: adj };
    case "free_shipping":
      return { ...base, type: m.type, minSubtotal: n(m.minSubtotal) };
    case "local_pickup":
      return { ...base, type: m.type, cost: n(m.cost), instructions: m.instructions.trim() || undefined };
  }
}

export function ZoneForm({ zone, others, classes }: { zone?: ShippingZone; others: ShippingZone[]; classes: ShippingClass[] }) {
  const isFallback = zone?.isFallback ?? false;
  const [name, setName] = useState(zone?.name ?? "");
  const [locations, setLocations] = useState<LocationDraft[]>(zone ? zone.locations.map(toLocationDraft) : [{ key: k(), type: "city", prefecture: "Tokyo", city: "", postalCode: "" }]);
  const [methods, setMethods] = useState<MethodDraft[]>(zone ? zone.methods.map(toMethodDraft) : [newMethod("flat_rate")]);
  const [addType, setAddType] = useState<ShippingMethod["type"]>("flat_rate");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const cur = siteConfig.currencySymbol;

  const updateLoc = (key: string, c: Partial<LocationDraft>) => setLocations((ls) => ls.map((l) => (l.key === key ? { ...l, ...c } : l)));
  const updateMethod = (key: string, c: Partial<MethodDraft>) => setMethods((ms) => ms.map((m) => (m.key === key ? { ...m, ...c } : m)));
  const move = (i: number, d: -1 | 1) =>
    setMethods((ms) => {
      const next = [...ms];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  const submit = () => {
    const input = { name, locations: locations.map(fromLocationDraft), methods: methods.map(fromMethodDraft) };
    const local = validateZone(input, { isFallback, others, classIds: classes.map((c) => c.id) });
    if (Object.keys(local).length) {
      setErrors(local);
      setMessage("Some fields need attention.");
      return;
    }
    startTransition(async () => {
      const result = await saveZoneAction(zone?.id ?? null, input);
      if (!result) return;
      if (!result.ok) {
        setErrors(result.errors);
        setMessage(result.message);
      }
    });
  };

  const methodErrors = (i: number) => Object.entries(errors).filter(([key]) => key.startsWith(`methods.${i}.`));

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-6"
    >
      <Card title="Zone">
        <Field id="zone-name" label="Name" required error={errors.name}>
          <Input id="zone-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "zone-name-error" : undefined} />
        </Field>
      </Card>

      <Card
        title="Covers"
        description={
          isFallback
            ? "This is the fallback zone: it applies to every address that no other zone matches, including addresses with an unknown city or no postcode."
            : "Add prefectures, cities or postcodes. The most specific match wins (postcode > city > prefecture). Each location can be in one zone only."
        }
      >
        {!isFallback && (
          <div className="space-y-2">
            {errors.locations && <p className="text-xs text-danger">{errors.locations}</p>}
            {locations.map((l, i) => (
              <div key={l.key} className="rounded-ui border border-line p-3">
                <div className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                  <div>
                    <label htmlFor={`loc-${l.key}-type`} className="block text-xs font-medium">Match by</label>
                    <Select id={`loc-${l.key}-type`} value={l.type} onChange={(e) => updateLoc(l.key, { type: e.target.value as ZoneLocation["type"] })}>
                      <option value="prefecture">Prefecture</option>
                      <option value="city">City</option>
                      <option value="postcode">Postcode</option>
                    </Select>
                  </div>
                  {l.type !== "postcode" ? (
                    <div>
                      <label htmlFor={`loc-${l.key}-prefecture`} className="block text-xs font-medium">Prefecture</label>
                      <Select id={`loc-${l.key}-prefecture`} value={l.prefecture} onChange={(e) => updateLoc(l.key, { prefecture: e.target.value })}>
                        <option value="">Choose…</option>
                        {JP_PREFECTURES.map((d) => <option key={d} value={d}>{d}</option>)}
                      </Select>
                    </div>
                  ) : (
                    <div>
                      <label htmlFor={`loc-${l.key}-postcode`} className="block text-xs font-medium">Postcode (7 digits)</label>
                      <Input id={`loc-${l.key}-postcode`} inputMode="numeric" maxLength={4} value={l.postalCode} onChange={(e) => updateLoc(l.key, { postalCode: e.target.value.replace(/\D/g, "") })} />
                    </div>
                  )}
                  {l.type === "city" ? (
                    <div>
                      <label htmlFor={`loc-${l.key}-city`} className="block text-xs font-medium">City</label>
                      <Input id={`loc-${l.key}-city`} value={l.city} onChange={(e) => updateLoc(l.key, { city: e.target.value })} placeholder="e.g. Gazipur" />
                    </div>
                  ) : (
                    <div className="hidden sm:block" />
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setLocations((ls) => ls.filter((x) => x.key !== l.key))} aria-label={`Remove location ${i + 1}`}>
                    <Icon name="trash" className="size-4" />
                  </Button>
                </div>
                {errors[`locations.${i}`] && <p className="mt-1.5 text-xs text-danger">{errors[`locations.${i}`]}</p>}
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setLocations((ls) => [...ls, { key: k(), type: "city", prefecture: "Tokyo", city: "", postalCode: "" }])}>
              <Icon name="plus" className="size-4" /> Add location
            </Button>
            <p className="text-xs text-muted">
              Postcode zones only match addresses that include that exact postcode; addresses entered without a postcode match by city or prefecture.
            </p>
          </div>
        )}
      </Card>

      <Card title="Shipping methods" description="Order matters only to break ties: when two delivery methods cost the same, the one listed first is suggested.">
        <div className="space-y-4">
          {errors.methods && <p className="text-xs text-danger">{errors.methods}</p>}
          {methods.map((m, i) => {
            const p = (f: string) => `m-${m.key}-${f}`;
            const e = (f: string) => errors[`methods.${i}.${f}`];
            const tiered = m.type === "weight_tiers" || m.type === "subtotal_tiers";
            const hasAdj = m.type === "flat_rate" || tiered;
            return (
              <fieldset key={m.key} className="space-y-3 rounded-ui border border-line p-3">
                <legend className="px-1 text-sm font-semibold">{methodTypeLabel[m.type]}</legend>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <Field id={p("name")} label="Name" required error={e("name")}>
                    <Input id={p("name")} value={m.name} onChange={(ev) => updateMethod(m.key, { name: ev.target.value })} maxLength={80} />
                  </Field>
                  <div className="flex flex-wrap items-center gap-1">
                    <label className="mr-2 inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={m.enabled} onChange={(ev) => updateMethod(m.key, { enabled: ev.target.checked })} className="size-4 accent-brand" />
                      Enabled
                    </label>
                    <Button variant="ghost" size="sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${m.name} up`}><Icon name="arrowUp" className="size-4" /></Button>
                    <Button variant="ghost" size="sm" disabled={i === methods.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${m.name} down`}><Icon name="arrowDown" className="size-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setMethods((ms) => ms.filter((x) => x.key !== m.key))} aria-label={`Remove ${m.name}`}><Icon name="trash" className="size-4" /></Button>
                  </div>
                </div>

                {(m.type === "flat_rate" || m.type === "local_pickup") && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field id={p("cost")} label={`${m.type === "local_pickup" ? "Pickup charge" : "Charge per order"} (${cur})`} required error={e("cost")}>
                      <Input id={p("cost")} type="number" inputMode="decimal" min={0} step={AMOUNT_STEP} value={m.cost} onChange={(ev) => updateMethod(m.key, { cost: ev.target.value })} />
                    </Field>
                    {m.type === "local_pickup" && (
                      <Field id={p("instructions")} label="Pickup instructions">
                        <Input id={p("instructions")} value={m.instructions} onChange={(ev) => updateMethod(m.key, { instructions: ev.target.value })} maxLength={300} />
                      </Field>
                    )}
                  </div>
                )}

                {m.type === "free_shipping" && (
                  <Field id={p("min")} label={`Free when the items subtotal is at least (${cur})`} required error={e("minSubtotal")}>
                    <Input id={p("min")} type="number" inputMode="decimal" min={0} step={AMOUNT_STEP} value={m.minSubtotal} onChange={(ev) => updateMethod(m.key, { minSubtotal: ev.target.value })} className="sm:w-48" />
                  </Field>
                )}

                {tiered && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted">
                      Each tier applies from its value up to the next tier. The first tier starts at 0 so every cart is covered; values must increase.
                    </p>
                    {e("tiers") && <p className="text-xs text-danger">{e("tiers")}</p>}
                    {m.tiers.map((t, ti) => (
                      <div key={t.key}>
                        <div className="flex flex-wrap items-end gap-2">
                          <div>
                            <label htmlFor={p(`tf-${t.key}`)} className="block text-xs font-medium">From ({m.type === "weight_tiers" ? "kg" : cur})</label>
                            <Input
                              id={p(`tf-${t.key}`)}
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step={m.type === "weight_tiers" ? "0.001" : "0.01"}
                              value={t.from}
                              disabled={ti === 0}
                              onChange={(ev) => updateMethod(m.key, { tiers: m.tiers.map((x) => (x.key === t.key ? { ...x, from: ev.target.value } : x)) })}
                              className="w-32"
                            />
                          </div>
                          <div>
                            <label htmlFor={p(`tc-${t.key}`)} className="block text-xs font-medium">Charge ({cur})</label>
                            <Input
                              id={p(`tc-${t.key}`)}
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step={AMOUNT_STEP}
                              value={t.cost}
                              onChange={(ev) => updateMethod(m.key, { tiers: m.tiers.map((x) => (x.key === t.key ? { ...x, cost: ev.target.value } : x)) })}
                              className="w-32"
                            />
                          </div>
                          <span className="pb-2 text-xs text-muted">
                            {m.tiers[ti + 1] ? `up to ${m.tiers[ti + 1].from || "…"} ${m.type === "weight_tiers" ? "kg" : cur}` : "and above"}
                          </span>
                          {ti > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => updateMethod(m.key, { tiers: m.tiers.filter((x) => x.key !== t.key) })} aria-label={`Remove tier ${ti + 1}`}>
                              <Icon name="trash" className="size-4" />
                            </Button>
                          )}
                        </div>
                        {(e(`tiers.${ti}.from`) || e(`tiers.${ti}.cost`)) && <p className="mt-1 text-xs text-danger">{[e(`tiers.${ti}.from`), e(`tiers.${ti}.cost`)].filter(Boolean).join(" ")}</p>}
                      </div>
                    ))}
                    <Button variant="secondary" size="sm" onClick={() => updateMethod(m.key, { tiers: [...m.tiers, { key: k(), from: "", cost: "" }] })}>
                      <Icon name="plus" className="size-4" /> Add tier
                    </Button>
                  </div>
                )}

                {hasAdj && (
                  <div className="space-y-2 border-t border-line pt-3">
                    <p className="text-xs font-medium">Shipping-class adjustments</p>
                    {m.adjustments.map((a, ai) => (
                      <div key={a.key}>
                        <div className="flex flex-wrap items-end gap-2">
                          <Select aria-label="Shipping class" value={a.shippingClassId} onChange={(ev) => updateMethod(m.key, { adjustments: m.adjustments.map((x) => (x.key === a.key ? { ...x, shippingClassId: ev.target.value } : x)) })} className="w-48">
                            <option value="">Choose class…</option>
                            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </Select>
                          <Input aria-label={`Amount (${cur})`} type="number" inputMode="decimal" min={0} step={AMOUNT_STEP} value={a.amount} onChange={(ev) => updateMethod(m.key, { adjustments: m.adjustments.map((x) => (x.key === a.key ? { ...x, amount: ev.target.value } : x)) })} className="w-28" placeholder={cur} />
                          <Select aria-label="Charged" value={a.per} onChange={(ev) => updateMethod(m.key, { adjustments: m.adjustments.map((x) => (x.key === a.key ? { ...x, per: ev.target.value as AdjDraft["per"] } : x)) })} className="w-36">
                            <option value="order">per order</option>
                            <option value="unit">per unit</option>
                          </Select>
                          <Button variant="ghost" size="sm" onClick={() => updateMethod(m.key, { adjustments: m.adjustments.filter((x) => x.key !== a.key) })} aria-label="Remove adjustment">
                            <Icon name="trash" className="size-4" />
                          </Button>
                        </div>
                        {e(`classAdjustments.${ai}`) && <p className="mt-1 text-xs text-danger">{e(`classAdjustments.${ai}`)}</p>}
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" onClick={() => updateMethod(m.key, { adjustments: [...m.adjustments, { key: k(), shippingClassId: "", amount: "", per: "order" }] })}>
                      <Icon name="plus" className="size-4" /> Add class adjustment
                    </Button>
                  </div>
                )}
                {methodErrors(i).length > 0 && <p className="sr-only" role="alert">{methodErrors(i).map(([, v]) => v).join(" ")}</p>}
              </fieldset>
            );
          })}
          <div className="flex flex-wrap items-end gap-2">
            <Field id="add-method-type" label="Add a method">
              <Select id="add-method-type" value={addType} onChange={(e) => setAddType(e.target.value as ShippingMethod["type"])} className="w-56">
                {Object.entries(methodTypeLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
            <Button variant="secondary" onClick={() => setMethods((ms) => [...ms, newMethod(addType)])}>
              <Icon name="plus" className="size-4" /> Add
            </Button>
          </div>
        </div>
      </Card>

      <p role="alert" className="text-sm text-danger">{message}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <ButtonLink href="/admin/shipping" variant="secondary">Cancel</ButtonLink>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : zone ? "Save zone" : "Create zone"}</Button>
      </div>
    </form>
  );
}
