"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteTermAction, saveTermAction } from "@/app/admin/content-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import type { TermKind, TermUsage } from "@/lib/types";

type Kind = TermKind | "brand";

const NOUN: Record<Kind, string> = { category: "category", tag: "tag", brand: "brand" };
const LIST_TITLE: Record<Kind, string> = { category: "Categories", tag: "Tags", brand: "Brands" };
const USES: Record<Kind, string> = { category: "post", tag: "post", brand: "product" };

/** Add, rename and delete blog categories, blog tags or product brands. Changes apply everywhere the name is used. */
export function TermManager({ kind, terms }: { kind: Kind; terms: TermUsage[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<TermUsage | null>(null);
  const [rename, setRename] = useState("");
  const [renameError, setRenameError] = useState("");
  const [removing, setRemoving] = useState<TermUsage | null>(null);
  const [removeError, setRemoveError] = useState("");
  const [pending, start] = useTransition();
  const noun = NOUN[kind];

  const add = () =>
    start(async () => {
      const r = await saveTermAction(kind, null, name);
      if (!r.ok) return setError(r.errors.name ?? r.message);
      setName("");
      setError("");
      router.refresh();
    });
  const saveRename = () =>
    start(async () => {
      if (!editing) return;
      const r = await saveTermAction(kind, editing.name, rename);
      if (!r.ok) return setRenameError(r.errors.name ?? r.message);
      setEditing(null);
      router.refresh();
    });
  const remove = () =>
    start(async () => {
      if (!removing) return;
      const r = await deleteTermAction(kind, removing.name);
      if (!r.ok) return setRemoveError(r.message);
      setRemoving(null);
      router.refresh();
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <Card title={`Add a ${noun}`}>
        <form noValidate onSubmit={(e) => { e.preventDefault(); add(); }} className="space-y-3">
          <Field id={`${kind}-new`} label="Name" required error={error}>
            <Input id={`${kind}-new`} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${kind}-new-error` : undefined} />
          </Field>
          <Button type="submit" disabled={pending}><Icon name="plus" className="size-4" /> Add {noun}</Button>
        </form>
      </Card>
      <Card title={LIST_TITLE[kind]}>
        {terms.length ? (
          <ul className="divide-y divide-line">
            {terms.map((t) => (
              <li key={t.name} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-sm font-medium">{t.name}</span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-muted">{t.count} {USES[kind]}{t.count === 1 ? "" : "s"}</span>
                  <Button size="sm" variant="secondary" onClick={() => { setEditing(t); setRename(t.name); setRenameError(""); }}>Rename</Button>
                  <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => { setRemoving(t); setRemoveError(""); }}>Delete</Button>
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">Nothing here yet.</p>}
      </Card>
      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} title={`Rename ${noun}`} description={editing?.count ? `This changes ${editing.count} ${USES[kind]}${editing.count === 1 ? "" : "s"}.` : undefined}>
        <form noValidate onSubmit={(e) => { e.preventDefault(); saveRename(); }} className="space-y-4">
          <Field id={`${kind}-rename`} label="Name" required error={renameError}><Input id={`${kind}-rename`} value={rename} onChange={(e) => setRename(e.target.value)} aria-invalid={Boolean(renameError)} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" disabled={pending}>Save</Button>
          </div>
        </form>
      </Dialog>
      <Dialog open={Boolean(removing)} onClose={() => setRemoving(null)} title={`Delete "${removing?.name}"?`} description={removing?.count ? `It will be removed from ${removing.count} ${USES[kind]}${removing.count === 1 ? "" : "s"}.` : undefined}>
        {removeError && <p role="alert" className="mb-3 text-sm text-danger">{removeError}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRemoving(null)}>Keep it</Button>
          <Button variant="danger" disabled={pending} onClick={remove}>Delete</Button>
        </div>
      </Dialog>
    </div>
  );
}

/** Tick existing terms, or add a new one, on the post form. */
export function TermPicker({ id, label, options, value, onChange, error }: { id: string; label: string; options: string[]; value: string[]; onChange: (v: string[]) => void; error?: string }) {
  const [draft, setDraft] = useState("");
  const all = [...new Set([...options, ...value])].sort((a, b) => a.localeCompare(b));
  const add = () => {
    const name = draft.trim();
    if (name && !value.includes(name)) onChange([...value, name]);
    setDraft("");
  };
  return (
    <fieldset aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="text-sm font-medium">{label}</legend>
      {all.length > 0 && (
        <ul className="scrollbar-thin mt-2 max-h-40 space-y-1 overflow-y-auto">
          {all.map((name) => (
            <li key={name}>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-brand" checked={value.includes(name)} onChange={(e) => onChange(e.target.checked ? [...value, name] : value.filter((v) => v !== name))} />
                {name}
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex gap-2">
        <Input aria-label={`New ${label.toLowerCase()}`} placeholder="Add new" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <Button variant="secondary" disabled={!draft.trim()} onClick={add}>Add</Button>
      </div>
      {error && <p id={`${id}-error`} className="mt-1 text-sm text-danger">{error}</p>}
    </fieldset>
  );
}
