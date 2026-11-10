"use client";

import { useCan } from "@/components/admin/capabilities-context";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { removeMediaAction, updateMediaAction } from "@/app/admin/media/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { formatDateTime, formatFileSize } from "@/lib/format";
import type { FieldErrors, MediaItem } from "@/lib/types";
import { uploadFile } from "./media-picker";

export function MediaLibrary({ items, children }: { items: MediaItem[]; children: ReactNode }) {
  const can = useCan();
  const router = useRouter();
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const upload = (files: FileList) =>
    start(async () => {
      const failed: string[] = [];
      for (const file of files) {
        const r = await uploadFile(file);
        if (!r.ok) failed.push(`${file.name}: ${r.errors.file ?? r.message}`);
      }
      setMessage(failed.length ? failed.join(" ") : `Uploaded ${files.length} file${files.length === 1 ? "" : "s"}.`);
      router.refresh();
    });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {can("media.create") && <><input ref={input} type="file" hidden multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = ""; }} />
        <Button disabled={pending} onClick={() => input.current?.click()}><Icon name="plus" className="size-4" /> {pending ? "Uploading…" : "Upload files"}</Button></>}
        <p className="text-xs text-muted">JPEG, PNG, WebP or PDF up to 4 MB each.</p>
        <p role="status" className="text-sm">{message}</p>
      </div>
      {children}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {items.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => setSelected(m)} className="group block w-full rounded-ui border border-line bg-surface p-2 text-left hover:border-brand">
              <span className="relative grid aspect-square place-items-center overflow-hidden rounded-ui bg-surface-muted">
                {m.kind === "image" ? <Image src={m.url} alt={m.alt} fill sizes="12rem" unoptimized={m.url.startsWith("/media/")} className="object-contain" /> : <Icon name="file" className="size-10 text-muted" />}
              </span>
              <span className="mt-1.5 block truncate text-xs font-medium group-hover:text-brand">{m.title}</span>
              <span className="block text-xs text-muted">{formatFileSize(m.size)}</span>
            </button>
          </li>
        ))}
      </ul>
      {selected && <Details key={selected.id} item={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function Details({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const can = useCan();
  const router = useRouter();
  const [title, setTitle] = useState(item.title);
  const [alt, setAlt] = useState(item.alt);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const r = await updateMediaAction(item.id, { title, alt });
      if (!r.ok) return setErrors(r.errors);
      router.refresh();
      onClose();
    });
  const remove = () =>
    start(async () => {
      await removeMediaAction(item.id);
      router.refresh();
      onClose();
    });
  return (
    <Dialog open onClose={onClose} title="File details" className="max-w-2xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="relative grid aspect-square place-items-center overflow-hidden rounded-ui bg-surface-muted">
          {item.kind === "image" ? <Image src={item.url} alt={item.alt} fill sizes="20rem" unoptimized={item.url.startsWith("/media/")} className="object-contain" /> : <Icon name="file" className="size-12 text-muted" />}
        </div>
        <div className="space-y-3">
          <Field id="media-title" label="Title" required error={errors.title}><Input id="media-title" disabled={!can("media.edit")} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field id="media-alt" label="Alternative text" error={errors.alt} hint="Describes the image for people who can't see it."><Input id="media-alt" disabled={!can("media.edit")} value={alt} onChange={(e) => setAlt(e.target.value)} /></Field>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted">File</dt><dd className="break-all">{item.fileName}</dd>
            <dt className="text-muted">Type</dt><dd>{item.contentType}</dd>
            <dt className="text-muted">Size</dt><dd>{formatFileSize(item.size)}{item.width ? ` · ${item.width}×${item.height}` : ""}</dd>
            <dt className="text-muted">Added</dt><dd>{formatDateTime(item.uploadedAt)} by {item.uploadedBy}</dd>
            <dt className="text-muted">Address</dt><dd className="break-all">{item.url}</dd>
          </dl>
          {item.sample && <Badge tone="info">Sample file</Badge>}
        </div>
      </div>
      {confirming ? (
        <div className="mt-4 rounded-ui border border-danger bg-danger-soft p-3 text-sm">
          <p>Remove this file? Pages or logos still using it will show a broken image.</p>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)}>Keep it</Button>
            <Button variant="danger" disabled={pending} onClick={remove}>Remove file</Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap justify-between gap-2">
          {item.sample || !can("media.delete") ? <span /> : <Button variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => setConfirming(true)}><Icon name="trash" className="size-4" /> Remove</Button>}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            {can("media.edit") && <Button disabled={pending} onClick={save}>{pending ? "Saving…" : "Save"}</Button>}
          </div>
        </div>
      )}
    </Dialog>
  );
}
