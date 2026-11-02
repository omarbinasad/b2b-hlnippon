"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { saveCategoryAction } from "@/app/admin/categories/actions";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { newKey, type ImageDraft } from "@/components/admin/products/draft";
import { a11y, fieldId, Section, SelectField, TextField } from "@/components/admin/products/form-fields";
import { ImageManager } from "@/components/admin/products/image-manager";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Field, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import type { Category, CategoryInput, CategoryStatus, FieldErrors } from "@/lib/types";
import { LIMITS, slugify, validateCategory } from "@/lib/validation/product";

interface CategoryFormProps {
  category?: Category;
  /** Allowed parents (excludes this category and its subcategories). */
  parentOptions: { id: string; path: string }[];
  /** This category and its descendants (cannot be chosen as parent). */
  blockedParentIds: string[];
}

export function CategoryForm({ category, parentOptions, blockedParentIds }: CategoryFormProps) {
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(category));
  const [parentId, setParentId] = useState(category?.parentId ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [status, setStatus] = useState<CategoryStatus>(category?.status ?? "active");
  const [images, setImages] = useState<ImageDraft[]>(category?.image ? [{ ...category.image, key: newKey("img"), local: false }] : []);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const summaryRef = useRef<HTMLDivElement>(null);

  const input: CategoryInput = useMemo(
    () => ({ name, slug, parentId: parentId || undefined, description, status, image: images[0] && { src: images[0].src, alt: images[0].alt, width: images[0].width, height: images[0].height } }),
    [name, slug, parentId, description, status, images],
  );
  // The image editor reports alt errors as "image.0.alt"; category validation uses "image.alt".
  const clientErrors = useMemo(() => {
    if (!submitted) return {};
    const errs = validateCategory(input, blockedParentIds);
    if (errs["image.alt"]) {
      errs["image.0.alt"] = errs["image.alt"];
      delete errs["image.alt"];
    }
    return errs;
  }, [submitted, input, blockedParentIds]);
  const errors = { ...serverErrors, ...clientErrors };
  const count = Object.keys(errors).length;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setMessage("");
    if (Object.keys(validateCategory(input, blockedParentIds)).length) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    const local = images.some((i) => i.local);
    startTransition(async () => {
      const result = await saveCategoryAction(category?.id ?? null, { ...input, image: local ? undefined : input.image });
      // Success redirects to the list (no result); only failures return here.
      if (!result) return;
      setServerErrors(result.errors);
      setMessage(result.message);
      requestAnimationFrame(() => summaryRef.current?.focus());
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={pending} className="max-w-3xl">
      <Link href="/admin/categories" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <Icon name="arrowLeft" className="size-4" /> Categories
      </Link>
      <h1 className="mt-1 mb-5 text-2xl font-semibold tracking-tight sm:text-3xl">{category ? "Edit category" : "Add category"}</h1>

      <div className="mb-4 space-y-3">
        <DemoEditingNotice images />
        {submitted && count > 0 && (
          <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-ui border border-danger bg-danger-soft p-4 text-sm text-danger">
            <p className="font-semibold">{message || `${count} ${count === 1 ? "field needs" : "fields need"} attention before saving.`}</p>
            <ul className="mt-1 list-disc pl-5">
              {Object.entries(errors).map(([path, msg]) => (
                <li key={path}>
                  <a href={`#${fieldId(path)}`} className="underline underline-offset-2">{msg}</a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {images.some((i) => i.local) && <Notice>The chosen image is a local preview and won&apos;t be saved — uploads need the backend.</Notice>}
      </div>

      <div className="space-y-4">
        <Section title="Details">
          <TextField
            path="name"
            label="Name"
            errors={errors}
            required
            maxLength={LIMITS.categoryName}
            value={name}
            onChange={(v) => {
              setName(v);
              if (!slugEdited) setSlug(slugify(v));
              setServerErrors({});
            }}
          />
          <TextField
            path="slug"
            label="Slug"
            errors={errors}
            required
            hint={`Web address: /shop?category=${slug || "…"}`}
            value={slug}
            onChange={(v) => {
              setSlug(v);
              setSlugEdited(true);
              setServerErrors({});
            }}
            autoComplete="off"
          />
          <SelectField path="parentId" label="Parent category" errors={errors} hint="Leave empty for a top-level category." value={parentId} onChange={setParentId}>
            <option value="">None (top level)</option>
            {parentOptions.map((o) => <option key={o.id} value={o.id}>{o.path}</option>)}
          </SelectField>
          <Field id={fieldId("description")} label="Description" error={errors.description} hint="Shown on the category page.">
            <Textarea {...a11y("description", errors, true)} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <SelectField path="status" label="Status" errors={errors} hint="Hidden categories (and products only in them) don't appear in the store." value={status} onChange={(v) => setStatus(v as CategoryStatus)}>
            <option value="active">Active</option>
            <option value="hidden">Hidden</option>
          </SelectField>
        </Section>
        <Section title="Image">
          <ImageManager images={images} onChange={setImages} errors={errors} path="image" fieldId={fieldId} single />
        </Section>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex items-center justify-end gap-3 border-t border-line bg-surface/95 py-3 pr-18 pl-4 backdrop-blur sm:-mx-6 sm:pl-6 lg:-mx-8 lg:pl-8">
        <Link href="/admin/categories" className="text-sm font-medium text-muted hover:text-foreground">Cancel</Link>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : category ? "Save changes" : "Create category"}</Button>
      </div>
    </form>
  );
}
