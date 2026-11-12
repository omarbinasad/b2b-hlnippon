"use client";

import type { Route } from "next";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteBlockAction, saveBlockAction } from "@/app/admin/content-actions";
import { Can, useViewOnly } from "@/components/admin/capabilities-context";
import { useUnsavedGuard } from "@/components/admin/use-unsaved-guard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/field";
import { RichText } from "@/components/ui/rich-text";
import { BLOCK_KINDS } from "@/lib/content/blocks";
import type { ContentBlock, ContentBlockKind, FieldErrors } from "@/lib/types";

const RichEditor = dynamic(() => import("./rich-editor"), { ssr: false, loading: () => <Skeleton className="h-80 w-full" /> });

const starter = (kind: ContentBlockKind) => BLOCK_KINDS.find((k) => k.value === kind)?.starter ?? "";

/** Add or edit a reusable block. New blocks start from the chosen type's example text. */
export function BlockForm({ block, usedBy = 0 }: { block?: ContentBlock; usedBy?: number }) {
  const router = useRouter();
  const viewOnly = useViewOnly();
  const [name, setName] = useState(block?.name ?? "");
  const [kind, setKind] = useState<ContentBlockKind>(block?.kind ?? "announcement");
  const [bodyHtml, setBodyHtml] = useState(block?.bodyHtml ?? starter("announcement"));
  const [editorKey, setEditorKey] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState({ name: block?.name ?? "", kind: block?.kind ?? "announcement", bodyHtml: block?.bodyHtml ?? starter("announcement") });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const dirty = !viewOnly && (name !== saved.name || kind !== saved.kind || bodyHtml !== saved.bodyHtml);
  const guard = useUnsavedGuard(dirty);

  const changeKind = (next: ContentBlockKind) => {
    // An untouched example follows the type; written content stays.
    if (!block && (bodyHtml === starter(kind) || !bodyHtml.trim())) {
      setBodyHtml(starter(next));
      setEditorKey((k) => k + 1);
    }
    setKind(next);
  };

  const save = () =>
    startTransition(async () => {
      const r = await saveBlockAction(block?.id ?? null, { name, kind, bodyHtml });
      if (!r.ok) {
        setErrors(r.errors);
        setMessage(r.message);
        return;
      }
      setErrors({});
      setSaved({ name, kind, bodyHtml });
      setMessage(usedBy ? `Saved. ${usedBy === 1 ? "The page that uses it shows" : `All ${usedBy} pages that use it show`} the change.` : "Saved.");
      if (!block) router.replace(`/admin/blocks/${r.value.id}` as Route);
      else router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      const r = await deleteBlockAction(block!.id);
      setConfirmDelete(false);
      if (!r.ok) {
        setMessage(r.message);
        setErrors({ _: r.message });
        return;
      }
      setSaved({ name, kind, bodyHtml });
      router.replace("/admin/blocks");
    });

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); save(); }} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-6">
        <Card>
          <div className="space-y-4">
            <Field id="block-name" label="Name" required error={errors.name} hint="Only staff see the name. It helps you find the block when inserting it.">
              <Input id="block-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "block-name-error" : "block-name-hint"} />
            </Field>
            <Field id="block-kind" label="Type" error={errors.kind} hint={BLOCK_KINDS.find((k) => k.value === kind)?.hint}>
              <Select id="block-kind" value={kind} onChange={(e) => changeKind(e.target.value as ContentBlockKind)}>
                {BLOCK_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </Select>
            </Field>
            <div>
              <p className="mb-1.5 text-sm font-medium">Content</p>
              <RichEditor key={editorKey} id="block-body" value={bodyHtml} onChange={setBodyHtml} invalid={Boolean(errors.bodyHtml)} describedBy={errors.bodyHtml ? "block-body-error" : undefined} />
              {errors.bodyHtml && <p id="block-body-error" className="mt-1 text-sm text-danger">{errors.bodyHtml}</p>}
            </div>
          </div>
        </Card>
        <Card title="Preview" description="How the block looks on a page.">
          <RichText rich value={`<div data-block-kind="${kind}">${bodyHtml}</div>`} className="cms-body text-base leading-7" />
        </Card>
      </div>
      <aside className="space-y-4">
        <Card title="Save">
          {block && <p className="text-sm text-muted">{usedBy ? `Used on ${usedBy} ${usedBy === 1 ? "page or post" : "pages or posts"}. Saving updates ${usedBy === 1 ? "it" : "all of them"} straight away.` : "Not used on any page yet."}</p>}
          <div className="mt-4 grid gap-2">
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : block ? "Save block" : "Add block"}</Button>
            {block && (
              <Can cap="pages.delete">
                <Button variant="ghost" disabled={pending} onClick={() => setConfirmDelete(true)}>Delete block</Button>
              </Can>
            )}
          </div>
          <p role="status" className={Object.keys(errors).length ? "mt-3 text-sm text-danger" : "mt-3 text-sm text-muted"}>{message}</p>
        </Card>
      </aside>
      {block && (
        <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this block?" description={usedBy ? "Pages still use this block, so it can't be deleted yet. Remove it from them first." : "It isn't used on any page. This can't be undone."}>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="danger" disabled={pending} onClick={remove}>Delete block</Button>
          </div>
        </Dialog>
      )}
      {guard.dialog}
    </form>
  );
}
