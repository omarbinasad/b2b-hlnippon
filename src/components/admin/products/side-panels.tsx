"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { createBrandAction, quickCreateCategoryAction } from "@/app/admin/products/actions";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { siteConfig } from "@/config/site";
import { originCountries } from "@/lib/countries";
import type { AdminCategoryRow, Brand, ProductStatus, Tag, TaxClassOption } from "@/lib/types";
import type { ProductDraft, SectionProps } from "./draft";
import { a11y, Checkbox, ChipsInput, fieldId, GroupError, Section, SelectField } from "./form-fields";

export function PublishPanel({ draft, update, errors }: SectionProps) {
  return (
    <Section title="Publishing">
      <SelectField path="status" label="Status" errors={errors} hint="Drafts and archived products are hidden from the store." value={draft.status} onChange={(s) => update({ status: s as ProductStatus })}>
        <option value="draft">Draft</option>
        <option value="published">Published</option>
        <option value="archived">Archived</option>
      </SelectField>
      <SelectField path="visibility" label="Catalog visibility" errors={errors} hint="Where a published product appears." value={draft.visibility} onChange={(v) => update({ visibility: v as ProductDraft["visibility"] })}>
        <option value="visible">Shop and search</option>
        <option value="catalog">Shop pages only</option>
        <option value="search">Search results only</option>
        <option value="hidden">Hidden (direct link only)</option>
      </SelectField>
      <Checkbox id={fieldId("featured")} label="Featured product" hint="Can be highlighted on the homepage later." checked={draft.featured} onChange={(featured) => update({ featured })} />
    </Section>
  );
}

/**
 * "+ Add new …" disclosure. Uses buttons, not a nested form (the product form
 * wraps it), and turns Enter into "Add" so the product isn't submitted.
 */
function InlineCreate({ id, label, extra, onCreate }: { id: string; label: string; extra?: ReactNode; onCreate: (name: string) => Promise<string | null> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const create = () =>
    startTransition(async () => {
      const problem = await onCreate(name);
      if (problem) setError(problem);
      else {
        setName("");
        setError("");
        setOpen(false);
      }
    });

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <Icon name="plus" className="size-4" /> {label}
      </button>
    );
  }
  return (
    <div className="mt-3 space-y-2 rounded-ui border border-line p-3">
      <label htmlFor={id} className="block text-sm font-medium">{label.replace(/^Add new /, "New ")} name</label>
      <input
        id={id}
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            create();
          }
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-9 w-full rounded-ui border border-line bg-surface px-2.5 text-sm aria-invalid:border-danger"
      />
      {extra}
      {error && <p id={`${id}-error`} className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" onClick={create} disabled={pending || !name.trim()}>{pending ? "Adding…" : "Add"}</Button>
      </div>
    </div>
  );
}

export function CategoriesPanel({ draft, update, errors, categories }: SectionProps & { categories: AdminCategoryRow[] }) {
  const [filter, setFilter] = useState("");
  const [created, setCreated] = useState<AdminCategoryRow[]>([]);
  const [parentId, setParentId] = useState("");
  // Created items may also arrive in refreshed props after the server revalidates — keep one of each.
  const all = [...categories, ...created.filter((c) => !categories.some((x) => x.id === c.id))];
  const ordered = [...all].sort((a, b) => a.path.localeCompare(b.path));
  const shown = filter.trim() ? ordered.filter((c) => c.path.toLowerCase().includes(filter.trim().toLowerCase())) : ordered;

  const createCategory = async (name: string) => {
    const result = await quickCreateCategoryAction(name, parentId || undefined);
    if (!result.ok) return result.error;
    const parent = all.find((c) => c.id === parentId);
    const row: AdminCategoryRow = {
      ...result.value,
      path: parent ? `${parent.path} › ${result.value.name}` : result.value.name,
      depth: parent ? parent.depth + 1 : 0,
      productCount: 0,
    };
    setCreated((c) => [...c, row]);
    update({ categoryIds: [...draft.categoryIds, row.id] });
    return null;
  };

  return (
    <section id={fieldId("categoryIds")} tabIndex={-1} aria-labelledby="categories-title" className="rounded-ui border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="categories-title" className="text-base font-semibold">Categories</h2>
        <Link href="/admin/categories" className="text-xs font-medium text-brand hover:underline">Manage</Link>
      </div>
      <GroupError path="categoryIds" errors={errors} />
      {all.length > 8 && (
        <div className="mt-3">
          <label htmlFor="category-filter" className="sr-only">Filter categories</label>
          <input
            id="category-filter"
            type="search"
            placeholder="Filter categories"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-9 w-full rounded-ui border border-line bg-surface px-2.5 text-sm"
          />
        </div>
      )}
      <fieldset className="mt-3 max-h-72 overflow-y-auto">
        <legend className="sr-only">Product categories</legend>
        <ul className="space-y-1.5">
          {shown.map((c) => (
            <li key={c.id} style={{ paddingLeft: `${filter ? 0 : c.depth * 1.25}rem` }}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.categoryIds.includes(c.id)}
                  onChange={(e) =>
                    update({ categoryIds: e.target.checked ? [...draft.categoryIds, c.id] : draft.categoryIds.filter((id) => id !== c.id) })
                  }
                  className="size-4 accent-[var(--brand)]"
                />
                {filter ? c.path : c.name}
                {c.status === "hidden" && <span className="text-xs text-muted">(hidden)</span>}
              </label>
            </li>
          ))}
          {shown.length === 0 && <li className="text-sm text-muted">No matching categories.</li>}
        </ul>
      </fieldset>
      <InlineCreate
        id="new-category-name"
        label="Add new category"
        onCreate={createCategory}
        extra={
          <div>
            <label htmlFor="new-category-parent" className="mb-1 block text-xs font-medium text-muted">Parent category</label>
            <select id="new-category-parent" value={parentId} onChange={(e) => setParentId(e.target.value)} className="h-9 w-full rounded-ui border border-line bg-surface px-2 text-sm">
              <option value="">None (top level)</option>
              {ordered.map((c) => <option key={c.id} value={c.id}>{c.path}</option>)}
            </select>
          </div>
        }
      />
    </section>
  );
}

export function BrandsPanel({ draft, update, errors, brands }: SectionProps & { brands: Brand[] }) {
  const [created, setCreated] = useState<Brand[]>([]);
  const all = [...brands, ...created.filter((c) => !brands.some((x) => x.id === c.id))].sort((a, b) => a.name.localeCompare(b.name));
  const toggle = (id: string, on: boolean) => update({ brandIds: on ? [...draft.brandIds, id] : draft.brandIds.filter((b) => b !== id) });
  return (
    <section id={fieldId("brandIds")} tabIndex={-1} aria-labelledby="brands-title" className="rounded-ui border border-line bg-surface p-4 sm:p-5">
      <h2 id="brands-title" className="text-base font-semibold">Brands</h2>
      <GroupError path="brandIds" errors={errors} />
      <fieldset className="mt-3 max-h-56 overflow-y-auto">
        <legend className="sr-only">Product brands</legend>
        <ul className="space-y-1.5">
          {all.map((b) => (
            <li key={b.id}>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={draft.brandIds.includes(b.id)} onChange={(e) => toggle(b.id, e.target.checked)} />
                {b.name}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <InlineCreate
        id="new-brand-name"
        label="Add new brand"
        onCreate={async (name) => {
          const result = await createBrandAction(name);
          if (!result.ok) return result.error;
          setCreated((c) => [...c, result.value]);
          toggle(result.value.id, true);
          return null;
        }}
      />
    </section>
  );
}

export function TagsPanel({ draft, update, errors, tags }: SectionProps & { tags: Tag[] }) {
  const tagA11y = a11y("tags", errors, true);
  const mostUsed = tags.filter((t) => !draft.tags.some((x) => x.toLowerCase() === t.name.toLowerCase())).slice(0, 8);
  return (
    <Section title="Tags">
      <div className="space-y-1.5">
        <label htmlFor={tagA11y.id} className="sr-only">Tags</label>
        <ChipsInput
          id={tagA11y.id}
          values={draft.tags}
          onChange={(next) => update({ tags: next })}
          itemLabel="tag"
          suggestions={tags.map((t) => t.name)}
          invalid={Boolean(errors.tags)}
          describedBy={tagA11y["aria-describedby"]}
          placeholder="Add a tag"
        />
        <p id={`${tagA11y.id}-hint`} className="text-xs text-muted">Separate with commas or Enter. New tags are created on save.</p>
        {errors.tags && <p id={`${tagA11y.id}-error`} className="text-xs text-danger">{errors.tags}</p>}
      </div>
      {mostUsed.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Most used</p>
          <div className="flex flex-wrap gap-1.5">
            {mostUsed.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => update({ tags: [...draft.tags, t.name] })}
                className="rounded-full border border-line px-2.5 py-0.5 text-xs hover:border-brand hover:text-brand"
                aria-label={`Add tag ${t.name}`}
              >
                + {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

export function OriginPanel({ draft, update, errors }: SectionProps) {
  const store = originCountries.find((c) => c.code === siteConfig.country)?.name ?? siteConfig.country;
  return (
    <Section title="Country of origin">
      <SelectField
        path="originCountry"
        label="Country"
        errors={errors}
        hint={`Where the product comes from, e.g. Japan for imported items. The store itself is based in ${store}.`}
        value={draft.originCountry}
        onChange={(originCountry) => update({ originCountry })}
      >
        <option value="">Not specified</option>
        {originCountries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
      </SelectField>
    </Section>
  );
}

export function TaxPanel({ draft, update, errors, taxClasses }: SectionProps & { taxClasses: TaxClassOption[] }) {
  return (
    <Section title="Tax">
      <SelectField path="taxStatus" label="Tax status" errors={errors} value={draft.taxStatus} onChange={(v) => update({ taxStatus: v as ProductDraft["taxStatus"] })}>
        <option value="taxable">Taxable</option>
        <option value="shipping">Shipping only</option>
        <option value="none">None</option>
      </SelectField>
      <SelectField
        path="taxClass"
        label="Tax class"
        errors={errors}
        hint={draft.type === "variable" ? "Default for variations; each can override it. Rates come from tax settings (later)." : "Rates come from tax settings (coming later)."}
        value={draft.taxClass}
        onChange={(v) => update({ taxClass: v as ProductDraft["taxClass"] })}
      >
        {taxClasses.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </SelectField>
    </Section>
  );
}
