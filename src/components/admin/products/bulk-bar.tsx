"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { bulkProductsAction, type BulkResult } from "@/app/admin/products/actions";
import { useCan } from "@/components/admin/capabilities-context";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/field";
import { formatMoney } from "@/lib/format";
import type { BulkOperation, BulkRow } from "@/lib/types";

const CHECKBOX = "input[data-bulk-id]";
/** Visible, ticked product checkboxes (phones show cards, larger screens a table: only the shown ones count). */
const tickedIds = () => [...new Set([...document.querySelectorAll<HTMLInputElement>(`${CHECKBOX}:checked`)].filter((i) => i.offsetParent !== null).map((i) => i.dataset.bulkId!))];

/** "Select all on this page", in the table header. */
export function BulkSelectAll() {
  return (
    <input
      type="checkbox"
      aria-label="Select all products on this page"
      className="size-4 accent-brand"
      onChange={(e) => {
        for (const i of document.querySelectorAll<HTMLInputElement>(CHECKBOX)) if (i.offsetParent !== null) i.checked = e.currentTarget.checked;
        document.dispatchEvent(new Event("bulk-selection"));
      }}
    />
  );
}

type Kind = "publish" | "draft" | "archive" | "stock" | "categories" | "regularPrice" | "salePrice" | "quantities" | "delete";
const KINDS: { value: Kind; label: string; cap: string }[] = [
  { value: "publish", label: "Publish", cap: "products.edit" },
  { value: "draft", label: "Unpublish (move to draft)", cap: "products.edit" },
  { value: "stock", label: "Change stock status", cap: "products.edit" },
  { value: "categories", label: "Change categories", cap: "products.edit" },
  { value: "regularPrice", label: "Change regular price", cap: "products.edit" },
  { value: "salePrice", label: "Change sale price", cap: "products.edit" },
  { value: "quantities", label: "Change order limits", cap: "products.edit" },
  { value: "archive", label: "Archive", cap: "products.delete" },
  { value: "delete", label: "Delete for good (unused products only)", cap: "products.delete" },
];

const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

/** The bar that appears when products are ticked: choose a change, preview it, then apply. */
export function BulkProductBar({ categories }: { categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const can = useCan();
  const kinds = KINDS.filter((k) => can(k.cap));
  const [ids, setIds] = useState<string[]>([]);
  const [kind, setKind] = useState<Kind>(kinds[0]?.value ?? "publish");
  const [mode, setMode] = useState("set");
  const [value, setValue] = useState("");
  const [stock, setStock] = useState("in_stock");
  const [cats, setCats] = useState<string[]>([]);
  const [q, setQ] = useState({ min: "", max: "", step: "", clearMax: false });
  const [preview, setPreview] = useState<{ rows: BulkRow[] } | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const update = () => setIds(tickedIds());
    document.addEventListener("change", update);
    document.addEventListener("bulk-selection", update);
    return () => {
      document.removeEventListener("change", update);
      document.removeEventListener("bulk-selection", update);
    };
  }, []);

  const operation = (): BulkOperation => {
    switch (kind) {
      case "publish": return { kind: "status", status: "published" };
      case "draft": return { kind: "status", status: "draft" };
      case "archive": return { kind: "status", status: "archived" };
      case "stock": return { kind: "stock", status: stock === "out_of_stock" ? "out_of_stock" : "in_stock" };
      case "categories": return { kind: "categories", mode: mode as "add" | "replace" | "remove", categoryIds: cats };
      case "regularPrice": return { kind: "regularPrice", mode: mode as never, value: Number(value) };
      case "salePrice": return { kind: "salePrice", mode: mode as never, value: mode === "clear" ? undefined : Number(value) };
      case "quantities": return { kind: "quantities", min: num(q.min), max: q.clearMax ? null : num(q.max), step: num(q.step) };
      case "delete": return { kind: "delete" };
    }
  };

  const run = (apply: boolean) =>
    start(async () => {
      const r: BulkResult = await bulkProductsAction(ids, operation(), apply);
      if (!r.ok) return setMessage({ tone: "warning", text: r.message });
      if (!apply) return setPreview({ rows: r.rows });
      setPreview(null);
      const skipped = r.rows.length - r.applied;
      setMessage({ tone: "success", text: `Changed ${r.applied} product${r.applied === 1 ? "" : "s"}${skipped ? `; ${skipped} skipped` : ""}. Saved to the demo store.` });
      for (const i of document.querySelectorAll<HTMLInputElement>(CHECKBOX)) i.checked = false;
      setIds([]);
      router.refresh();
    });

  if (!kinds.length) return null;
  const changeKind = (k: Kind) => {
    setKind(k);
    setMode(k === "categories" ? "add" : "set");
    setValue("");
  };
  const show = (v: BulkRow["changes"][number]["before"], money?: boolean) => (v === null ? "None" : money && typeof v === "number" ? formatMoney(v) : String(v));
  const willChange = preview?.rows.filter((r) => !r.problem) ?? [];
  const skipped = preview?.rows.filter((r) => r.problem) ?? [];

  return (
    <>
      {message && !ids.length && <div role="status" className="mb-3"><Notice tone={message.tone}>{message.text}</Notice></div>}
      {ids.length > 0 && (
        <section aria-label="Change selected products" className="sticky top-2 z-20 mb-4 rounded-ui border border-brand/40 bg-surface p-3 shadow-md">
          <div className="flex flex-wrap items-end gap-3">
            <p className="text-sm font-semibold">{ids.length} selected</p>
            <div className="w-56"><Field id="bulk-kind" label="Change"><Select id="bulk-kind" value={kind} onChange={(e) => changeKind(e.target.value as Kind)}>{kinds.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</Select></Field></div>
            {kind === "stock" && (
              <div className="w-44"><Field id="bulk-stock" label="Stock status"><Select id="bulk-stock" value={stock} onChange={(e) => setStock(e.target.value)}><option value="in_stock">In stock</option><option value="out_of_stock">Out of stock</option></Select></Field></div>
            )}
            {kind === "categories" && (
              <div className="w-40"><Field id="bulk-cat-mode" label="How"><Select id="bulk-cat-mode" value={mode} onChange={(e) => setMode(e.target.value)}><option value="add">Add to</option><option value="replace">Replace with</option><option value="remove">Remove from</option></Select></Field></div>
            )}
            {kind === "regularPrice" && (
              <>
                <div className="w-52"><Field id="bulk-price-mode" label="How"><Select id="bulk-price-mode" value={mode} onChange={(e) => setMode(e.target.value)}><option value="set">Set to</option><option value="increase_percent">Raise by %</option><option value="decrease_percent">Lower by %</option><option value="increase_fixed">Raise by amount</option><option value="decrease_fixed">Lower by amount</option></Select></Field></div>
                <div className="w-32"><Field id="bulk-price" label={mode.endsWith("percent") ? "Percent" : "Amount"}><Input id="bulk-price" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></Field></div>
              </>
            )}
            {kind === "salePrice" && (
              <>
                <div className="w-52"><Field id="bulk-sale-mode" label="How"><Select id="bulk-sale-mode" value={mode} onChange={(e) => setMode(e.target.value)}><option value="set">Set to</option><option value="percent_off">% off the regular price</option><option value="clear">Remove the sale price</option></Select></Field></div>
                {mode !== "clear" && <div className="w-32"><Field id="bulk-sale" label={mode === "percent_off" ? "Percent" : "Amount"}><Input id="bulk-sale" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></Field></div>}
              </>
            )}
            {kind === "quantities" && (
              <>
                <div className="w-28"><Field id="bulk-min" label="Minimum" hint="Empty = keep"><Input id="bulk-min" inputMode="numeric" value={q.min} onChange={(e) => setQ({ ...q, min: e.target.value })} /></Field></div>
                <div className="w-28"><Field id="bulk-max" label="Maximum" hint="Empty = keep"><Input id="bulk-max" inputMode="numeric" disabled={q.clearMax} value={q.max} onChange={(e) => setQ({ ...q, max: e.target.value })} /></Field></div>
                <div className="w-32"><Field id="bulk-step" label="Multiples of" hint="Empty = keep"><Input id="bulk-step" inputMode="numeric" value={q.step} onChange={(e) => setQ({ ...q, step: e.target.value })} /></Field></div>
                <label className="flex items-center gap-2 pb-7 text-sm"><input type="checkbox" className="size-4 accent-brand" checked={q.clearMax} onChange={(e) => setQ({ ...q, clearMax: e.target.checked })} /> No maximum</label>
              </>
            )}
            <div className="flex gap-2 pb-0.5">
              <Button disabled={pending || (kind === "categories" && !cats.length)} onClick={() => run(false)}>{pending ? "Checking…" : "Preview changes"}</Button>
              <Button variant="ghost" onClick={() => { for (const i of document.querySelectorAll<HTMLInputElement>(CHECKBOX)) i.checked = false; setIds([]); }}>Clear selection</Button>
            </div>
          </div>
          {kind === "categories" && (
            <fieldset className="mt-3">
              <legend className="text-sm font-medium">Categories</legend>
              <div className="scrollbar-thin mt-1 grid max-h-40 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-brand" checked={cats.includes(c.id)} onChange={(e) => setCats(e.target.checked ? [...cats, c.id] : cats.filter((x) => x !== c.id))} /> {c.name}</label>
                ))}
              </div>
            </fieldset>
          )}
          {message?.tone === "warning" && <p role="alert" className="mt-2 text-sm text-danger">{message.text}</p>}
        </section>
      )}

      <Dialog open={preview !== null} onClose={() => setPreview(null)} title="Preview changes" description={`${willChange.length} will change${skipped.length ? `, ${skipped.length} will be skipped` : ""}. Nothing is saved until you apply.`} className="max-w-3xl">
        {willChange.length > 0 && (
          <div className="scrollbar-thin max-h-80 overflow-y-auto rounded-ui border border-line">
            <table className="w-full text-sm">
              <caption className="sr-only">Changes</caption>
              <thead className="bg-surface-muted text-xs"><tr><th scope="col" className="px-3 py-2 text-left">Product</th><th scope="col" className="px-3 py-2 text-left">Change</th><th scope="col" className="px-3 py-2 text-left">Before</th><th scope="col" className="px-3 py-2 text-left">After</th></tr></thead>
              <tbody>
                {willChange.flatMap((r) => r.changes.map((c, i) => (
                  <tr key={`${r.productId}-${i}`} className="border-t border-line">
                    <td className="px-3 py-2">{i === 0 ? <><span className="font-medium">{r.name}</span><span className="block text-xs text-muted">{r.sku}</span></> : null}</td>
                    <td className="px-3 py-2">{c.label}</td>
                    <td className="px-3 py-2 tabular-nums text-muted">{show(c.before, c.money)}</td>
                    <td className="px-3 py-2 font-medium tabular-nums">{show(c.after, c.money)}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        )}
        {skipped.length > 0 && (
          <div className="mt-3">
            <h3 className="text-sm font-semibold">Skipped</h3>
            <ul className="scrollbar-thin mt-1 max-h-40 space-y-1 overflow-y-auto text-sm">
              {skipped.map((r) => <li key={r.productId}><span className="font-medium">{r.name}</span>: <span className="text-muted">{r.problem}</span></li>)}
            </ul>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setPreview(null)}>Cancel</Button>
          <Button variant={kind === "delete" ? "danger" : "primary"} disabled={pending || !willChange.length} onClick={() => run(true)}>{pending ? "Applying…" : `Apply to ${willChange.length} product${willChange.length === 1 ? "" : "s"}`}</Button>
        </div>
      </Dialog>
    </>
  );
}
