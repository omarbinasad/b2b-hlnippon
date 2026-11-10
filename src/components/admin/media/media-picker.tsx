"use client";

import { useCan } from "@/components/admin/capabilities-context";
import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { listMediaAction, uploadMediaAction } from "@/app/admin/media/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import type { MediaItem } from "@/lib/types";

/** Reads an image's real size in the browser, so the saved logo keeps its proportions. */
async function imageSize(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

export async function uploadFile(file: File) {
  const form = new FormData();
  form.set("file", file);
  const size = await imageSize(file);
  if (size) {
    form.set("width", String(size.width));
    form.set("height", String(size.height));
  }
  return uploadMediaAction(form);
}

/** Library dialog: search, upload, pick an image. */
export function MediaPicker({ open, onClose, onSelect, title = "Choose an image" }: { open: boolean; onClose: () => void; onSelect: (item: MediaItem) => void; title?: string }) {
  const can = useCan();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const load = (term: string) =>
    startTransition(async () => {
      const page = await listMediaAction({ search: term, kind: "image" });
      setItems(page?.items ?? []);
      setLoaded(true);
    });

  useEffect(() => {
    if (open) load("");
  }, [open]);

  const upload = (file: File) =>
    startTransition(async () => {
      setError("");
      const r = await uploadFile(file);
      if (r.ok) onSelect(r.value);
      else setError(r.errors.file ?? r.message);
    });

  return (
    <Dialog open={open} onClose={onClose} title={title} description="Pick from the media library or upload a new image." className="max-w-3xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <form className="flex min-w-0 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); load(search); }}>
            <Input aria-label="Search media" placeholder="Search by title or file name" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button type="submit" variant="secondary" disabled={pending}>Search</Button>
          </form>
          {can("media.create") && <><input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          <Button disabled={pending} onClick={() => input.current?.click()}><Icon name="plus" className="size-4" /> Upload image</Button></>}
        </div>
        {!can("media.view") && <p role="note" className="text-sm text-muted">Your role can&apos;t browse the media library. That needs the &quot;Browse media&quot; permission.</p>}
        <p className="text-xs text-muted">JPEG, PNG or WebP up to 4 MB. Demo: uploads stay in the server&apos;s memory and are lost when it restarts.</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {loaded && !items.length ? (
          <p className="py-8 text-center text-sm text-muted">No images found.</p>
        ) : (
          <ul className="grid max-h-96 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
            {items.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => onSelect(m)} className="group block w-full rounded-ui border border-line p-2 text-left hover:border-brand">
                  <span className="relative block aspect-square overflow-hidden rounded-ui bg-surface-muted">
                    <Image src={m.url} alt={m.alt} fill sizes="10rem" unoptimized={m.url.startsWith("/media/")} className="object-contain" />
                  </span>
                  <span className="mt-1.5 block truncate text-xs group-hover:text-brand">{m.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
