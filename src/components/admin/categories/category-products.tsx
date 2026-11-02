"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { assignCategoryProductsAction } from "@/app/admin/categories/actions";
import { ProductSearch } from "@/components/admin/products/product-search";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icons";
import { humanize } from "@/lib/format";
import type { ProductPick } from "@/lib/types";

/**
 * Products directly in a category, with search-to-assign and remove. Changes
 * apply immediately (demo store) and the server-rendered list refreshes.
 */
export function CategoryProducts({ categoryId, categoryName, products, total }: { categoryId: string; categoryName: string; products: ProductPick[]; total: number }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();

  const change = (label: string, delta: { add?: string[]; remove?: string[] }) =>
    startTransition(async () => {
      const result = await assignCategoryProductsAction(categoryId, delta);
      setStatus(result.ok ? label : result.message);
      router.refresh();
    });

  return (
    <div className="space-y-4" aria-busy={pending}>
      <ProductSearch
        id="assign-products"
        label="Assign products"
        pickLabel="Assign"
        excludeIds={products.map((p) => p.id)}
        onPick={(p) => change(`Assigned “${p.name}” to ${categoryName}.`, { add: [p.id] })}
      />
      <p role="status" className="text-sm text-muted">{pending ? "Saving…" : status}</p>

      {products.length === 0 ? (
        <p className="text-sm text-muted">No products are directly in this category yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-ui border border-line">
          {products.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <Link href={`/admin/products/${p.id}/edit`} className="block truncate text-sm font-medium hover:underline">{p.name}</Link>
                <p className="text-xs text-muted">{p.sku} · {humanize(p.type)}</p>
              </div>
              {p.status !== "published" && <Badge tone={p.status === "draft" ? "warning" : "neutral"}>{humanize(p.status)}</Badge>}
              <button
                type="button"
                disabled={pending}
                onClick={() => change(`Removed “${p.name}” from ${categoryName}.`, { remove: [p.id] })}
                className="inline-flex size-8 items-center justify-center rounded-ui text-muted hover:bg-surface-muted hover:text-danger disabled:opacity-40"
                aria-label={`Remove ${p.name} from ${categoryName}`}
              >
                <Icon name="close" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">
        {total} product{total === 1 ? "" : "s"} directly in this category (subcategories not included).
      </p>
    </div>
  );
}
