"use client";

import type { Route } from "next";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { savePageAction, savePostAction, type ContentActionResult } from "@/app/admin/content-actions";
import { MediaPicker } from "@/components/admin/media/media-picker";
import { TermPicker } from "./term-manager";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { siteConfig } from "@/config/site";
import { slugify } from "@/lib/content/rules";
import type { BlogPost, ContentPage, ContentStatus, FieldErrors, PageVisibility, ProductImage, SeoFields } from "@/lib/types";

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

export function ContentForm({ kind, item, categories = [], tagOptions = [] }: { kind: Kind; item?: ContentPage | BlogPost; categories?: string[]; tagOptions?: string[] }) {
  const router = useRouter();
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
  const p = `${kind}-form`;
  const base = kind === "page" ? "/admin/pages" : "/admin/posts";
  const publicPath = kind === "page" ? `/${slug}` : `/blog/${slug}`;

  const save = (next: ContentStatus, then?: "preview") =>
    startTransition(async () => {
      const payload = { title, slug, excerpt, bodyHtml, status: next, publishedAt: next === "scheduled" ? fromLocalInput(when) : item?.publishedAt, image, seo, visibility, categories: cats, tags };
      const r: ContentActionResult = kind === "page" ? await savePageAction(item?.id ?? null, payload) : await savePostAction(item?.id ?? null, payload);
      if (!r.ok) {
        setErrors(r.errors);
        setMessage(r.message);
        return;
      }
      setErrors({});
      setStatus(next);
      setMessage(next === "published" ? "Published." : next === "scheduled" ? "Scheduled." : "Draft saved.");
      if (then === "preview") window.open(`/preview/${kind}/${r.value.id}`, "_blank", "noopener");
      if (!item) router.replace(`${base}/${r.value.id}` as Route);
      else router.refresh();
    });

  const seoTitle = seo.title?.trim() || title || "Page title";
  const seoDescription = seo.description?.trim() || excerpt || "Your page description appears here in search results.";
  const ogImage = seo.ogImage || image?.src;
  const live = item && status === "published";

  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
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
              <RichEditor id={`${p}-body`} value={bodyHtml} onChange={setBodyHtml} invalid={Boolean(errors.bodyHtml)} describedBy={errors.bodyHtml ? `${p}-body-error` : undefined} />
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
    </form>
  );
}
