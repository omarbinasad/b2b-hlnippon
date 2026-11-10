"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { addToCartAction, quickOrderSheetAction } from "@/app/(store)/actions";
import { StockBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { cx } from "@/lib/cx";
import { formatMoney } from "@/lib/format";
import type { QuickOrderAccess } from "@/lib/storefront/quick-order";
import type { QuickOrderLine, QuickOrderPage } from "@/lib/types";

type Selected = Record<string, { line: QuickOrderLine; quantity: number }>;
type Feedback = { tone: "success" | "danger"; text: string } | null;

/** Upper bound for the stepper when no quantity rule sets a maximum (the cart enforces its own limit). */
const MAX_QUANTITY = 10_000;

/** Shown instead of prices and ordering for viewers who are not approved customers. */
const ACCESS_MESSAGE: Record<Exclude<QuickOrderAccess, "approved">, { text: string; locked: string }> = {
  guest: { text: "Sign in to view wholesale prices and place orders.", locked: "Login to view" },
  pending: { text: "Your business account is awaiting approval. Wholesale prices and ordering appear once it is approved.", locked: "Awaiting approval" },
  admin: { text: "Staff view: these are standard wholesale prices, before any customer's own prices. To order for a customer, use Create order in the admin.", locked: "" },
};

/** Why a quantity can't be added as entered (mirrors the cart's quantity checks; the server re-checks). */
function quantityProblem(line: QuickOrderLine, quantity: number): string | undefined {
  if (quantity < line.minQuantity) return `Minimum ${line.minQuantity}.`;
  if (line.maxQuantity !== undefined && quantity > line.maxQuantity) return `Maximum ${line.maxQuantity}.`;
  if (line.step > 1 && quantity % line.step !== 0) return `Order in multiples of ${line.step}.`;
}

/**
 * Quick order sheet: search by name or SKU, filter by category, load more (server-side pages), set quantities and add
 * one line or every selected line to the cart. Quantities stay selected across searches until added or cleared.
 * Prices come from the server, priced for the customer at each line's minimum quantity; the cart re-prices at the
 * chosen quantity (bulk tiers).
 */
export function QuickOrderSheet({ initial, categories, access }: { initial: QuickOrderPage; categories: { slug: string; name: string }[]; access: QuickOrderAccess }) {
  const canOrder = access === "approved";
  const locked = access === "approved" || access === "admin" ? "" : ACCESS_MESSAGE[access].locked;
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [data, setData] = useState(initial);
  const [selected, setSelected] = useState<Selected>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [loading, startLoading] = useTransition();
  const [adding, startAdding] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const request = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const load = (next: { q: string; category: string; page: number }, delay = 0) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const n = ++request.current;
      startLoading(async () => {
        const result = await quickOrderSheetAction(next);
        if (n !== request.current) return;
        if (next.page > 1) {
          // Load more: append, skipping lines already shown.
          setData((d) => {
            const seen = new Set(d.lines.map((l) => l.id));
            return { ...result, lines: [...d.lines, ...result.lines.filter((l) => !seen.has(l.id))] };
          });
        } else setData(result);
      });
    }, delay);
  };

  const quantityOf = (line: QuickOrderLine) => selected[line.id]?.quantity ?? 0;
  const setQuantity = (line: QuickOrderLine, quantity: number) => {
    const without = <T,>(record: Record<string, T>) => Object.fromEntries(Object.entries(record).filter(([id]) => id !== line.id));
    setRowErrors(without);
    setSelected((s) => (quantity > 0 ? { ...s, [line.id]: { line, quantity } } : without(s)));
  };

  const add = (entries: { line: QuickOrderLine; quantity: number }[]) => {
    const problems = Object.fromEntries(entries.flatMap(({ line, quantity }) => {
      const p = quantityProblem(line, quantity);
      return p ? [[line.id, p]] : [];
    }));
    if (Object.keys(problems).length) {
      setRowErrors((e) => ({ ...e, ...problems }));
      setFeedback({ tone: "danger", text: "Check the highlighted quantities." });
      return;
    }
    startAdding(async () => {
      const r = await addToCartAction(entries.map(({ line, quantity }) => ({ productId: line.productId, variationId: line.variationId, quantity })));
      if (!r.ok) {
        setFeedback({ tone: "danger", text: r.message });
        return;
      }
      setSelected((s) => Object.fromEntries(Object.entries(s).filter(([id]) => !entries.some((e) => e.line.id === id))));
      setFeedback({ tone: "success", text: r.message ?? "Added to your cart." });
    });
  };

  const selectedEntries = Object.values(selected);
  const busy = loading || adding;

  return (
    <section aria-label="Quick order" className="@container space-y-4 rounded-ui border border-line bg-surface p-4 sm:p-5">
      <form
        role="search"
        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_14rem_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          load({ q, category, page: 1 });
        }}
      >
        <div className="relative">
          <label htmlFor="qos-search" className="sr-only">Search by name or SKU</label>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            id="qos-search"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              load({ q: e.target.value, category, page: 1 }, 400);
            }}
            placeholder="Search by name or SKU…"
            autoComplete="off"
            className="h-10 w-full rounded-ui border border-line bg-surface pr-3 pl-9 text-base placeholder:text-muted focus:border-brand focus:ring-3 focus:ring-brand/25 focus:outline-none sm:text-sm"
          />
        </div>
        <div>
          <label htmlFor="qos-category" className="sr-only">Category</label>
          <Select
            id="qos-category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              load({ q, category: e.target.value, page: 1 });
            }}
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </Select>
        </div>
        <Button type="submit" className="h-10" disabled={loading}>Search</Button>
      </form>

      {access !== "approved" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-ui bg-brand-soft px-4 py-3 text-sm">
          <p className="flex items-start gap-2">
            <Icon name="lock" className="mt-0.5 size-4 shrink-0 text-brand" />
            {ACCESS_MESSAGE[access].text}
          </p>
          {access === "admin" && <ButtonLink href="/admin/orders/new" size="sm">Create an order</ButtonLink>}
          {access === "guest" && (
            <div className="flex gap-2">
              <ButtonLink href="/login" size="sm">Log in</ButtonLink>
              <ButtonLink href="/register" size="sm" variant="secondary">Register</ButtonLink>
            </div>
          )}
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {loading ? "Loading products" : `${data.totalProducts} product${data.totalProducts === 1 ? "" : "s"} found`}
      </p>
      {feedback && (
        <div role="status" className={cx("flex flex-wrap items-center justify-between gap-2 rounded-ui px-4 py-3 text-sm", feedback.tone === "success" ? "bg-success-soft" : "bg-danger-soft text-danger")}>
          <span>{feedback.text}</span>
          {feedback.tone === "success" && <Link href="/cart" className="font-medium text-brand hover:underline">View cart →</Link>}
        </div>
      )}

      <div className={cx("transition-opacity", loading && "opacity-60")}>
        {data.lines.length === 0 ? (
          <p className="rounded-ui border border-line px-4 py-10 text-center text-sm text-muted">No products match this search.</p>
        ) : (
          <>
            {/* Narrow sheet (phones, tablets, the portal's content column): one card per line. */}
            <ul className="divide-y divide-line rounded-ui border border-line @3xl:hidden">
              {data.lines.map((line) => (
                <li key={line.id} className="space-y-3 p-3">
                  <div className="flex gap-3">
                    <Thumb line={line} />
                    <div className="min-w-0 flex-1">
                      <ProductName line={line} />
                      <p className="mt-0.5 text-xs break-all text-muted">{line.sku}</p>
                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                        <StockBadge status={line.stockStatus} />
                        <Price line={line} locked={locked} />
                      </div>
                    </div>
                  </div>
                  <RowControls line={line} canOrder={canOrder} busy={busy} quantity={quantityOf(line)} error={rowErrors[line.id]} onQuantity={setQuantity} onAdd={() => add([{ line, quantity: quantityOf(line) || line.minQuantity }])} />
                </li>
              ))}
            </ul>

            {/* Wide sheet: table. */}
            <div className="hidden overflow-x-auto rounded-ui border border-line @3xl:block">
              <table className="w-full text-sm">
                <caption className="sr-only">Products to order</caption>
                <thead className="bg-surface-muted text-left text-xs font-semibold tracking-wide text-muted uppercase">
                  <tr>
                    <th scope="col" className="w-16 px-3 py-2.5">Image</th>
                    <th scope="col" className="px-3 py-2.5">Product</th>
                    <th scope="col" className="px-3 py-2.5">SKU</th>
                    <th scope="col" className="px-3 py-2.5">Stock</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Price</th>
                    <th scope="col" className="px-3 py-2.5">Qty</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Add</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.lines.map((line) => {
                    const quantity = quantityOf(line);
                    return (
                      <tr key={line.id} className={cx("align-middle", quantity > 0 && "bg-brand-soft/40")}>
                        <td className="px-3 py-2"><Thumb line={line} /></td>
                        <td className="min-w-48 px-3 py-2"><ProductName line={line} /></td>
                        <td className="px-3 py-2 text-xs break-all text-muted">{line.sku}</td>
                        <td className="px-3 py-2"><StockBadge status={line.stockStatus} /></td>
                        <td className="px-3 py-2 text-right whitespace-nowrap"><Price line={line} locked={locked} /></td>
                        <td className="px-3 py-2">
                          {canOrder && !line.error ? (
                            <>
                              <Stepper line={line} quantity={quantity} onQuantity={setQuantity} invalid={Boolean(rowErrors[line.id])} />
                              {rowErrors[line.id] && <p className="mt-1 text-xs text-danger">{rowErrors[line.id]}</p>}
                            </>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" disabled={!canOrder || Boolean(line.error) || busy} onClick={() => add([{ line, quantity: quantity || line.minQuantity }])} aria-label={`Add ${line.name}${line.variationLabel ? ` (${line.variationLabel})` : ""} to cart`}>
                            Add
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {data.page < data.totalPages && (
            <Button variant="secondary" disabled={loading} onClick={() => load({ q, category, page: data.page + 1 })}>
              {loading ? "Loading…" : "Load more"}
            </Button>
          )}
          <span className="text-xs text-muted">
            Showing {new Set(data.lines.map((l) => l.productId)).size} of {data.totalProducts} products
          </span>
        </div>
        {canOrder && (
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            {selectedEntries.length > 0 && (
              <span className="text-sm">
                {selectedEntries.length} selected ·{" "}
                <button type="button" className="text-brand hover:underline" onClick={() => { setSelected({}); setRowErrors({}); }}>Clear</button>
              </span>
            )}
            <Button disabled={!selectedEntries.length || busy} onClick={() => add(selectedEntries)}>
              {adding ? "Adding…" : "Add selected to cart"}
            </Button>
          </div>
        )}
      </div>
      {canOrder && (
        <p className="text-xs text-muted">Prices shown are your prices at each product&apos;s minimum quantity. Bulk prices for larger quantities apply in the cart.</p>
      )}
    </section>
  );
}

function Thumb({ line }: { line: QuickOrderLine }) {
  return (
    <div className="relative size-12 shrink-0 overflow-hidden rounded-ui bg-surface-muted">
      {line.image ? <Image src={line.image.src} alt="" fill sizes="48px" className="object-contain" /> : <Icon name="box" className="absolute inset-0 m-auto size-5 text-muted" />}
    </div>
  );
}

function ProductName({ line }: { line: QuickOrderLine }) {
  return (
    <>
      <Link href={`/shop/${line.slug}`} className="font-medium hover:text-brand hover:underline">{line.name}</Link>
      {line.variationLabel && <span className="block text-xs text-muted">{line.variationLabel}</span>}
      <span className="block text-xs text-muted">
        per {line.unitLabel}
        {line.minQuantity > 1 && ` · min ${line.minQuantity}`}
        {line.step > 1 && ` · multiples of ${line.step}`}
        {line.maxQuantity !== undefined && ` · max ${line.maxQuantity}`}
      </span>
    </>
  );
}

/** `locked`: text shown instead of the price for viewers who may not see it ("" = show the price). */
function Price({ line, locked }: { line: QuickOrderLine; locked: string }): ReactNode {
  if (locked) return <span className="inline-flex items-center gap-1 text-xs text-muted"><Icon name="lock" className="size-3.5" /> {locked}</span>;
  if (line.unitPrice === undefined) return <span className="text-xs text-muted">No price yet</span>;
  return (
    <span className="inline-block text-right">
      <span className="font-semibold text-brand tabular-nums">{formatMoney(line.unitPrice)}</span>
      {line.priceNote && <span className="block text-xs text-muted">{line.priceNote}</span>}
    </span>
  );
}

function Stepper({ line, quantity, onQuantity, invalid }: { line: QuickOrderLine; quantity: number; onQuantity: (line: QuickOrderLine, quantity: number) => void; invalid: boolean }) {
  const max = line.maxQuantity ?? MAX_QUANTITY;
  const inc = () => onQuantity(line, quantity === 0 ? line.minQuantity : Math.min(quantity + line.step, max));
  const dec = () => onQuantity(line, quantity - line.step < line.minQuantity ? 0 : quantity - line.step);
  const id = `qos-qty-${line.id}`;
  const stepButton = "grid size-7 place-items-center @3xl:size-8 rounded-ui bg-brand-soft text-brand hover:bg-brand hover:text-brand-contrast disabled:opacity-40 disabled:hover:bg-brand-soft disabled:hover:text-brand";
  return (
    <div className={cx("inline-flex items-center gap-0.5 rounded-ui border p-0.5 @3xl:gap-1 @3xl:p-1", invalid ? "border-danger" : "border-line")}>
      <button type="button" className={stepButton} onClick={dec} disabled={quantity === 0} aria-label={`Decrease quantity of ${line.name}`}>−</button>
      <label htmlFor={id} className="sr-only">Quantity of {line.name}{line.variationLabel ? ` (${line.variationLabel})` : ""}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={1}
        value={quantity}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const n = Math.trunc(Number(e.target.value));
          onQuantity(line, Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0);
        }}
        aria-invalid={invalid}
        className="h-7 w-9 bg-transparent text-center @3xl:h-8 @3xl:w-14 text-base tabular-nums [appearance:textfield] focus:outline-none sm:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button type="button" className={stepButton} onClick={inc} disabled={quantity >= max} aria-label={`Increase quantity of ${line.name}`}>+</button>
    </div>
  );
}

function RowControls({ line, canOrder, busy, quantity, error, onQuantity, onAdd }: {
  line: QuickOrderLine;
  canOrder: boolean;
  busy: boolean;
  quantity: number;
  error?: string;
  onQuantity: (line: QuickOrderLine, quantity: number) => void;
  onAdd: () => void;
}) {
  if (!canOrder) return null;
  if (line.error) return <p className="text-xs text-muted">{line.error}</p>;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Stepper line={line} quantity={quantity} onQuantity={onQuantity} invalid={Boolean(error)} />
        <Button size="sm" disabled={busy} onClick={onAdd}>Add</Button>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

