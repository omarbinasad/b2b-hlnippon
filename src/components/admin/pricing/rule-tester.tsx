"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { productOptionAction, searchRuleCustomersAction } from "@/app/admin/pricing/actions";
import { ProductSearch } from "@/components/admin/products/product-search";
import { AccountStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import type { RuleProductOption } from "@/lib/data/repositories";
import type { AccountStatus } from "@/lib/types";

type CustomerHit = { id: string; companyName: string; status: AccountStatus };

/** Pick a customer, product option and quantity; the result is rendered by the server from the URL. */
export function RuleTester({
  initialCustomer,
  initialProduct,
  initialVariationId,
  initialQuantity,
}: {
  initialCustomer?: CustomerHit;
  initialProduct: RuleProductOption | null;
  initialVariationId?: string;
  initialQuantity: number;
}) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerHit | undefined>(initialCustomer);
  const [product, setProduct] = useState<RuleProductOption | null>(initialProduct);
  const [variationId, setVariationId] = useState(initialVariationId ?? initialProduct?.variations[0]?.id ?? "");
  const [quantity, setQuantity] = useState(String(initialQuantity));
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const searchCustomers = (q: string) => {
    setQuery(q);
    clearTimeout(timer.current);
    if (!q.trim()) return setHits([]);
    timer.current = setTimeout(() => startTransition(async () => setHits(await searchRuleCustomersAction(q))), 250);
  };

  const qty = Number(quantity);
  const valid = product && (!product.variations.length || variationId) && Number.isInteger(qty) && qty >= 1;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        const params = new URLSearchParams({ product: product!.productId, qty: String(qty) });
        if (customer) params.set("customer", customer.id);
        if (product!.variations.length) params.set("variation", variationId);
        router.push(`/admin/pricing/test?${params}` as Route);
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <p className="text-sm font-medium">Customer</p>
        {customer ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-ui border border-line p-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              {customer.companyName} <AccountStatusBadge status={customer.status} />
            </span>
            <Button size="sm" variant="secondary" onClick={() => setCustomer(undefined)}>Change</Button>
          </div>
        ) : (
          <>
            <label htmlFor="test-customer" className="sr-only">Search customers</label>
            <input
              id="test-customer"
              type="search"
              value={query}
              onChange={(e) => searchCustomers(e.target.value)}
              placeholder="Search customers (any status) — or leave empty for quantity limits only"
              autoComplete="off"
              className="h-10 w-full rounded-ui border border-line bg-surface px-3 text-base sm:text-sm"
            />
            {hits.length > 0 && (
              <ul className="divide-y divide-line rounded-ui border border-line">
                {hits.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => { setCustomer(c); setHits([]); setQuery(""); }} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-surface-muted">
                      {c.companyName} <AccountStatusBadge status={c.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="space-y-2">
        {product ? (
          <>
            <p className="text-sm font-medium">Product</p>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-ui border border-line p-3">
              <span className="text-sm font-medium">{product.name}</span>
              <Button size="sm" variant="secondary" onClick={() => setProduct(null)}>Change</Button>
            </div>
            {product.variations.length > 0 && (
              <Field id="test-variation" label="Variation">
                <Select id="test-variation" value={variationId} onChange={(e) => setVariationId(e.target.value)}>
                  {product.variations.map((v) => <option key={v.id} value={v.id}>{v.label} ({v.sku})</option>)}
                </Select>
              </Field>
            )}
          </>
        ) : (
          <ProductSearch
            id="test-product"
            label="Product"
            excludeIds={[]}
            pickLabel="Choose"
            onPick={(p) =>
              startTransition(async () => {
                const option = await productOptionAction(p.id);
                setProduct(option);
                setVariationId(option?.variations[0]?.id ?? "");
              })
            }
          />
        )}
      </div>

      <Field id="test-qty" label="Quantity (one order line)">
        <Input id="test-qty" type="number" inputMode="numeric" min={1} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-32" />
      </Field>
      <Button type="submit" disabled={!valid || pending}>Test</Button>
    </form>
  );
}
