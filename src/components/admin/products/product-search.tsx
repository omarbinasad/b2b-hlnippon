"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { searchProductsAction } from "@/app/admin/products/actions";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icons";
import { humanize } from "@/lib/format";
import type { ProductPick } from "@/lib/types";

/**
 * Server-side product search (max 10 results) for pickers. Never loads the
 * catalog into the browser. `onPick` decides what to do with a chosen product.
 */
export function ProductSearch({
  id,
  label,
  excludeIds,
  onPick,
  pickLabel = "Add",
}: {
  id: string;
  label: string;
  excludeIds: string[];
  onPick: (product: ProductPick) => void;
  pickLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductPick[]>([]);
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const request = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const search = (q: string) => {
    setQuery(q);
    clearTimeout(timer.current);
    if (!q.trim()) {
      setResults([]);
      setStatus("");
      return;
    }
    timer.current = setTimeout(() => {
      const n = ++request.current;
      startTransition(async () => {
        const found = await searchProductsAction(q, excludeIds);
        if (n !== request.current) return; // a newer search is in flight
        setResults(found);
        setStatus(found.length ? `${found.length} product${found.length === 1 ? "" : "s"} found` : "No products found");
      });
    }, 250);
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <input
        id={id}
        type="search"
        value={query}
        onChange={(e) => search(e.target.value)}
        placeholder="Search by name or SKU"
        autoComplete="off"
        aria-describedby={`${id}-status`}
        className="h-10 w-full rounded-ui border border-line bg-surface px-3 text-base sm:text-sm"
      />
      <p id={`${id}-status`} role="status" className="text-xs text-muted">{pending ? "Searching…" : status}</p>
      {results.length > 0 && (
        <ul className="divide-y divide-line rounded-ui border border-line">
          {results.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted">{p.sku} · {humanize(p.type)}</p>
              </div>
              {p.status !== "published" && <Badge tone="warning">{humanize(p.status)}</Badge>}
              <button
                type="button"
                onClick={() => {
                  onPick(p);
                  setResults((r) => r.filter((x) => x.id !== p.id));
                }}
                className="inline-flex h-8 items-center gap-1 rounded-ui border border-line px-2.5 text-sm font-medium hover:bg-surface-muted"
                aria-label={`${pickLabel} ${p.name}`}
              >
                <Icon name="plus" className="size-4" /> {pickLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Selected linked products (upsells / cross-sells) with search to add more. */
export function LinkedProductsField({
  id,
  label,
  description,
  selected,
  onChange,
  selfId,
  error,
}: {
  id: string;
  label: string;
  description: string;
  selected: ProductPick[];
  onChange: (picks: ProductPick[]) => void;
  selfId?: string;
  error?: string;
}) {
  return (
    <fieldset id={id} tabIndex={-1} className="space-y-2">
      <legend className="text-sm font-semibold">{label}</legend>
      <p className="text-xs text-muted">{description}</p>
      {error && <p className="text-xs text-danger">{error}</p>}
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {selected.map((p) => (
            <li key={p.id} className="inline-flex items-center gap-1.5 rounded-ui border border-line py-1 pr-1 pl-2.5 text-sm">
              <span className="max-w-56 truncate">{p.name}</span>
              <span className="text-xs text-muted">{p.sku}</span>
              <button
                type="button"
                onClick={() => onChange(selected.filter((x) => x.id !== p.id))}
                className="grid size-6 place-items-center rounded-ui text-muted hover:bg-surface-muted hover:text-danger"
                aria-label={`Remove ${p.name} from ${label.toLowerCase()}`}
              >
                <Icon name="close" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <ProductSearch
        id={`${id}-search`}
        label={`Add ${label.toLowerCase()}`}
        excludeIds={[...(selfId ? [selfId] : []), ...selected.map((p) => p.id)]}
        onPick={(p) => onChange([...selected, p])}
      />
    </fieldset>
  );
}
