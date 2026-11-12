"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { importProductsAction } from "@/app/admin/products/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/feedback";
import { Select } from "@/components/ui/select";
import { autoMapHeaders, CSV_LIMITS, parseCsv, PRODUCT_CSV_FIELDS } from "@/lib/catalog/csv";
import type { ProductCsvField, ProductImportResult, ProductImportRow } from "@/lib/types";

type Step = "file" | "map" | "check" | "done";
const ACTION_TONE = { create: "success", update: "info", skip: "danger" } as const;
const ACTION_LABEL = { create: "Create", update: "Update", skip: "Skip" } as const;

/** WooCommerce-like product import: choose a file, match its columns, check every row, then import. DEMO store. */
export function ProductCsvImport() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("file");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [body, setBody] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<(ProductCsvField | null)[]>([]);
  const [result, setResult] = useState<ProductImportResult | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const read = async (file: File) => {
    setError("");
    if (file.size > CSV_LIMITS.bytes) return setError(`The file is larger than ${CSV_LIMITS.bytes / 1_000_000} MB. Split it into smaller files.`);
    const rows = parseCsv(await file.text());
    if (rows.length < 2) return setError("The file needs a header row and at least one product row.");
    if (rows.length - 1 > CSV_LIMITS.rows) return setError(`The file has ${rows.length - 1} rows. Import at most ${CSV_LIMITS.rows} at a time.`);
    setFileName(file.name);
    setHeaders(rows[0]);
    setBody(rows.slice(1));
    setMapping(autoMapHeaders(rows[0]));
    setStep("map");
  };

  const toRows = (): ProductImportRow[] =>
    body.map((cells, i) => {
      const values: ProductImportRow["values"] = {};
      mapping.forEach((key, c) => { if (key && cells[c] !== undefined) values[key] = cells[c]; });
      return { line: i + 2, values };
    });

  const run = (apply: boolean) =>
    start(async () => {
      setError("");
      const r = await importProductsAction(toRows(), apply);
      if (!r.ok) return setError(r.message);
      setResult(r.result);
      setStep(apply ? "done" : "check");
      if (apply) router.refresh();
    });

  const mapped = new Set(mapping.filter(Boolean));
  const shown = (result?.rows ?? []).filter((r) => !onlyProblems || r.action === "skip" || r.warnings.length);

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Steps">
        {(["file", "map", "check", "done"] as Step[]).map((s, i) => (
          <li key={s} aria-current={s === step ? "step" : undefined} className={`rounded-full px-3 py-1 ${s === step ? "bg-brand text-brand-contrast" : "bg-surface-muted text-muted"}`}>
            {i + 1}. {{ file: "Choose file", map: "Match columns", check: "Check rows", done: "Import" }[s]}
          </li>
        ))}
      </ol>
      {error && <p role="alert" className="rounded-ui bg-danger-soft p-3 text-sm text-danger">{error}</p>}

      {step === "file" && (
        <Card title="Choose a CSV file" description={`Up to ${CSV_LIMITS.rows} rows. A row updates the product with the same ID or SKU; other rows create new products as drafts. Nothing changes until you confirm.`}>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-ui border border-dashed border-line px-4 py-8 text-center text-sm text-muted hover:border-brand hover:text-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus">
            <span className="font-medium text-foreground">Choose a .csv file</span>
            <span className="text-xs">Exported from this store, a spreadsheet or another shop.</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ""; }} />
          </label>
          <p className="mt-3 text-sm"><Link href={"/admin/products/export?template=1" as "/admin/products"} prefetch={false} className="font-medium text-brand hover:underline">Download a template</Link> with every column and example rows, including a product with options.</p>
        </Card>
      )}

      {step === "map" && (
        <Card title="Match columns" description={`${fileName}: ${body.length} row${body.length === 1 ? "" : "s"}. Choose what each column holds. Columns left as “Don't import” are ignored.`}>
          {!mapped.has("sku") && !mapped.has("id") && <div className="mb-3"><Notice tone="warning">No SKU or ID column: every row will create a new product.</Notice></div>}
          {!mapped.has("name") && <div className="mb-3"><Notice tone="warning">No Name column: new products can&apos;t be created, only existing ones updated.</Notice></div>}
          <div className="overflow-x-auto rounded-ui border border-line">
            <table className="w-full min-w-[34rem] text-sm">
              <caption className="sr-only">Column matching</caption>
              <thead className="bg-surface-muted text-xs"><tr><th scope="col" className="px-3 py-2 text-left">Column in the file</th><th scope="col" className="px-3 py-2 text-left">First value</th><th scope="col" className="px-3 py-2 text-left">Import as</th></tr></thead>
              <tbody>
                {headers.map((h, i) => (
                  <tr key={`${h}-${i}`} className="border-t border-line">
                    <th scope="row" className="px-3 py-2 text-left font-medium">{h || <span className="text-muted">(no name)</span>}</th>
                    <td className="max-w-48 truncate px-3 py-2 text-muted">{body[0]?.[i]}</td>
                    <td className="w-64 px-3 py-2">
                      <Select aria-label={`Import ${h} as`} value={mapping[i] ?? ""} onChange={(e) => { const next = [...mapping]; next[i] = (e.target.value || null) as ProductCsvField | null; setMapping(next); }}>
                        <option value="">Don&apos;t import</option>
                        {PRODUCT_CSV_FIELDS.map((f) => <option key={f.key} value={f.key} disabled={mapping.includes(f.key) && mapping[i] !== f.key}>{f.label}</option>)}
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={pending || !mapped.size} onClick={() => run(false)}>{pending ? "Checking…" : "Check rows"}</Button>
            <Button variant="secondary" onClick={() => setStep("file")}>Choose another file</Button>
          </div>
        </Card>
      )}

      {(step === "check" || step === "done") && result && (
        <Card
          title={step === "done" ? "Import finished" : "Check the rows"}
          description={step === "done" ? `Created ${result.created}, updated ${result.updated}, skipped ${result.skipped} row${result.skipped === 1 ? "" : "s"}. Saved to the demo store.` : `${result.created} new product${result.created === 1 ? "" : "s"}, ${result.updated} update${result.updated === 1 ? "" : "s"}, ${result.skipped} row${result.skipped === 1 ? "" : "s"} skipped. Nothing is saved yet.`}
        >
          <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-brand" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} /> Show only rows with problems or notes</label>
          <div className="scrollbar-thin max-h-[28rem] overflow-auto rounded-ui border border-line">
            <table className="w-full min-w-[40rem] text-sm">
              <caption className="sr-only">Rows</caption>
              <thead className="sticky top-0 bg-surface-muted text-xs"><tr><th scope="col" className="px-3 py-2 text-left">Line</th><th scope="col" className="px-3 py-2 text-left">Product</th><th scope="col" className="px-3 py-2 text-left">Result</th><th scope="col" className="px-3 py-2 text-left">Details</th></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.line} className="border-t border-line align-top">
                    <td className="px-3 py-2 tabular-nums">{r.line}</td>
                    <td className="px-3 py-2"><span className="font-medium">{r.name || "—"}</span>{r.sku && <span className="block text-xs text-muted">{r.sku}</span>}</td>
                    <td className="px-3 py-2"><Badge tone={ACTION_TONE[r.action]}>{ACTION_LABEL[r.action]}</Badge></td>
                    <td className="px-3 py-2 text-xs">
                      {r.errors.map((e) => <p key={e} className="text-danger">{e}</p>)}
                      {r.warnings.map((w) => <p key={w} className="text-muted">{w}</p>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!shown.length && <p className="p-4 text-sm text-muted">No rows to show.</p>}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {step === "check" ? (
              <>
                <Button disabled={pending || result.created + result.updated === 0} onClick={() => run(true)}>{pending ? "Importing…" : `Import ${result.created + result.updated} product${result.created + result.updated === 1 ? "" : "s"}`}</Button>
                <Button variant="secondary" onClick={() => setStep("map")}>Back to columns</Button>
              </>
            ) : (
              <>
                <Link href="/admin/products" className="inline-flex h-10 items-center rounded-ui bg-brand px-4 text-sm font-semibold text-brand-contrast hover:bg-brand-hover">Go to products</Link>
                <Button variant="secondary" onClick={() => { setStep("file"); setResult(null); }}>Import another file</Button>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

/** Export: choose which products and columns, then download. */
export function ProductCsvExport({ query }: { query: string }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [cols, setCols] = useState<ProductCsvField[]>(PRODUCT_CSV_FIELDS.map((f) => f.key));
  const [selected, setSelected] = useState<string[]>([]);
  const href = () => {
    const p = new URLSearchParams(scope === "selected" ? "" : query);
    if (scope === "selected") p.set("ids", selected.join(","));
    if (cols.length !== PRODUCT_CSV_FIELDS.length) p.set("cols", cols.join(","));
    return `/admin/products/export?${p}`;
  };
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          const ids = [...new Set([...document.querySelectorAll<HTMLInputElement>("input[data-bulk-id]:checked")].filter((i) => i.offsetParent !== null).map((i) => i.dataset.bulkId!))];
          setSelected(ids);
          setScope(ids.length ? "selected" : "all");
          setOpen(true);
        }}
      >
        Export CSV
      </Button>
      {open && (
        <div role="dialog" aria-modal="true" aria-labelledby="export-title" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="w-full max-w-xl rounded-ui border border-line bg-surface p-5 shadow-xl">
            <h2 id="export-title" className="text-lg font-semibold">Export products</h2>
            <fieldset className="mt-4">
              <legend className="text-sm font-medium">Which products</legend>
              <div className="mt-2 space-y-1.5 text-sm">
                <label className="flex items-center gap-2"><input type="radio" name="export-scope" className="size-4 accent-brand" checked={scope === "all"} onChange={() => setScope("all")} /> All products matching the current filters</label>
                <label className={`flex items-center gap-2 ${selected.length ? "" : "text-muted"}`}><input type="radio" name="export-scope" className="size-4 accent-brand" disabled={!selected.length} checked={scope === "selected"} onChange={() => setScope("selected")} /> Selected products ({selected.length})</label>
              </div>
            </fieldset>
            <fieldset className="mt-4">
              <legend className="text-sm font-medium">Columns</legend>
              <div className="mt-1 flex gap-3 text-sm"><button type="button" className="text-brand hover:underline" onClick={() => setCols(PRODUCT_CSV_FIELDS.map((f) => f.key))}>All</button><button type="button" className="text-brand hover:underline" onClick={() => setCols(["sku", "name"])}>Only SKU and name</button></div>
              <div className="scrollbar-thin mt-2 grid max-h-56 gap-1 overflow-y-auto text-sm sm:grid-cols-2">
                {PRODUCT_CSV_FIELDS.map((f) => (
                  <label key={f.key} className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-brand" checked={cols.includes(f.key)} onChange={(e) => setCols(e.target.checked ? PRODUCT_CSV_FIELDS.map((x) => x.key).filter((k) => k === f.key || cols.includes(k)) : cols.filter((k) => k !== f.key))} /> {f.label}</label>
                ))}
              </div>
            </fieldset>
            <p className="mt-3 text-xs text-muted">Products with options get one row per option, linked by Parent SKU. The file imports back unchanged.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <a href={href()} download onClick={() => setOpen(false)} aria-disabled={!cols.length} className={`inline-flex h-10 items-center rounded-ui bg-brand px-4 text-sm font-semibold text-brand-contrast hover:bg-brand-hover ${cols.length ? "" : "pointer-events-none opacity-50"}`}>Download CSV</a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
