"use client";

import { useRef, useState, useTransition } from "react";
import { createAttributeValueAction } from "@/app/admin/products/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import type { Attribute } from "@/lib/types";
import { newKey, type AttributeDraft, type ProductDraft, type SectionProps } from "./draft";
import { a11y, Checkbox, ChipsInput, fieldId, GroupError, TextField } from "./form-fields";

/** Renames/removes an attribute everywhere it is referenced (variations, default selection). */
function renameEverywhere(draft: ProductDraft, from: string, to: string | null): Partial<ProductDraft> {
  const move = (rec: Record<string, string>) => {
    if (!(from in rec)) return rec;
    const { [from]: value, ...rest } = rec;
    return to ? { ...rest, [to]: value } : rest;
  };
  return {
    variations: draft.variations.map((v) => ({ ...v, attributes: move(v.attributes) })),
    defaultAttributes: move(draft.defaultAttributes),
  };
}

export function AttributesEditor({ draft, update, errors, storeAttributes }: SectionProps & { storeAttributes: Attribute[] }) {
  const [adding, setAdding] = useState("");
  /** Store values created in this session (the server list arrives as props). */
  const [createdValues, setCreatedValues] = useState<Record<string, string[]>>({});
  const [creating, setCreating] = useState<{ attributeId: string; key: string; name: string } | null>(null);
  const [newValue, setNewValue] = useState("");
  const [createError, setCreateError] = useState("");
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const variable = draft.type === "variable";
  const available = storeAttributes.filter((a) => !draft.attributes.some((x) => x.attributeId === a.id));

  const openCreate = (attr: AttributeDraft) => {
    setCreating({ attributeId: attr.attributeId!, key: attr.key, name: attr.name });
    setNewValue("");
    setCreateError("");
    dialogRef.current?.showModal();
  };
  const submitCreate = () =>
    startTransition(async () => {
      if (!creating) return;
      const result = await createAttributeValueAction(creating.attributeId, newValue);
      if (!result.ok) {
        setCreateError(result.error);
        return;
      }
      const name = result.value.name;
      setCreatedValues((c) => ({ ...c, [creating.attributeId]: [...(c[creating.attributeId] ?? []), name] }));
      update({ attributes: draft.attributes.map((a) => (a.key === creating.key ? { ...a, values: [...a.values, name] } : a)) });
      dialogRef.current?.close();
    });
  const move = (index: number, to: number) => {
    const next = [...draft.attributes];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item);
    update({ attributes: next });
  };

  const patch = (key: string, change: Partial<AttributeDraft>) =>
    draft.attributes.map((a) => (a.key === key ? { ...a, ...change } : a));

  const add = () => {
    const store = storeAttributes.find((a) => a.id === adding);
    const attr: AttributeDraft = store
      ? { key: newKey("attr"), attributeId: store.id, name: store.name, values: [], visible: true, variation: variable }
      : { key: newKey("attr"), name: "", values: [], visible: true, variation: variable };
    update({ attributes: [...draft.attributes, attr] });
    setAdding("");
  };

  return (
    <div className="space-y-3">
      <GroupError path="attributes" errors={errors} />
      {draft.attributes.length === 0 && (
        <p className="text-sm text-muted">
          No attributes yet. {variable ? "Add one such as Size and mark it “Used for variations”." : "Attributes on simple products are shown as product information."}
        </p>
      )}

      {draft.attributes.map((a, i) => {
        const store = storeAttributes.find((s) => s.id === a.attributeId);
        const storeValues = [...new Set([...(store?.values.map((v) => v.name) ?? []), ...(store ? (createdValues[store.id] ?? []) : [])])];
        const extra = a.values.filter((v) => !storeValues.includes(v));
        const valuesPath = `attributes.${i}.values`;
        const valuesA11y = a11y(valuesPath, errors, true);
        return (
          <div key={a.key} className="rounded-ui border border-line p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              {store ? (
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{a.name}</h3>
                  <Badge tone="info">Store attribute</Badge>
                </div>
              ) : (
                <TextField
                  path={`attributes.${i}.name`}
                  label="Attribute name"
                  errors={errors}
                  required
                  className="min-w-48 flex-1"
                  value={a.name}
                  onChange={(name) => update({ ...renameEverywhere(draft, a.name, name), attributes: patch(a.key, { name }) })}
                />
              )}
              <div className="flex items-center gap-1">
                <button type="button" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move ${a.name || "attribute"} up`} className="grid size-8 place-items-center rounded-ui border border-line text-muted hover:text-foreground disabled:opacity-40">
                  <Icon name="arrowUp" className="size-4" />
                </button>
                <button type="button" disabled={i === draft.attributes.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move ${a.name || "attribute"} down`} className="grid size-8 place-items-center rounded-ui border border-line text-muted hover:text-foreground disabled:opacity-40">
                  <Icon name="arrowDown" className="size-4" />
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => update({ ...renameEverywhere(draft, a.name, null), attributes: draft.attributes.filter((x) => x.key !== a.key) })}
                >
                  <Icon name="trash" className="size-4" /> Remove
                </Button>
              </div>
            </div>

            <div className="mt-3 space-y-2" id={store ? valuesA11y.id : undefined} tabIndex={store ? -1 : undefined}>
              {store && (
                <fieldset>
                  <legend className="mb-1.5 flex w-full items-center justify-between gap-2 text-sm font-medium">
                    <span>Values</span>
                    <span className="flex gap-2 text-xs font-normal">
                      <button type="button" className="text-brand hover:underline" onClick={() => update({ attributes: patch(a.key, { values: [...storeValues, ...extra] }) })}>
                        Select all
                      </button>
                      <button type="button" className="text-brand hover:underline" onClick={() => update({ attributes: patch(a.key, { values: extra }) })}>
                        Select none
                      </button>
                      <button type="button" className="text-brand hover:underline" onClick={() => openCreate(a)}>
                        Create value
                      </button>
                    </span>
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {storeValues.map((v) => (
                      <label key={v} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={a.values.includes(v)}
                          onChange={(e) =>
                            update({ attributes: patch(a.key, { values: e.target.checked ? [...a.values, v] : a.values.filter((x) => x !== v) }) })
                          }
                        />
                        {v}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <div>
                <label htmlFor={store ? `${valuesA11y.id}-extra` : valuesA11y.id} className="mb-1.5 block text-sm font-medium">
                  {store ? "Values for this product only" : "Values"} {!store && <span className="text-danger" aria-hidden>*</span>}
                </label>
                <ChipsInput
                  id={store ? `${valuesA11y.id}-extra` : valuesA11y.id}
                  values={store ? extra : a.values}
                  onChange={(next) => update({ attributes: patch(a.key, { values: store ? [...a.values.filter((v) => storeValues.includes(v)), ...next] : next }) })}
                  itemLabel={`${a.name || "attribute"} value`}
                  invalid={Boolean(errors[valuesPath])}
                  describedBy={valuesA11y["aria-describedby"]}
                  placeholder={store ? "Only for this product (optional)" : "e.g. 5 kg, then Enter"}
                />
                <p id={`${valuesA11y.id}-hint`} className="mt-1 text-xs text-muted">
                  {store ? "“Create value” adds a value every product can reuse; values typed here apply to this product only." : "Press Enter or comma after each value."}
                </p>
                {errors[valuesPath] && <p id={`${valuesA11y.id}-error`} className="mt-1 text-xs text-danger">{errors[valuesPath]}</p>}
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Checkbox
                id={`${fieldId(`attributes.${i}`)}-visible`}
                label="Visible on the product page"
                hint="Listed under “Additional information”."
                checked={a.visible}
                onChange={(visible) => update({ attributes: patch(a.key, { visible }) })}
              />
              {variable ? (
                <Checkbox
                  id={`${fieldId(`attributes.${i}`)}-variation`}
                  label="Used for variations"
                  hint="Each value becomes an option with its own SKU, price and stock."
                  checked={a.variation}
                  onChange={(variation) => update({ attributes: patch(a.key, { variation }) })}
                />
              ) : (
                <p className="text-xs text-muted">Switch to a variable product to create variations from attributes.</p>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="attribute-add" className="mb-1 block text-xs font-medium text-muted">Add attribute</label>
          <select id="attribute-add" value={adding} onChange={(e) => setAdding(e.target.value)} className="h-9 rounded-ui border border-line bg-surface px-2 text-sm">
            <option value="">Custom (this product only)</option>
            {available.map((a) => <option key={a.id} value={a.id}>{a.name} (store attribute)</option>)}
          </select>
        </div>
        <Button variant="secondary" size="sm" className="h-9" onClick={add}>
          <Icon name="plus" className="size-4" /> Add
        </Button>
      </div>
      <dialog
        ref={dialogRef}
        aria-labelledby="create-value-title"
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-ui border border-line bg-surface p-5 text-foreground shadow-xl backdrop:bg-black/50"
      >
        <h2 id="create-value-title" className="text-lg font-semibold">Create value{creating ? ` for ${creating.name}` : ""}</h2>
        <p className="mt-1 text-sm text-muted">Adds a store-wide value that every product can use (demo store).</p>
        <label htmlFor="create-value-name" className="mt-4 block text-sm font-medium">Name</label>
        <input
          id="create-value-name"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (newValue.trim()) submitCreate();
            }
          }}
          aria-invalid={createError ? true : undefined}
          aria-describedby={createError ? "create-value-error" : undefined}
          className="mt-1 h-10 w-full rounded-ui border border-line bg-surface px-3 text-sm aria-invalid:border-danger"
        />
        {createError && <p id="create-value-error" className="mt-1 text-xs text-danger">{createError}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => dialogRef.current?.close()}>Cancel</Button>
          <Button onClick={submitCreate} disabled={pending || !newValue.trim()}>{pending ? "Creating…" : "OK"}</Button>
        </div>
      </dialog>
    </div>
  );
}
