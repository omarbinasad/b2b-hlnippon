"use client";

import { useState, useTransition } from "react";
import { productOptionsAction, searchProductsAction } from "@/app/account/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import type { OrderableProduct, ProductPick } from "@/lib/types";

export interface PickedLine {
  productId: string;
  variationId?: string;
  quantity: number;
  name: string;
  sku: string;
  optionLabel?: string;
}

/** Search by name or SKU, choose an option if there are several, enter a quantity. The search runs on the server. */
export function ProductLinePicker({ onAdd, addLabel = "Add" }: { onAdd: (line: PickedLine) => void; addLabel?: string }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<ProductPick[] | null>(null);
  const [product, setProduct] = useState<OrderableProduct | null>(null);
  const [option, setOption] = useState("");
  const [qty, setQty] = useState("1");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const search = () =>
    start(async () => {
      setProduct(null);
      setResults(await searchProductsAction(term));
    });
  const pick = (id: string) =>
    start(async () => {
      const p = await productOptionsAction(id);
      setProduct(p);
      setOption(p?.options[0]?.variationId ?? "");
      setResults(null);
      setError(p ? "" : "That product can't be ordered right now.");
    });
  const add = () => {
    const quantity = Number(qty);
    if (!Number.isInteger(quantity) || quantity < 1) return setError("Enter a quantity of at least 1.");
    if (!product) return;
    const o = product.options.find((x) => (x.variationId ?? "") === option) ?? product.options[0];
    onAdd({ productId: product.productId, variationId: o?.variationId, quantity, name: product.name, sku: o?.sku ?? "", optionLabel: product.options.length > 1 ? o?.label : undefined });
    setProduct(null);
    setTerm("");
    setQty("1");
    setError("");
  };

  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); search(); }}>
        <div className="min-w-0 flex-1"><Input aria-label="Search products" placeholder="Product name or SKU" value={term} onChange={(e) => setTerm(e.target.value)} /></div>
        <Button type="submit" variant="secondary" disabled={pending || !term.trim()}><Icon name="search" className="size-4" /> Search</Button>
      </form>
      {results && (
        results.length ? (
          <ul className="divide-y divide-line rounded-ui border border-line">
            {results.map((r) => (
              <li key={r.id}><button type="button" onClick={() => pick(r.id)} className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-muted">{r.name} <span className="text-xs text-muted">{r.sku}</span></button></li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">No products found.</p>
      )}
      {product && (
        <div className="grid items-end gap-3 rounded-ui border border-line p-3 sm:grid-cols-[minmax(0,1fr)_6rem_auto]">
          <div>
            <p className="mb-1.5 text-sm font-medium">{product.name}</p>
            {product.options.length > 1 && (
              <Select aria-label="Option" value={option} onChange={(e) => setOption(e.target.value)}>
                {product.options.map((o) => <option key={o.variationId ?? o.sku} value={o.variationId ?? ""}>{o.label}</option>)}
              </Select>
            )}
          </div>
          <Field id="pick-qty" label="Quantity"><Input id="pick-qty" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
          <Button onClick={add}>{addLabel}</Button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
