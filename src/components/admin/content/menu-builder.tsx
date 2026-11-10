"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteMenuAction, saveMenuAction } from "@/app/admin/content-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Icon, type IconName } from "@/components/ui/icons";
import { cx } from "@/lib/cx";
import { depthOf, heightOf, indent, MAX_MENU_DEPTH, moveDown, moveItem, moveUp, outdent, removeItem, updateItem } from "@/lib/content/menu";
import type { FieldErrors, MenuItem, MenuLocation, NavigationMenu } from "@/lib/types";

const newId = () => `mi-${crypto.randomUUID().slice(0, 8)}`;

interface Option {
  value: string;
  label: string;
}

/** Drag items to reorder or nest. Every move also has a button, so it works by keyboard and on touch screens. */
export function MenuBuilder({ menu, pages, categories }: { menu?: NavigationMenu; pages: Option[]; categories: Option[] }) {
  const router = useRouter();
  const [name, setName] = useState(menu?.name ?? "");
  const [location, setLocation] = useState<MenuLocation>(menu?.location ?? "none");
  const [items, setItems] = useState<MenuItem[]>(menu?.items ?? []);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  const add = (item: Pick<MenuItem, "label" | "kind" | "ref" | "url">) => setItems([...items, { id: newId(), children: [], ...item }]);

  const save = () =>
    start(async () => {
      const r = await saveMenuAction(menu?.id ?? null, { name, location, items });
      if (!r.ok) {
        setErrors(r.errors);
        setMessage(r.message);
        return;
      }
      setErrors({});
      setMessage("Saved to the demo store. The live menu has been updated.");
      if (!menu) router.replace(`/admin/menus/${r.value.id}` as Route);
      else router.refresh();
    });

  const remove = () =>
    start(async () => {
      if (menu) await deleteMenuAction(menu.id);
      router.push("/admin/menus");
    });

  /** Dropping on an item places the dragged one right after it; on the nest zone, inside it. */
  const drop = (targetId: string, nest: boolean) => {
    const id = dragging;
    setDragging(null);
    setDropTarget(null);
    if (!id || id === targetId) return;
    if (nest) {
      const parent = findItem(items, targetId);
      setItems(moveItem(items, id, { parentId: targetId, index: parent?.children.length ?? 0 }));
      return;
    }
    const place = findPlace(items, targetId);
    if (place) setItems(moveItem(items, id, { parentId: place.parentId, index: place.index + 1 }));
  };

  const renderItems = (list: MenuItem[], level: number) => (
    <ul className={cx("space-y-2", level > 1 && "mt-2 ml-4 border-l-2 border-line pl-3 sm:ml-6")}>
      {list.map((item) => {
        const canNest = depthOf(items, item.id) < MAX_MENU_DEPTH;
        const labelError = errors[`item.${item.id}.label`];
        const urlError = errors[`item.${item.id}.url`];
        const refError = errors[`item.${item.id}.ref`];
        return (
          <li key={item.id}>
            <div
              draggable
              onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.effectAllowed = "move"; setDragging(item.id); }}
              onDragEnd={() => { setDragging(null); setDropTarget(null); }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropTarget(item.id); }}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); drop(item.id, e.nativeEvent.offsetX > 120 && canNest); }}
              className={cx("rounded-ui border bg-surface p-3", dropTarget === item.id && dragging !== item.id ? "border-brand ring-2 ring-brand/30" : "border-line", dragging === item.id && "opacity-50")}
            >
              <div className="flex flex-wrap items-start gap-2">
                <span aria-hidden title="Drag to move" className="mt-2 cursor-grab text-muted select-none">⠿</span>
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                  <div>
                    <Input aria-label={`Label of ${item.label || "new item"}`} value={item.label} onChange={(e) => setItems(updateItem(items, item.id, { label: e.target.value }))} aria-invalid={Boolean(labelError)} />
                    {labelError && <p className="mt-1 text-xs text-danger">{labelError}</p>}
                  </div>
                  <div>
                    {item.kind === "custom" ? (
                      <Input aria-label={`Link of ${item.label}`} value={item.url ?? ""} placeholder="/shop or https://" onChange={(e) => setItems(updateItem(items, item.id, { url: e.target.value }))} aria-invalid={Boolean(urlError)} />
                    ) : (
                      <p className="flex h-10 items-center truncate text-sm text-muted">
                        {item.kind === "page" ? "Page" : "Category"}: {(item.kind === "page" ? pages : categories).find((o) => o.value === item.ref)?.label ?? "No longer available"}
                      </p>
                    )}
                    {(urlError || refError) && <p className="mt-1 text-xs text-danger">{urlError ?? refError}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-0.5">
                  <Move label={`Move ${item.label} up`} icon="arrowUp" onClick={() => setItems(moveUp(items, item.id))} />
                  <Move label={`Move ${item.label} down`} icon="arrowDown" onClick={() => setItems(moveDown(items, item.id))} />
                  <Move label={`Move ${item.label} out one level`} icon="arrowLeft" disabled={level === 1} onClick={() => setItems(outdent(items, item.id))} />
                  <Move label={`Nest ${item.label} under the item above`} icon="arrowRight" disabled={level + heightOf(item) > MAX_MENU_DEPTH} onClick={() => setItems(indent(items, item.id))} />
                  <Move label={`Remove ${item.label}`} icon="trash" danger onClick={() => setItems(removeItem(items, item.id))} />
                </div>
              </div>
            </div>
            {item.children.length > 0 && renderItems(item.children, level + 1)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <div className="space-y-4">
        <Card title="Menu">
          <div className="space-y-4">
            <Field id="menu-name" label="Name" required error={errors.name}><Input id="menu-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "menu-name-error" : undefined} /></Field>
            <Field id="menu-location" label="Show in" hint="Each place shows one menu. Choosing a place takes it from any other menu.">
              <Select id="menu-location" value={location} onChange={(e) => setLocation(e.target.value as MenuLocation)}>
                <option value="header">Store header</option>
                <option value="footer">Store footer</option>
                <option value="none">Not shown</option>
              </Select>
            </Field>
          </div>
        </Card>
        <AddFromList title="Add a page" empty="No published pages yet." options={pages} onAdd={(o) => add({ label: o.label, kind: "page", ref: o.value })} />
        <AddFromList title="Add a category" empty="No categories." options={categories} onAdd={(o) => add({ label: o.label.replace(/^— /, ""), kind: "category", ref: o.value })} />
        <Card title="Add a custom link">
          <CustomLink onAdd={(label, url) => add({ label, kind: "custom", url })} />
        </Card>
      </div>

      <div className="min-w-0 space-y-4">
        <Card title="Menu structure" description={`Drag to reorder. Drop on the right side of an item to nest under it. Up to ${MAX_MENU_DEPTH} levels. In the footer, top-level items become column headings.`}>
          {items.length ? renderItems(items, 1) : <p className="py-6 text-center text-sm text-muted">No items yet. Add a page, category or link.</p>}
        </Card>
        <Card title="Preview">
          {items.length ? <MenuPreview items={items} /> : <p className="text-sm text-muted">Your menu appears here.</p>}
        </Card>
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={pending} onClick={save}>{pending ? "Saving…" : "Save menu"}</Button>
          {menu && <Button variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => setConfirming(true)}>Delete menu</Button>}
          <p role="status" className={Object.keys(errors).length ? "text-sm text-danger" : "text-sm text-muted"}>{message}</p>
        </div>
      </div>
      <Dialog open={confirming} onClose={() => setConfirming(false)} title={`Delete "${name}"?`} description={location === "none" ? "This can't be undone." : "This menu is on the site. Removing it leaves that place empty."}>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(false)}>Keep it</Button>
          <Button variant="danger" disabled={pending} onClick={remove}>Delete menu</Button>
        </div>
      </Dialog>
    </form>
  );
}

function findItem(items: MenuItem[], id: string): MenuItem | undefined {
  for (const i of items) {
    if (i.id === id) return i;
    const inner = findItem(i.children, id);
    if (inner) return inner;
  }
}

function findPlace(items: MenuItem[], id: string, parentId: string | null = null): { parentId: string | null; index: number } | null {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === id) return { parentId, index: i };
    const inner = findPlace(items[i].children, id, items[i].id);
    if (inner) return inner;
  }
  return null;
}

function Move({ label, icon, onClick, disabled, danger }: { label: string; icon: IconName; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={cx("grid size-9 place-items-center rounded-ui hover:bg-surface-muted disabled:opacity-30", danger && "text-danger")}>
      <Icon name={icon} className="size-4" />
    </button>
  );
}

function AddFromList({ title, empty, options, onAdd }: { title: string; empty: string; options: Option[]; onAdd: (o: Option) => void }) {
  const [value, setValue] = useState("");
  const id = `add-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <Card title={title}>
      {options.length ? (
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <Select id={id} aria-label={title} value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="">Choose…</option>
              {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
          <Button variant="secondary" disabled={!value} onClick={() => { const o = options.find((x) => x.value === value); if (o) onAdd(o); setValue(""); }}>Add</Button>
        </div>
      ) : <p className="text-sm text-muted">{empty}</p>}
    </Card>
  );
}

function CustomLink({ onAdd }: { onAdd: (label: string, url: string) => void }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  return (
    <div className="space-y-3">
      <Field id="custom-label" label="Label"><Input id="custom-label" value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
      <Field id="custom-url" label="Link"><Input id="custom-url" value={url} placeholder="/shop or https://example.com" onChange={(e) => setUrl(e.target.value)} /></Field>
      <Button variant="secondary" disabled={!label.trim() || !url.trim()} onClick={() => { onAdd(label.trim(), url.trim()); setLabel(""); setUrl(""); }}>Add link</Button>
    </div>
  );
}

function MenuPreview({ items }: { items: MenuItem[] }) {
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-3 text-sm" aria-label="Menu preview">
      {items.map((i) => (
        <li key={i.id}>
          <span className="font-medium">{i.label || "Untitled"}</span>
          {i.children.length > 0 && (
            <ul className="mt-1 space-y-1 border-l border-line pl-2 text-muted">
              {i.children.map((c) => (
                <li key={c.id}>
                  {c.label || "Untitled"}
                  {c.children.length > 0 && <ul className="mt-1 space-y-1 border-l border-line pl-2">{c.children.map((d) => <li key={d.id}>{d.label || "Untitled"}</li>)}</ul>}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
