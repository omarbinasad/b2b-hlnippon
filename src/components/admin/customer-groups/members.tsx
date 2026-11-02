"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { assignGroupMembersAction, searchGroupCandidatesAction } from "@/app/admin/customer-groups/actions";
import { AccountStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";

type Candidate = Awaited<ReturnType<typeof searchGroupCandidatesAction>>[number];

/** Server-side search of customers not in this group; adding moves them from any other group. */
export function AddMembers({ groupId, groupNames }: { groupId: string; groupNames: Record<string, string> }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
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
      return;
    }
    timer.current = setTimeout(() => {
      const n = ++request.current;
      startTransition(async () => {
        const found = await searchGroupCandidatesAction(groupId, q);
        if (n !== request.current) return;
        setResults(found);
        setStatus(found.length ? `${found.length} customer${found.length === 1 ? "" : "s"} found` : "No customers found outside this group");
      });
    }, 250);
  };

  const add = (c: Candidate) =>
    startTransition(async () => {
      const result = await assignGroupMembersAction(groupId, [c.id], []);
      if (result.ok) {
        setResults((r) => r.filter((x) => x.id !== c.id));
        setStatus(`Added ${c.companyName}.`);
      } else setStatus(result.message);
    });

  return (
    <div className="space-y-2">
      <label htmlFor="member-search" className="block text-sm font-medium">Add customers</label>
      <input
        id="member-search"
        type="search"
        value={query}
        onChange={(e) => search(e.target.value)}
        placeholder="Business, contact, email or phone"
        autoComplete="off"
        aria-describedby="member-search-status"
        className="h-10 w-full rounded-ui border border-line bg-surface px-3 text-base sm:text-sm"
      />
      <p id="member-search-status" role="status" className="text-xs text-muted">{pending ? "Working…" : status}</p>
      {results.length > 0 && (
        <ul className="divide-y divide-line rounded-ui border border-line">
          {results.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.companyName}</p>
                <p className="text-xs text-muted">{c.groupId ? `Now in ${groupNames[c.groupId] ?? c.groupId} — will be moved` : "No group"}</p>
              </div>
              <AccountStatusBadge status={c.status} />
              <Button size="sm" variant="secondary" onClick={() => add(c)} disabled={pending} aria-label={`Add ${c.companyName}`}>
                <Icon name="plus" className="size-4" /> Add
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RemoveMember({ groupId, customerId, name }: { groupId: string; customerId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await assignGroupMembersAction(groupId, [], [customerId]);
            if (!result.ok) setError(result.message);
          })
        }
        aria-label={`Remove ${name} from this group`}
      >
        {pending ? "Removing…" : "Remove"}
      </Button>
      {error && <span role="alert" className="block text-xs text-danger">{error}</span>}
    </>
  );
}
