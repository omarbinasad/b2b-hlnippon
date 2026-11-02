"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import type { ShippingClass, TaxClassOption } from "@/lib/types";
import { attributeCombinations, LIMITS } from "@/lib/validation/product";
import { newVariation, type SectionProps, type VariationDraft } from "./draft";
import { fieldId, GroupError, SelectField } from "./form-fields";
import { VariationRow, type ParentSummary } from "./variation-row";

interface VariationsEditorProps extends SectionProps {
  shippingClasses: ShippingClass[];
  taxClasses: TaxClassOption[];
  parent: ParentSummary;
  openKeys: string[];
  onToggle: (key: string, open: boolean) => void;
  /** Replace the set of expanded variation rows (expand / collapse all). */
  onSetOpenKeys: (keys: string[]) => void;
}

interface ConfirmState {
  title: string;
  message: string;
  action: string;
  run: () => void;
}

const comboKey = (attrs: Record<string, string>, names: string[]) => names.map((n) => attrs[n] ?? "").join("|");

export function VariationsEditor({ draft, update, errors, shippingClasses, taxClasses, parent, openKeys, onToggle, onSetOpenKeys }: VariationsEditorProps) {
  const [status, setStatus] = useState("");
  const [bulk, setBulk] = useState({ price: "", sale: "", stock: "" });
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);

  const usable = draft.attributes.filter((a) => a.variation && a.name.trim() && a.values.length);
  const names = usable.map((a) => a.name);
  const combos = attributeCombinations(usable);
  const existing = new Set(draft.variations.map((v) => comboKey(v.attributes, names)));
  const missing = combos.filter((c) => !existing.has(comboKey(c, names)));
  const room = Math.max(0, LIMITS.variations - draft.variations.length);
  const unpriced = draft.variations.filter((v) => v.status === "active" && v.basePrice.trim() === "");

  const setVariations = (variations: VariationDraft[]) => update({ variations });

  const addCombos = (list: Record<string, string>[]) => {
    const added = list.slice(0, room).map((c) => newVariation(c, draft.sku));
    setVariations([...draft.variations, ...added]);
    setStatus(
      `Added ${added.length} variation${added.length === 1 ? "" : "s"}.${list.length > added.length ? ` ${list.length - added.length} skipped (limit ${LIMITS.variations}).` : ""} Set their prices next.`,
    );
  };

  const generate = () => {
    if (missing.length === 0) {
      setStatus(combos.length ? "All combinations already exist." : "Nothing to generate yet.");
      return;
    }
    if (missing.length > LIMITS.confirmGenerate) {
      ask({
        title: `Generate ${missing.length} variations?`,
        message: `This creates one variation per combination of ${names.join(" × ")}. Each needs its own price and stock before it can be sold.${
          missing.length > room ? ` Only ${room} can be added (limit ${LIMITS.variations}).` : ""
        }`,
        action: "Generate",
        run: () => addCombos(missing),
      });
      return;
    }
    addCombos(missing);
  };

  const ask = (c: ConfirmState) => {
    setConfirm(c);
    confirmRef.current?.showModal();
  };

  const setAllStatus = (status: VariationDraft["status"]) => {
    setVariations(draft.variations.map((v) => ({ ...v, status })));
    setStatus(status === "active" ? "All variations enabled." : "All variations disabled.");
  };

  const applyBulk = () => {
    setVariations(
      draft.variations.map((v) => ({
        ...v,
        ...(bulk.price.trim() && { basePrice: bulk.price.trim() }),
        ...(bulk.sale.trim() && { salePrice: bulk.sale.trim() }),
        ...(bulk.stock.trim() && { stockQuantity: bulk.stock.trim(), stockMode: "track" as const }),
      })),
    );
    setStatus("Applied to all variations.");
    setBulk({ price: "", sale: "", stock: "" });
  };

  return (
    <div id={fieldId("variations")} tabIndex={-1} className="space-y-4">
      <GroupError path="variations" errors={errors} />

      {unpriced.length > 0 && (
        <div role="note" className="rounded-ui border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          <p className="font-semibold">
            {unpriced.length} enabled variation{unpriced.length === 1 ? " has" : "s have"} no price and can&apos;t be purchased.
          </p>
          <p>Set a regular price, or disable the variation{unpriced.length === 1 ? "" : "s"}. Publishing is blocked until then.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={generate} disabled={combos.length === 0}>
          Generate variations{combos.length ? ` (${missing.length} new of ${combos.length})` : ""}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setVariations([...draft.variations, newVariation({}, draft.sku)])} disabled={room === 0}>
          <Icon name="plus" className="size-4" /> Add manually
        </Button>
        <p role="status" className="text-sm text-muted">{status}</p>
      </div>
      {combos.length === 0 && (
        <p className="text-sm text-muted">Add an attribute marked “Used for variations” with at least one value to generate variations.</p>
      )}

      {usable.length > 0 && (
        <fieldset className="rounded-ui border border-line p-3">
          <legend className="px-1 text-sm font-medium">Default selection on the product page</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {usable.map((a) => (
              <SelectField
                key={a.key}
                path={`defaultAttributes.${a.name}`}
                label={a.name}
                errors={errors}
                value={draft.defaultAttributes[a.name] ?? ""}
                onChange={(val) => update({ defaultAttributes: { ...draft.defaultAttributes, [a.name]: val } })}
              >
                <option value="">No default</option>
                {a.values.map((val) => <option key={val} value={val}>{val}</option>)}
              </SelectField>
            ))}
          </div>
        </fieldset>
      )}

      {draft.variations.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="text-muted">{draft.variations.length} variation{draft.variations.length === 1 ? "" : "s"}:</span>
          <button type="button" className="font-medium text-brand hover:underline" onClick={() => onSetOpenKeys(draft.variations.map((v) => v.key))}>Expand all</button>
          <button type="button" className="font-medium text-brand hover:underline" onClick={() => onSetOpenKeys([])}>Collapse all</button>
          <button type="button" className="font-medium text-brand hover:underline" onClick={() => setAllStatus("active")}>Enable all</button>
          <button type="button" className="font-medium text-brand hover:underline" onClick={() => setAllStatus("disabled")}>Disable all</button>
          <button
            type="button"
            className="font-medium text-danger hover:underline"
            onClick={() =>
              ask({
                title: `Delete all ${draft.variations.length} variations?`,
                message: "They are removed from the form now and from the product when you save. This can't be undone after saving.",
                action: "Delete all",
                run: () => {
                  setVariations([]);
                  setStatus("All variations removed.");
                },
              })
            }
          >
            Delete all
          </button>
        </div>
      )}

      {draft.variations.length > 1 && (
        <fieldset className="rounded-ui border border-line p-3">
          <legend className="px-1 text-sm font-medium">Set for all variations</legend>
          <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-4">
            {([["price", "Regular price"], ["sale", "Sale price"], ["stock", "Stock qty"]] as const).map(([k, label]) => (
              <div key={k}>
                <label htmlFor={`bulk-${k}`} className="mb-1 block text-xs font-medium text-muted">{label}</label>
                <input
                  id={`bulk-${k}`}
                  inputMode={k === "stock" ? "numeric" : "decimal"}
                  value={bulk[k]}
                  onChange={(e) => setBulk({ ...bulk, [k]: e.target.value })}
                  className="h-9 w-full rounded-ui border border-line bg-surface px-2 text-sm tabular-nums"
                />
              </div>
            ))}
            <Button variant="secondary" size="sm" className="h-9" onClick={applyBulk} disabled={!bulk.price && !bulk.sale && !bulk.stock}>
              Apply to all
            </Button>
          </div>
        </fieldset>
      )}

      <ul className="space-y-2">
        {draft.variations.map((v, i) => (
          <li key={v.key}>
            <VariationRow
              v={v}
              index={i}
              errors={errors}
              attributes={usable}
              images={draft.images}
              parent={parent}
              shippingClasses={shippingClasses}
              taxClasses={taxClasses}
              publishing={draft.status === "published"}
              open={openKeys.includes(v.key)}
              onToggle={(open) => onToggle(v.key, open)}
              onChange={(patch) => setVariations(draft.variations.map((x) => (x.key === v.key ? { ...x, ...patch } : x)))}
              onRemove={() => setVariations(draft.variations.filter((x) => x.key !== v.key))}
            />
          </li>
        ))}
      </ul>

      <dialog
        ref={confirmRef}
        aria-labelledby="variations-confirm-title"
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-ui border border-line bg-surface p-5 text-foreground shadow-xl backdrop:bg-black/50"
      >
        <h2 id="variations-confirm-title" className="text-lg font-semibold">{confirm?.title}</h2>
        <p className="mt-2 text-sm text-muted">{confirm?.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => confirmRef.current?.close()}>Cancel</Button>
          <Button
            variant={confirm?.action === "Delete all" ? "danger" : "primary"}
            onClick={() => {
              confirmRef.current?.close();
              confirm?.run();
            }}
          >
            {confirm?.action}
          </Button>
        </div>
      </dialog>
    </div>
  );
}
