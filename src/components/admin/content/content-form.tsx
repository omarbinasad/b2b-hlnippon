"use client";

import type { Route } from "next";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { autosaveContentAction, discardAutosaveAction, savePageAction, savePostAction, type ContentActionResult } from "@/app/admin/content-actions";
import { useViewOnly } from "@/components/admin/capabilities-context";
import { useUnsavedGuard } from "@/components/admin/use-unsaved-guard";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/format";
import { MediaPicker } from "@/components/admin/media/media-picker";
import { TermPicker } from "./term-manager";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { siteConfig } from "@/config/site";
import { slugify } from "@/lib/content/rules";
import type { BlogPost, ContentAutosave, ContentPage, ContentSnapshot, ContentStatus, FieldErrors, PageVisibility, ProductImage, SeoFields } from "@/lib/types";

// Only admin editing screens load the editor library.
const RichEditor = dynamic(() => import("./rich-editor"), { ssr: false, loading: () => <Skeleton className="h-80 w-full" /> });

type Kind = "page" | "post";

/** "2026-07-01T09:00:00+09:00" → "2026-07-01T09:00" in the store's time zone, for a datetime-local input. */
function toLocalInput(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", { timeZone: siteConfig.timeZone, dateStyle: "short", timeStyle: "short" }).format(d).replace(" ", "T");
}
const fromLocalInput = (v: string) => (v ? `${v}:00${siteConfig.utcOffset}` : undefined);

/** How often unsaved work is kept while someone types. */
const AUTOSAVE_MS = 8000;
/** A new, never-saved item autosaves in this browser only (it has no id on the server yet). */
const localKey = (kind: Kind) => `cms-autosave:${kind}:new`;
const readLocal = (kind: Kind): { savedAt: string; snapshot: ContentSnapshot } | null => {
  try {
    const raw = localStorage.getItem(localKey(kind));
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v.savedAt === "string" && v.snapshot && typeof v.snapshot.title === "string" ? v : null;
  } catch {
    return null;
  }
};
const clearLocal = (kind: Kind) => {
  try {
    localStorage.removeItem(localKey(kind));
  } catch {}
};
const timeOnly = (iso: string) => new Intl.DateTimeFormat(undefined, { timeZone: siteConfig.timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

type AutoState = { state: "idle" | "saving" | "server" | "local" | "error"; at?: string; message?: string };

export function ContentForm({
  kind,
  item,
  categories = [],
  tagOptions = [],
  autosave,
  revisionCount = 0,
  restored = false,
}: {
  kind: Kind;
  item?: ContentPage | BlogPost;
  categories?: string[];
  tagOptions?: string[];
  /** Server autosave newer than the saved version, offered back. */
  autosave?: ContentAutosave | null;
  revisionCount?: number;
  /** Just restored from a revision. */
  restored?: boolean;
}) {
  const router = useRouter();
  const viewOnly = useViewOnly();
  const post = kind === "post" ? (item as BlogPost | undefined) : undefined;
  const page = kind === "page" ? (item as ContentPage | undefined) : undefined;
  const [title, setTitle] = useState(item?.title ?? "");
  const [slug, setSlug] = useState(item?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(item));
  const [excerpt, setExcerpt] = useState(item?.excerpt ?? "");
  const [bodyHtml, setBodyHtml] = useState(item?.bodyHtml ?? "");
  const [image, setImage] = useState<ProductImage | undefined>(item?.image);
  const [seo, setSeo] = useState<SeoFields>(item?.seo ?? {});
  const [visibility, setVisibility] = useState<PageVisibility>(page?.visibility ?? "public");
  const [cats, setCats] = useState(post?.categories ?? []);
  const [tags, setTags] = useState(post?.tags ?? []);
  const [when, setWhen] = useState(item?.status === "scheduled" ? toLocalInput(item.publishedAt) : "");
  const [status, setStatus] = useState<ContentStatus>(item?.status === "trash" ? "draft" : (item?.status ?? "draft"));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [picking, setPicking] = useState<"featured" | "og" | null>(null);
  const [pending, startTransition] = useTransition();
  const [editorKey, setEditorKey] = useState(0);
  const [recover, setRecover] = useState<{ savedAt: string; by?: string; snapshot: ContentSnapshot; where: "server" | "local" } | null>(autosave ? { savedAt: autosave.savedAt, by: autosave.authorName, snapshot: autosave.snapshot, where: "server" } : null);
  const [auto, setAuto] = useState<AutoState>({ state: "idle" });
  const [confirm, setConfirm] = useState<{ next: ContentStatus; then?: "preview" } | null>(null);
  const p = `${kind}-form`;

  const snapshot: ContentSnapshot = { title, slug, excerpt, bodyHtml, image, seo, ...(kind === "page" ? { visibility } : { categories: cats, tags }) };
  const snapJson = JSON.stringify(snapshot);
  const [savedJson, setSavedJson] = useState(snapJson);
  const dirty = !viewOnly && snapJson !== savedJson;
  const guard = useUnsavedGuard(dirty);

  // Autosave: at most every AUTOSAVE_MS while there are unsaved changes. Never touches the saved item.
  const latest = useRef({ snapJson, snapshot });
  useEffect(() => {
    latest.current = { snapJson, snapshot };
  });
  const lastAuto = useRef(snapJson);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dirty || timer.current || snapJson === lastAuto.current) return;
    timer.current = setTimeout(async () => {
      timer.current = null;
      const { snapJson: json, snapshot: snap } = latest.current;
      if (json === lastAuto.current) return;
      lastAuto.current = json;
      if (!item) {
        try {
          const at = new Date().toISOString();
          localStorage.setItem(localKey(kind), JSON.stringify({ savedAt: at, snapshot: snap }));
          setAuto({ state: "local", at });
        } catch {
          setAuto({ state: "error", message: "This browser couldn't keep a copy. Save a draft to be safe." });
        }
        return;
      }
      setAuto({ state: "saving" });
      const r = await autosaveContentAction(kind, item.id, snap);
      setAuto(r.ok ? { state: "server", at: r.savedAt } : { state: "error", message: r.message });
    }, AUTOSAVE_MS);
  }, [dirty, snapJson, item, kind]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // A new item: offer back what this browser kept last time.
  useEffect(() => {
    if (item) return;
    const local = readLocal(kind);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is only readable after mounting
    if (local && (local.snapshot.title.trim() || local.snapshot.bodyHtml.trim())) setRecover({ ...local, where: "local" });
  }, [item, kind]);

  const applySnapshot = (s: ContentSnapshot) => {
    setTitle(s.title);
    setSlug(s.slug);
    setSlugEdited(true);
    setExcerpt(s.excerpt);
    setBodyHtml(s.bodyHtml);
    setImage(s.image);
    setSeo(s.seo ?? {});
    if (kind === "page") setVisibility(s.visibility === "customers" ? "customers" : "public");
    else {
      setCats(s.categories ?? []);
      setTags(s.tags ?? []);
    }
    setEditorKey((k) => k + 1);
  };
  const restoreAutosave = () => {
    if (!recover) return;
    applySnapshot(recover.snapshot);
    setRecover(null);
    setMessage("Autosaved changes restored. Save to keep them.");
  };
  const discardAutosave = () => {
    if (!recover) return;
    if (recover.where === "local") clearLocal(kind);
    else if (item) void discardAutosaveAction(kind, item.id);
    setRecover(null);
  };
  const base = kind === "page" ? "/admin/pages" : "/admin/posts";
  const publicPath = kind === "page" ? `/${slug}` : `/blog/${slug}`;

  /** Saving a live item changes what visitors see (or takes it off the site), so it asks first. */
  const save = (next: ContentStatus, then?: "preview") => {
    if (item && status === "published" && !confirm) {
      setConfirm({ next, then });
      return;
    }
    setConfirm(null);
    doSave(next, then);
  };

  const doSave = (next: ContentStatus, then?: "preview") =>
    startTransition(async () => {
      const payload = { title, slug, excerpt, bodyHtml, status: next, publishedAt: next === "scheduled" ? fromLocalInput(when) : item?.publishedAt, image, seo, visibility, categories: cats, tags };
      const sentJson = snapJson;
      const r: ContentActionResult = kind === "page" ? await savePageAction(item?.id ?? null, payload) : await savePostAction(item?.id ?? null, payload);
      if (!r.ok) {
        setErrors(r.errors);
        setMessage(r.message);
        return;
      }
      setErrors({});
      setSavedJson(sentJson);
      lastAuto.current = sentJson;
      if (!item) clearLocal(kind);
      setAuto({ state: "idle" });
      setRecover(null);
      setStatus(next);
      setMessage(next === "published" ? "Published." : next === "scheduled" ? "Scheduled." : "Draft saved.");
      if (then === "preview") window.open(`/preview/${kind}/${r.value.id}`, "_blank", "noopener");
      if (!item) router.replace(`${base}/${r.value.id}` as Route);
      // After a restore, drop "?restored=1" so the notice doesn't linger.
      else if (restored) router.replace(`${base}/${item.id}` as Route);
      else router.refresh();
    });

  const seoTitle = seo.title?.trim() || title || "Page title";
  const seoDescription = seo.description?.trim() || excerpt || "Your page description appears here in search results.";
  const ogImage = seo.ogImage || image?.src;
  const live = item && status === "published";

  const autoText =
    auto.state === "saving" ? "Autosaving…"
    : auto.state === "server" && auto.at ? `Unsaved changes autosaved at ${timeOnly(auto.at)}. Visitors don't see them until you save.`
    : auto.state === "local" && auto.at ? `Unsaved changes kept in this browser at ${timeOnly(auto.at)}.`
    : auto.state === "error" ? auto.message
    : dirty ? "Unsaved changes."
    : item ? "All changes saved." : "";

  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      {(recover || restored) && (
        <div className="space-y-3 xl:col-span-2">
          {restored && <Notice tone="success" title="Version restored">The content now matches the version you chose. The replaced content is in Revisions.</Notice>}
          {recover && (
            <Notice tone="warning" title={recover.where === "server" ? "There are newer unsaved changes" : "An unsaved draft was found"}>
              <p>
                {recover.where === "server"
                  ? `Autosave kept changes from ${formatDateTime(recover.savedAt)}${recover.by ? ` by ${recover.by}` : ""} that are newer than the saved version.`
                  : `This browser kept a draft from ${formatDateTime(recover.savedAt)}${recover.snapshot.title ? `: “${recover.snapshot.title}”` : ""}.`}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={restoreAutosave}>Restore those changes</Button>
                <Button size="sm" variant="ghost" onClick={discardAutosave}>Discard them</Button>
              </div>
            </Notice>
          )}
        </div>
      )}
      <div className="min-w-0 space-y-6">
        <Card>
          <div className="space-y-4">
            <Field id={`${p}-title`} label="Title" required error={errors.title}>
              <Input
                id={`${p}-title`}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!slugEdited) setSlug(slugify(e.target.value));
                }}
                aria-invalid={Boolean(errors.title)}
                aria-describedby={errors.title ? `${p}-title-error` : undefined}
              />
            </Field>
            <Field id={`${p}-slug`} label="Address" required error={errors.slug} hint={`Shown as ${publicPath || "/"}`}>
              <Input id={`${p}-slug`} value={slug} onChange={(e) => { setSlugEdited(true); setSlug(e.target.value); }} aria-invalid={Boolean(errors.slug)} aria-describedby={errors.slug ? `${p}-slug-error` : `${p}-slug-hint`} />
            </Field>
            <div>
              <p className="mb-1.5 text-sm font-medium">Content</p>
              <RichEditor key={editorKey} blocks id={`${p}-body`} value={bodyHtml} onChange={setBodyHtml} invalid={Boolean(errors.bodyHtml)} describedBy={errors.bodyHtml ? `${p}-body-error` : undefined} />
              {errors.bodyHtml && <p id={`${p}-body-error`} className="mt-1 text-sm text-danger">{errors.bodyHtml}</p>}
            </div>
            <Field id={`${p}-excerpt`} label="Excerpt" error={errors.excerpt} hint="Short summary for cards and search results.">
              <Textarea id={`${p}-excerpt`} rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} aria-invalid={Boolean(errors.excerpt)} aria-describedby={errors.excerpt ? `${p}-excerpt-error` : `${p}-excerpt-hint`} />
            </Field>
          </div>
        </Card>

        <Card title="Search and sharing" description="How this appears in search results and when shared. Empty fields use the title, excerpt and featured image.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`${p}-seo-title`} label="SEO title" error={errors["seo.title"]} hint={`${(seo.title ?? "").length}/60 characters`}>
              <Input id={`${p}-seo-title`} value={seo.title ?? ""} onChange={(e) => setSeo({ ...seo, title: e.target.value })} />
            </Field>
            <Field id={`${p}-canonical`} label="Canonical URL" error={errors["seo.canonicalUrl"]} hint="Only if this content's main address is elsewhere.">
              <Input id={`${p}-canonical`} value={seo.canonicalUrl ?? ""} placeholder="https://" onChange={(e) => setSeo({ ...seo, canonicalUrl: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field id={`${p}-seo-desc`} label="Meta description" error={errors["seo.description"]} hint={`${(seo.description ?? "").length}/160 characters`}>
                <Textarea id={`${p}-seo-desc`} rows={2} value={seo.description ?? ""} onChange={(e) => setSeo({ ...seo, description: e.target.value })} />
              </Field>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-ui border border-line p-3" aria-label="Search result preview">
              <p className="text-xs font-medium text-muted">Search result preview</p>
              <p className="mt-2 truncate text-base text-info">{seoTitle}</p>
              <p className="truncate text-xs text-success">{publicPath}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted">{seoDescription}</p>
            </div>
            <div className="overflow-hidden rounded-ui border border-line" aria-label="Social sharing preview">
              <div className="relative grid aspect-[1.91/1] place-items-center bg-surface-muted text-xs text-muted">
                {ogImage ? <Image src={ogImage} alt="" fill sizes="20rem" unoptimized={ogImage.startsWith("/media/")} className="object-cover" /> : "No sharing image"}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium">{seoTitle}</p>
                <p className="line-clamp-1 text-xs text-muted">{seoDescription}</p>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setPicking("og")}>Choose sharing image</Button>
            {seo.ogImage && <Button size="sm" variant="ghost" onClick={() => setSeo({ ...seo, ogImage: undefined })}>Use featured image</Button>}
            {errors["seo.ogImage"] && <p className="text-sm text-danger">{errors["seo.ogImage"]}</p>}
          </div>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card title="Publish">
          <p className="text-sm text-muted">Status: <strong className="text-foreground capitalize">{status}</strong></p>
          <Field id={`${p}-when`} label="Publish later" error={errors.publishedAt} hint={`In ${siteConfig.timeZone}. Leave empty to publish now.`}>
            <Input id={`${p}-when`} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-invalid={Boolean(errors.publishedAt)} aria-describedby={errors.publishedAt ? `${p}-when-error` : `${p}-when-hint`} />
          </Field>
          <div className="mt-4 grid gap-2">
            {when ? (
              <Button disabled={pending} onClick={() => save("scheduled")}>{pending ? "Saving…" : "Schedule"}</Button>
            ) : (
              <Button disabled={pending} onClick={() => save("published")}>{pending ? "Saving…" : status === "published" ? "Update" : "Publish"}</Button>
            )}
            <Button variant="secondary" disabled={pending} onClick={() => save("draft")}>{status === "published" ? "Switch to draft" : "Save draft"}</Button>
            <Button variant="ghost" disabled={pending} onClick={() => save(status === "scheduled" && !when ? "draft" : status === "trash" ? "draft" : status, "preview")}>Save and preview</Button>
            {live && <Link href={publicPath as Route} target="_blank" className="text-center text-sm font-medium text-brand hover:underline">View live page</Link>}
          </div>
          <p role="status" className={Object.keys(errors).length ? "mt-3 text-sm text-danger" : "mt-3 text-sm text-muted"}>{message}</p>
          {!viewOnly && <p aria-live="polite" data-autosave={auto.state} className={auto.state === "error" ? "mt-2 text-xs text-danger" : "mt-2 text-xs text-muted"}>{autoText}</p>}
          {item && (
            <Link href={`${base}/${item.id}/revisions` as Route} className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
              Revisions ({revisionCount})
            </Link>
          )}
        </Card>

        {kind === "page" && (
          <Card title="Visibility">
            <Field id={`${p}-visibility`} label="Who can see this page" hint="In the demo this is a screen rule; the backend must enforce it.">
              <Select id={`${p}-visibility`} value={visibility} onChange={(e) => setVisibility(e.target.value === "customers" ? "customers" : "public")}>
                <option value="public">Everyone</option>
                <option value="customers">Approved customers only</option>
              </Select>
            </Field>
          </Card>
        )}

        {kind === "post" && (
          <Card title="Categories and tags">
            <div className="space-y-4">
              <TermPicker id={`${p}-cats`} label="Categories" options={categories} value={cats} onChange={setCats} error={errors.categories} />
              <TermPicker id={`${p}-tags`} label="Tags" options={tagOptions} value={tags} onChange={setTags} />
            </div>
          </Card>
        )}

        <Card title="Featured image">
          <div className="relative grid aspect-video place-items-center overflow-hidden rounded-ui bg-surface-muted text-xs text-muted">
            {image ? <Image src={image.src} alt={image.alt} fill sizes="20rem" unoptimized={image.src.startsWith("/media/")} className="object-cover" /> : "No image"}
          </div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setPicking("featured")}>Choose</Button>
            {image && <Button size="sm" variant="ghost" onClick={() => setImage(undefined)}>Remove</Button>}
          </div>
        </Card>
        <MediaPicker
          open={picking !== null}
          onClose={() => setPicking(null)}
          title={picking === "og" ? "Choose a sharing image" : "Choose a featured image"}
          onSelect={(m) => {
            if (picking === "og") setSeo({ ...seo, ogImage: m.url });
            else setImage({ src: m.url, alt: m.alt, width: m.width ?? 1200, height: m.height ?? 675 });
            setPicking(null);
          }}
        />
      </aside>
      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.next === "draft" ? `Take this ${kind} off the site?` : confirm?.next === "scheduled" ? `Reschedule this live ${kind}?` : `Update the live ${kind}?`}
        description={confirm?.next === "draft"
          ? `Switching to draft hides it from visitors until you publish it again.`
          : confirm?.next === "scheduled"
            ? `Visitors won't see it until the scheduled time. The current version is kept in Revisions.`
            : `Visitors see your changes straight away. The current version is kept in Revisions, so you can go back.`}
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirm(null)}>Keep editing</Button>
          <Button variant={confirm?.next === "draft" ? "danger" : "primary"} onClick={() => { const c = confirm; setConfirm(null); if (c) doSave(c.next, c.then); }}>
            {confirm?.next === "draft" ? "Switch to draft" : confirm?.next === "scheduled" ? "Schedule" : confirm?.then === "preview" ? "Update and preview" : "Update live"}
          </Button>
        </div>
      </Dialog>
      {guard.dialog}
    </form>
  );
}
