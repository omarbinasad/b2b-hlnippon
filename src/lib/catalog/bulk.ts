/**
 * Bulk product changes: what each selected product would become, or why it can't change. Pure and tested
 * (tests/product-bulk.test.ts). The mock store and the future backend apply the same plan; nothing here saves.
 *
 * Money is computed in integer minor units and rounded half-up once per price. A product a change can't apply to is
 * skipped with a reason; the others still change. Variable products change on each option that has the price.
 */
import { fromMinor, toMinor } from "../orders/calc.ts";
import { checkOrderQuantity, publishProblems } from "../validation/product.ts";
import type { BulkOperation, BulkRow, Money, PriceMode, Product, ProductStatus } from "../types/index.ts";

export type { BulkChange, BulkOperation, BulkRow, PriceMode, SaleMode } from "../types/index.ts";

export const BULK_LIMIT = 200;

/** p% of an amount in minor units, half-up, p with up to 2 decimals. */
function percentMinor(minor: number, percent: number) {
  const p = BigInt(Math.round(percent * 100));
  const scaled = BigInt(minor) * p;
  const den = BigInt(10000);
  return Number((scaled * BigInt(2) + den) / (den * BigInt(2)));
}

/** New price, or an error. */
function newPrice(current: Money | undefined, mode: PriceMode, value: number): { price?: Money; error?: string } {
  if (mode === "set") return { price: value };
  if (current === undefined) return { error: "It has no price to change." };
  const c = toMinor(current);
  const v = mode.endsWith("percent") ? percentMinor(c, value) : toMinor(value);
  const next = mode.startsWith("increase") ? c + v : c - v;
  if (next < 0) return { error: "The price would go below zero." };
  return { price: fromMinor(next) };
}

/** Each option (or the product itself) that has prices, with a label for the screen. */
function priceTargets(p: Product) {
  if (p.type === "simple") return [{ label: "", basePrice: p.basePrice, salePrice: p.salePrice }];
  return p.variations.filter((v) => v.status === "active").map((v) => ({ label: ` · ${Object.values(v.attributes).join(" ")}`, basePrice: v.basePrice, salePrice: v.salePrice }));
}

const statusLabel: Record<ProductStatus, string> = { draft: "Draft", published: "Published", archived: "Archived" };

export interface BulkContext {
  /** Category id → name, for readable changes and to refuse unknown ids. */
  categories: Map<string, string>;
  /** Products that orders, quotations or carts still point to: these can't be deleted. */
  inUse: Set<string>;
}

export function planBulkChange(products: Product[], op: BulkOperation, ctx: BulkContext): BulkRow[] {
  return products.map((p) => {
    const row: BulkRow = { productId: p.id, name: p.name, sku: p.sku, changes: [] };
    const skip = (problem: string) => ({ ...row, problem });
    switch (op.kind) {
      case "status": {
        if (p.status === op.status) return skip(`It's already ${statusLabel[op.status].toLowerCase()}.`);
        if (op.status === "published") {
          const problems = publishProblems(p);
          if (problems.length) return skip(problems.join(" "));
        }
        row.changes.push({ label: "Status", before: statusLabel[p.status], after: statusLabel[op.status] });
        return row;
      }
      case "stock": {
        if (p.manageStock) return skip("It tracks a stock quantity. Change the quantity in Inventory instead.");
        if (p.stock.status === op.status) return skip("Its stock status is already that.");
        row.changes.push({ label: "Stock", before: p.stock.status.replace(/_/g, " "), after: op.status.replace(/_/g, " ") });
        return row;
      }
      case "categories": {
        const unknown = op.categoryIds.filter((id) => !ctx.categories.has(id));
        if (unknown.length || !op.categoryIds.length) return skip("Choose categories that exist.");
        const next = op.mode === "replace" ? [...op.categoryIds] : op.mode === "add" ? [...new Set([...p.categoryIds, ...op.categoryIds])] : p.categoryIds.filter((id) => !op.categoryIds.includes(id));
        if (next.length === p.categoryIds.length && next.every((id) => p.categoryIds.includes(id))) return skip("Its categories wouldn't change.");
        if (!next.length && p.status === "published") return skip("A published product needs at least one category.");
        const names = (ids: string[]) => ids.map((id) => ctx.categories.get(id) ?? id).join(", ") || "None";
        row.changes.push({ label: "Categories", before: names(p.categoryIds), after: names(next) });
        return row;
      }
      case "regularPrice": {
        if (!Number.isFinite(op.value) || op.value < 0) return skip("Enter an amount of 0 or more.");
        const targets = priceTargets(p);
        if (!targets.length) return skip("None of its options is turned on.");
        for (const t of targets) {
          const r = newPrice(t.basePrice, op.mode, op.value);
          if (r.error) return skip(t.label ? `${t.label.slice(3)}: ${r.error}` : r.error);
          if (t.salePrice !== undefined && r.price !== undefined && toMinor(t.salePrice) >= toMinor(r.price)) return skip(`The sale price${t.label} would no longer be below the regular price. Change or clear the sale price first.`);
          row.changes.push({ label: `Price${t.label}`, before: t.basePrice ?? null, after: r.price ?? null, money: true });
        }
        return row;
      }
      case "salePrice": {
        const targets = priceTargets(p);
        if (!targets.length) return skip("None of its options is turned on.");
        for (const t of targets) {
          if (op.mode === "clear") {
            if (t.salePrice === undefined) continue;
            row.changes.push({ label: `Sale price${t.label}`, before: t.salePrice, after: null, money: true });
            continue;
          }
          if (t.basePrice === undefined) return skip("It has no regular price, so it can't have a sale price.");
          const v = op.value ?? Number.NaN;
          if (!Number.isFinite(v) || v < 0 || (op.mode === "percent_off" && v > 100)) return skip(op.mode === "percent_off" ? "Enter a percentage from 0 to 100." : "Enter an amount of 0 or more.");
          const sale = op.mode === "set" ? v : fromMinor(toMinor(t.basePrice) - percentMinor(toMinor(t.basePrice), v));
          if (toMinor(sale) >= toMinor(t.basePrice)) return skip(`The sale price${t.label} must be below the regular price.`);
          row.changes.push({ label: `Sale price${t.label}`, before: t.salePrice ?? null, after: sale, money: true });
        }
        if (!row.changes.length) return skip("It has no sale price to clear.");
        return row;
      }
      case "quantities": {
        const next = { min: op.min ?? p.quantityRule.min, max: op.max === null ? undefined : (op.max ?? p.quantityRule.max), step: op.step ?? p.quantityRule.step };
        const errors: Record<string, string> = {};
        checkOrderQuantity(errors, { minQuantity: next.min, maxQuantity: next.max, quantityStep: next.step, soldIndividually: p.soldIndividually });
        if (Object.keys(errors).length) return skip(Object.values(errors).join(" "));
        const fmt = (q: { min: number; max?: number; step: number }) => `min ${q.min}, ${q.max === undefined ? "no max" : `max ${q.max}`}${q.step > 1 ? `, multiples of ${q.step}` : ""}`;
        if (fmt(next) === fmt(p.quantityRule)) return skip("Its order limits wouldn't change.");
        row.changes.push({ label: "Order limits", before: fmt(p.quantityRule), after: fmt(next) });
        return row;
      }
      case "delete": {
        if (ctx.inUse.has(p.id)) return skip("Orders, quotations or carts still include it, so it can't be deleted. Archive it instead.");
        row.changes.push({ label: "Product", before: "Kept", after: "Deleted for good" });
        return row;
      }
    }
  });
}
