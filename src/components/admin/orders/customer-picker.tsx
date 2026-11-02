"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { searchOrderCustomersAction } from "@/app/admin/orders/actions";
import { Icon } from "@/components/ui/icons";

type CustomerHit = Awaited<ReturnType<typeof searchOrderCustomersAction>>[number];

/** Server-side search of approved customers (max 10 results). */
export function CustomerPicker({ id, onPick, error }: { id: string; onPick: (customerId: string) => void; error?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerHit[]>([]);
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
        const found = await searchOrderCustomersAction(q);
        if (n !== request.current) return;
        setResults(found);
        setStatus(found.length ? `${found.length} customer${found.length === 1 ? "" : "s"} found` : "No approved customers found");
      });
    }, 250);
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        Find customer <span className="text-danger" aria-hidden>*</span>
      </label>
      <input
        id={id}
        type="search"
        value={query}
        onChange={(e) => search(e.target.value)}
        placeholder="Company, contact, email or phone"
        autoComplete="off"
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-status`}
        className="h-10 w-full rounded-ui border border-line bg-surface px-3 text-base aria-invalid:border-danger sm:text-sm"
      />
      <p id={`${id}-status`} role="status" className={error && !status ? "text-xs text-danger" : "text-xs text-muted"}>
        {pending ? "Searching…" : status || error || "Only approved customers can have orders created for them."}
      </p>
      {results.length > 0 && (
        <ul className="divide-y divide-line rounded-ui border border-line">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(c.id);
                  setQuery("");
                  setResults([]);
                  setStatus("");
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.companyName}</span>
                  <span className="block text-xs text-muted">{[c.contactName, c.phone ?? c.email].filter(Boolean).join(" · ")}</span>
                </span>
                <Icon name="arrowRight" className="size-4 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
