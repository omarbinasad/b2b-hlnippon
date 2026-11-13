"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { saveSiteContentAction } from "@/app/admin/content-actions";
import { ImagePick } from "@/components/admin/media/image-pick";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Icon, type IconName } from "@/components/ui/icons";
import { cx } from "@/lib/cx";
import { PRODUCT_BADGE_LIMIT } from "@/lib/validation/site-content";
import type { AboutContent, CtaLink, FieldErrors, HeroSlide, HomeSection, HomeSectionType, IconText, SiteContent } from "@/lib/types";

const SECTION_NAMES: Record<HomeSectionType, string> = {
  hero: "Hero banners",
  benefits: "Company benefits",
  categories: "Featured categories",
  featuredProducts: "Featured products",
  quickOrder: "Quick order",
  business: "About and owner",
  brands: "Trusted brands",
  promo: "Promotion",
  delivery: "Delivery information",
  steps: "How it works",
  journal: "Journal posts",
  contact: "Contact call to action",
};

const ICONS: IconName[] = ["file", "users", "shieldCheck", "award", "coins", "truck", "truckFast", "headset", "receipt", "repeat", "box", "store", "cart", "sparkles", "wheat", "meat", "fish", "apple", "pot", "flame", "cookie", "cupSoda", "nut", "globe", "gift", "percent", "target", "eye", "users", "user", "tag", "clock", "calendar", "phone", "mail", "mapPin"];

function Text({ id, label, value, onChange, error, area, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; area?: boolean; hint?: string }) {
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      {area ? <Textarea id={id} rows={2} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)} /> : <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)} />}
    </Field>
  );
}

function IconSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field id={id} label="Icon">
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {!ICONS.includes(value as IconName) && <option value={value}>{value}</option>}
        {ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
      </Select>
    </Field>
  );
}

function CtaFields({ id, value, onChange, errors, errorKey, labels = ["Button text", "Button link"] }: { id: string; value: CtaLink; onChange: (v: CtaLink) => void; errors: FieldErrors; errorKey: string; labels?: [string, string] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Text id={`${id}-label`} label={labels[0]} value={value.label} error={errors[`${errorKey}.label`]} onChange={(label) => onChange({ ...value, label })} />
      <Text id={`${id}-href`} label={labels[1]} value={value.href} error={errors[`${errorKey}.href`]} onChange={(href) => onChange({ ...value, href })} />
    </div>
  );
}

/** A list of rows with add, remove and reorder. */
function ItemList<T>({ items, onChange, render, blank, addLabel }: { items: T[]; onChange: (v: T[]) => void; render: (item: T, set: (v: T) => void, i: number) => ReactNode; blank: T; addLabel: string }) {
  const move = (i: number, by: number) => {
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(i + by, 0, x);
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-ui border border-line p-3">
          <div className="mb-2 flex justify-end gap-0.5">
            <RowButton label="Move up" icon="arrowUp" disabled={i === 0} onClick={() => move(i, -1)} />
            <RowButton label="Move down" icon="arrowDown" disabled={i === items.length - 1} onClick={() => move(i, 1)} />
            <RowButton label="Remove" icon="trash" onClick={() => onChange(items.filter((_, j) => j !== i))} />
          </div>
          {render(item, (v) => onChange(items.map((x, j) => (j === i ? v : x))), i)}
        </div>
      ))}
      <Button size="sm" variant="secondary" onClick={() => onChange([...items, blank])}><Icon name="plus" className="size-4" /> {addLabel}</Button>
    </div>
  );
}

function RowButton({ label, icon, onClick, disabled }: { label: string; icon: IconName; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid size-8 place-items-center rounded-ui hover:bg-surface-muted disabled:opacity-30">
      <Icon name={icon} className="size-4" />
    </button>
  );
}

function IconTextList({ id, items, onChange, addLabel }: { id: string; items: IconText[]; onChange: (v: IconText[]) => void; addLabel: string }) {
  return (
    <ItemList
      items={items}
      onChange={onChange}
      addLabel={addLabel}
      blank={{ icon: "box", title: "", text: "" }}
      render={(it, set, i) => (
        <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <IconSelect id={`${id}-${i}-icon`} value={it.icon} onChange={(icon) => set({ ...it, icon })} />
          <Text id={`${id}-${i}-title`} label="Title" value={it.title} onChange={(title) => set({ ...it, title })} />
          <div className="sm:col-span-2"><Text id={`${id}-${i}-text`} label="Text" area value={it.text} onChange={(text) => set({ ...it, text })} /></div>
        </div>
      )}
    />
  );
}

const blankSlide: HeroSlide = { eyebrow: "", title: "New slide", description: "", cta: { label: "View products", href: "/shop" }, image: null, icons: ["box", "truck", "cart"] };

function SectionFields({ s, set, errors }: { s: HomeSection; set: (v: HomeSection) => void; errors: FieldErrors }) {
  const k = `section.${s.id}`;
  const id = `sec-${s.id}`;
  switch (s.type) {
    case "hero":
      return (
        <div className="space-y-4">
          {errors[`${k}.slides`] && <p className="text-sm text-danger">{errors[`${k}.slides`]}</p>}
          <ItemList
            items={s.slides}
            onChange={(slides) => set({ ...s, slides })}
            addLabel="Add slide"
            blank={blankSlide}
            render={(sl, setSl, i) => (
              <div className="grid gap-3">
                <Text id={`${id}-${i}-eyebrow`} label="Small heading" value={sl.eyebrow} onChange={(eyebrow) => setSl({ ...sl, eyebrow })} />
                <Text id={`${id}-${i}-title`} label="Heading" value={sl.title} error={errors[`${k}.slides.${i}.title`]} onChange={(title) => setSl({ ...sl, title })} />
                <Text id={`${id}-${i}-desc`} label="Description" area value={sl.description} onChange={(description) => setSl({ ...sl, description })} />
                <CtaFields id={`${id}-${i}-cta`} value={sl.cta} errors={errors} errorKey={`${k}.slides.${i}.cta`} onChange={(cta) => setSl({ ...sl, cta })} />
                <CtaFields
                  id={`${id}-${i}-cta2`}
                  labels={["Second link text (optional)", "Second link"]}
                  value={sl.secondaryCta ?? { label: "", href: "" }}
                  errors={errors}
                  errorKey={`${k}.slides.${i}.secondaryCta`}
                  onChange={(c) => setSl({ ...sl, secondaryCta: c.label || c.href ? c : null })}
                />
                <ImagePick label="Banner photo (light theme)" hint="With a photo, the slide shows it full width with the text on a frosted card." value={sl.image} onChange={(image) => setSl({ ...sl, image })} />
                <ImagePick label="Banner photo (dark theme)" hint="Optional. Without it, the light-theme photo is used in both." value={sl.imageDark ?? null} onChange={(imageDark) => setSl({ ...sl, imageDark })} />
                <ImagePick label="Phone photo (light theme)" hint="Optional, for screens under 640px wide; a portrait photo with space at the bottom for the card works best. Without it, phones show the banner photo cropped." value={sl.imageMobile ?? null} onChange={(imageMobile) => setSl({ ...sl, imageMobile })} />
                <ImagePick label="Phone photo (dark theme)" hint="Optional. Without it, the phone light-theme photo is used (or the dark banner photo if there is no phone photo)." value={sl.imageMobileDark ?? null} onChange={(imageMobileDark) => setSl({ ...sl, imageMobileDark })} />
              </div>
            )}
          />
          <p className="text-sm font-medium">Highlights under the heading</p>
          <ItemList
            items={s.highlights}
            onChange={(highlights) => set({ ...s, highlights })}
            addLabel="Add highlight"
            blank={{ icon: "sparkles", label: "" }}
            render={(h, setH, i) => (
              <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <IconSelect id={`${id}-h-${i}-icon`} value={h.icon} onChange={(icon) => setH({ ...h, icon })} />
                <Text id={`${id}-h-${i}-label`} label="Text" value={h.label} onChange={(label) => setH({ ...h, label })} />
              </div>
            )}
          />
        </div>
      );
    case "benefits":
      return <IconTextList id={id} items={s.items} onChange={(items) => set({ ...s, items })} addLabel="Add benefit" />;
    case "categories":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Text id={`${id}-eyebrow`} label="Small heading" value={s.eyebrow} onChange={(eyebrow) => set({ ...s, eyebrow })} />
          <Text id={`${id}-title`} label="Heading" value={s.title} error={errors[`${k}.title`]} onChange={(title) => set({ ...s, title })} />
          <Text id={`${id}-slugs`} label="Category addresses, in order" area hint="Separate with commas. Other categories with images fill the remaining places." value={s.slugs.join(", ")} onChange={(v) => set({ ...s, slugs: v.split(",").map((x) => x.trim()).filter(Boolean) })} />
          <MaxField id={id} value={s.max} error={errors[`${k}.max`]} onChange={(max) => set({ ...s, max })} />
        </div>
      );
    case "featuredProducts":
    case "journal":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Text id={`${id}-eyebrow`} label="Small heading" value={s.eyebrow} onChange={(eyebrow) => set({ ...s, eyebrow })} />
          <Text id={`${id}-title`} label="Heading" value={s.title} error={errors[`${k}.title`]} onChange={(title) => set({ ...s, title })} />
          <MaxField id={id} value={s.max} error={errors[`${k}.max`]} onChange={(max) => set({ ...s, max })} />
          {s.type === "featuredProducts" && <p className="self-end text-xs text-muted">Shows products marked as featured in the product editor.</p>}
        </div>
      );
    case "brands":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Text id={`${id}-title`} label="Heading" value={s.title} error={errors[`${k}.title`]} onChange={(title) => set({ ...s, title })} />
          <MaxField id={id} value={s.max} error={errors[`${k}.max`]} onChange={(max) => set({ ...s, max })} />
          <p className="text-xs text-muted sm:col-span-2">Logos, order and which brands appear are set in <Link href="/admin/brands" className="text-brand hover:underline">Brands</Link>. The section is hidden until at least one brand is marked for the homepage.</p>
        </div>
      );
    case "quickOrder":
      return (
        <div className="grid gap-3">
          <Text id={`${id}-title`} label="Heading" value={s.title} error={errors[`${k}.title`]} onChange={(title) => set({ ...s, title })} />
          <Text id={`${id}-text`} label="Text" area value={s.text} onChange={(text) => set({ ...s, text })} />
        </div>
      );
    case "business":
      return (
        <div className="grid gap-3">
          <Text id={`${id}-eyebrow`} label="Small heading" value={s.eyebrow} onChange={(eyebrow) => set({ ...s, eyebrow })} />
          <Text id={`${id}-title`} label="Heading" value={s.title} error={errors[`${k}.title`]} onChange={(title) => set({ ...s, title })} />
          <Text id={`${id}-text`} label="Text" area value={s.text} onChange={(text) => set({ ...s, text })} />
          <CtaFields id={`${id}-cta`} value={s.cta} errors={errors} errorKey={`${k}.cta`} onChange={(cta) => set({ ...s, cta })} />
          <ImagePick label="Owner or team photo" value={s.image} onChange={(image) => set({ ...s, image })} />
          <IconTextList id={`${id}-cards`} items={s.cards} onChange={(cards) => set({ ...s, cards })} addLabel="Add card" />
        </div>
      );
    case "promo":
      return (
        <div className="grid gap-3">
          <Text id={`${id}-eyebrow`} label="Small heading" value={s.eyebrow} onChange={(eyebrow) => set({ ...s, eyebrow })} />
          <Text id={`${id}-title`} label="Heading" value={s.title} error={errors[`${k}.title`]} onChange={(title) => set({ ...s, title })} />
          <Text id={`${id}-text`} label="Text" area value={s.text} onChange={(text) => set({ ...s, text })} />
          <CtaFields id={`${id}-cta`} value={s.cta} errors={errors} errorKey={`${k}.cta`} onChange={(cta) => set({ ...s, cta })} />
          <ImagePick label="Image" value={s.image} onChange={(image) => set({ ...s, image })} />
        </div>
      );
    case "delivery":
      return (
        <div className="grid gap-3">
          <Text id={`${id}-eyebrow`} label="Small heading" value={s.eyebrow} onChange={(eyebrow) => set({ ...s, eyebrow })} />
          <Text id={`${id}-title`} label="Heading" value={s.title} error={errors[`${k}.title`]} onChange={(title) => set({ ...s, title })} />
          <Text id={`${id}-text`} label="Text" area value={s.text} onChange={(text) => set({ ...s, text })} />
          <ImagePick label="Image" value={s.image} onChange={(image) => set({ ...s, image })} />
        </div>
      );
    case "steps":
      return (
        <div className="grid gap-3">
          <Text id={`${id}-eyebrow`} label="Small heading" value={s.eyebrow} onChange={(eyebrow) => set({ ...s, eyebrow })} />
          <Text id={`${id}-title`} label="Heading" value={s.title} error={errors[`${k}.title`]} onChange={(title) => set({ ...s, title })} />
          <ItemList
            items={s.items}
            onChange={(items) => set({ ...s, items })}
            addLabel="Add step"
            blank={{ title: "", text: "" }}
            render={(st, setSt, i) => (
              <div className="grid gap-3 sm:grid-cols-2">
                <Text id={`${id}-${i}-title`} label="Step" value={st.title} onChange={(title) => setSt({ ...st, title })} />
                <Text id={`${id}-${i}-text`} label="Text" value={st.text} onChange={(text) => setSt({ ...st, text })} />
              </div>
            )}
          />
        </div>
      );
    case "contact":
      return (
        <div className="grid gap-3">
          <Text id={`${id}-title`} label="Heading" value={s.title} error={errors[`${k}.title`]} onChange={(title) => set({ ...s, title })} />
          <Text id={`${id}-text`} label="Text" value={s.text} onChange={(text) => set({ ...s, text })} />
          <CtaFields id={`${id}-cta`} value={s.cta} errors={errors} errorKey={`${k}.cta`} onChange={(cta) => set({ ...s, cta })} />
        </div>
      );
  }
}

function MaxField({ id, value, error, onChange }: { id: string; value: number; error?: string; onChange: (v: number) => void }) {
  return (
    <Field id={`${id}-max`} label="How many to show" error={error}>
      <Input id={`${id}-max`} type="number" min={1} max={24} value={String(value)} onChange={(e) => onChange(Number(e.target.value))} aria-invalid={Boolean(error)} />
    </Field>
  );
}

function AboutFields({ about: a, set }: { about: AboutContent; set: (v: AboutContent) => void }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3">
        <Text id="ab-eyebrow" label="Small heading" value={a.eyebrow} onChange={(eyebrow) => set({ ...a, eyebrow })} />
        <Text id="ab-title" label="Heading" value={a.title} onChange={(title) => set({ ...a, title })} />
        <Text id="ab-text" label="Introduction" area value={a.text} onChange={(text) => set({ ...a, text })} />
        <ImagePick label="Photo" value={a.image} onChange={(image) => set({ ...a, image })} />
      </div>
      <div><p className="mb-2 text-sm font-medium">Mission and vision</p><IconTextList id="ab-pillars" items={a.pillars} onChange={(pillars) => set({ ...a, pillars })} addLabel="Add statement" /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Text id="ab-values-eyebrow" label="Values small heading" value={a.valuesEyebrow} onChange={(valuesEyebrow) => set({ ...a, valuesEyebrow })} />
        <Text id="ab-values-title" label="Values heading" value={a.valuesTitle} onChange={(valuesTitle) => set({ ...a, valuesTitle })} />
      </div>
      <IconTextList id="ab-values" items={a.values} onChange={(values) => set({ ...a, values })} addLabel="Add value" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Text id="ab-serve-eyebrow" label="Audience small heading" value={a.serveEyebrow} onChange={(serveEyebrow) => set({ ...a, serveEyebrow })} />
        <Text id="ab-serve-title" label="Audience heading" value={a.serveTitle} onChange={(serveTitle) => set({ ...a, serveTitle })} />
        <div className="sm:col-span-2"><Text id="ab-serve-text" label="Audience text" area value={a.serveText} onChange={(serveText) => set({ ...a, serveText })} /></div>
      </div>
      <ItemList
        items={a.serve}
        onChange={(serve) => set({ ...a, serve })}
        addLabel="Add audience"
        blank={{ icon: "store", title: "" }}
        render={(it, setIt, i) => (
          <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <IconSelect id={`ab-serve-${i}-icon`} value={it.icon} onChange={(icon) => setIt({ ...it, icon })} />
            <Text id={`ab-serve-${i}-title`} label="Name" value={it.title} onChange={(title) => setIt({ ...it, title })} />
          </div>
        )}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Text id="ab-cta-title" label="Closing heading" value={a.ctaTitle} onChange={(ctaTitle) => set({ ...a, ctaTitle })} />
        <Text id="ab-cta-text" label="Closing text" value={a.ctaText} onChange={(ctaText) => set({ ...a, ctaText })} />
      </div>
    </div>
  );
}

/** Structured section manager: order, visibility and content of each homepage section. */
export function HomepageBuilder({ content }: { content: SiteContent }) {
  const router = useRouter();
  const [topBar, setTopBar] = useState(content.topBar);
  const [sections, setSections] = useState(content.sections);
  const [about, setAbout] = useState(content.about);
  const [badges, setBadges] = useState(content.productBadges ?? []);
  const [open, setOpen] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const update = (id: string, next: HomeSection) => setSections(sections.map((s) => (s.id === id ? next : s)));
  const moveTo = (from: number, to: number) => {
    if (to < 0 || to >= sections.length) return;
    const next = [...sections];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    setSections(next);
  };
  const save = () =>
    start(async () => {
      const r = await saveSiteContentAction({ topBar, sections, about, productBadges: badges });
      if (!r.ok) {
        setErrors(r.errors);
        setMessage(r.message);
        const bad = Object.keys(r.errors).find((k) => k.startsWith("section."))?.split(".")[1];
        if (bad) setOpen(bad);
        return;
      }
      setErrors({});
      setMessage("Saved to the demo store. The live pages have been updated.");
      router.refresh();
    });

  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} className="space-y-6">
      <Card title="Top bar">
        <Text id="home-topbar" label="Message above the header" value={topBar} error={errors.topBar} onChange={setTopBar} />
      </Card>

      <Card title="Product page badges" description={`Small icons with a short label under Add to cart on every product page, up to ${PRODUCT_BADGE_LIMIT}. Remove them all to hide the row.`}>
        <div className="space-y-3">
          {errors.productBadges && <p className="text-sm text-danger">{errors.productBadges}</p>}
          <ItemList
            items={badges}
            onChange={setBadges}
            addLabel="Add badge"
            blank={{ icon: "shieldCheck", label: "" }}
            render={(b, setB, i) => (
              <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <IconSelect id={`badge-${i}-icon`} value={b.icon} onChange={(icon) => setB({ ...b, icon })} />
                <Text id={`badge-${i}-label`} label="Text" value={b.label} error={errors[`productBadges.${i}.label`]} onChange={(label) => setB({ ...b, label })} />
              </div>
            )}
          />
        </div>
      </Card>

      <Card title="Homepage sections" description="Drag or use the arrows to reorder. Turn a section off to hide it without losing its content.">
        <ol className="space-y-2">
          {sections.map((s, i) => {
            const isOpen = open === s.id;
            const hasError = Object.keys(errors).some((k) => k.startsWith(`section.${s.id}.`));
            return (
              <li
                key={s.id}
                draggable={!isOpen}
                onDragStart={() => setDragging(s.id)}
                onDragEnd={() => setDragging(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const from = sections.findIndex((x) => x.id === dragging); if (from >= 0) moveTo(from, i); setDragging(null); }}
                className={cx("rounded-ui border bg-surface", hasError ? "border-danger" : "border-line", dragging === s.id && "opacity-50")}
              >
                <div className="flex flex-wrap items-center gap-2 p-3">
                  <span aria-hidden title="Drag to move" className="cursor-grab text-muted select-none">⠿</span>
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : s.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium hover:text-brand">
                    <Icon name={isOpen ? "chevronDown" : "chevronRight"} className="size-4 shrink-0" />
                    {SECTION_NAMES[s.type]}
                    {!s.enabled && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-normal text-muted">Hidden</span>}
                  </button>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={s.enabled} onChange={(e) => update(s.id, { ...s, enabled: e.target.checked })} className="size-4 accent-brand" />
                    Visible
                  </label>
                  <RowButton label={`Move ${SECTION_NAMES[s.type]} up`} icon="arrowUp" disabled={i === 0} onClick={() => moveTo(i, i - 1)} />
                  <RowButton label={`Move ${SECTION_NAMES[s.type]} down`} icon="arrowDown" disabled={i === sections.length - 1} onClick={() => moveTo(i, i + 1)} />
                </div>
                {isOpen && <div className="border-t border-line p-3 sm:p-4"><SectionFields s={s} set={(v) => update(s.id, v)} errors={errors} /></div>}
              </li>
            );
          })}
        </ol>
      </Card>

      <Card title="About page" description="The mission, vision and values shown at /about.">
        <AboutFields about={about} set={setAbout} />
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending} onClick={save}>{pending ? "Saving…" : "Save changes"}</Button>
        <Link href="/" target="_blank" className="text-sm font-medium text-brand hover:underline">View homepage</Link>
        <p role="status" className={Object.keys(errors).length ? "text-sm text-danger" : "text-sm text-muted"}>{message}</p>
      </div>
    </form>
  );
}
