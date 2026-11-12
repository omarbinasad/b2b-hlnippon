"use server";

/*
 * Website content mutations: pages, posts, menus, homepage. DEMO: kept in server memory. TODO(auth): the permission is
 * mocked; the backend must authorize every call and sanitize HTML on save.
 */
import { revalidatePath } from "next/cache";
import { actorWith } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { isBlockKind } from "@/lib/content/blocks";
import { htmlToText } from "@/lib/html/sanitize";
import type { ContentBlockKind, ContentInput, ContentKind, ContentSnapshot, ContentStatus, FieldErrors, MenuItem, MenuLocation, ProductImage, SiteContentInput } from "@/lib/types";

export type ContentActionResult<T = { id: string }> = { ok: true; value: T } | { ok: false; errors: FieldErrors; message: string };

const denied = { ok: false as const, errors: {}, message: "You don't have permission to edit website content (mock permission)." };
const str = (v: unknown, max = 500) => (typeof v === "string" ? v.slice(0, max) : "");
const opt = (v: unknown, max = 500) => str(v, max).trim() || undefined;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const list = (v: unknown, max = 12) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, max).map((x) => x.slice(0, 60)) : []);

/** Website content can appear on any page (menus, footer, home). */
const refresh = () => revalidatePath("/", "layout");

function image(v: unknown): ProductImage | undefined {
  const o = obj(v);
  const src = str(o.src, 300);
  if (!/^\/(?!\/)\S+$/.test(src)) return undefined;
  const n = (x: unknown, d: number) => (typeof x === "number" && x > 0 ? Math.round(x) : d);
  return { src, alt: str(o.alt, 200), width: n(o.width, 1200), height: n(o.height, 675) };
}

const STATUSES: ContentStatus[] = ["draft", "published", "scheduled"];

function contentInput(raw: unknown): ContentInput {
  const v = obj(raw);
  const seo = obj(v.seo);
  return {
    slug: str(v.slug, 90).trim(),
    title: str(v.title, 200),
    excerpt: str(v.excerpt, 400),
    bodyHtml: str(v.bodyHtml, 200_000),
    status: STATUSES.find((s) => s === v.status) ?? "draft",
    publishedAt: opt(v.publishedAt, 40),
    image: image(v.image),
    seo: { title: opt(seo.title, 100), description: opt(seo.description, 300), canonicalUrl: opt(seo.canonicalUrl, 300), ogImage: opt(seo.ogImage, 300) },
  };
}

function result<T extends { id: string }>(r: { ok: true; value: T } | { ok: false; errors: FieldErrors; message?: string }): ContentActionResult {
  if (!r.ok) return { ok: false, errors: r.errors, message: r.message ?? "Some fields need attention." };
  refresh();
  return { ok: true, value: { id: r.value.id } };
}

export async function savePageAction(id: string | null, raw: unknown): Promise<ContentActionResult> {
  const by = await actorWith(id ? "pages.edit" : "pages.create");
  if (!by) return denied;
  return result(await repositories.pages.save(id, { ...contentInput(raw), visibility: obj(raw).visibility === "customers" ? "customers" : "public" }, by));
}

export async function savePostAction(id: string | null, raw: unknown): Promise<ContentActionResult> {
  const by = await actorWith(id ? "posts.edit" : "posts.create");
  if (!by) return denied;
  const v = obj(raw);
  return result(await repositories.posts.save(id, { ...contentInput(raw), categories: list(v.categories), tags: list(v.tags, 30) }, by));
}

// --- Revisions and autosave --------------------------------------------------------------------

const kindOf = (v: unknown): ContentKind => (v === "post" ? "post" : "page");
const editCap = (kind: ContentKind) => (kind === "page" ? "pages.edit" : "posts.edit");

/** The form's fields as a snapshot (the same limits as a save). */
function snapshot(kind: ContentKind, raw: unknown): ContentSnapshot {
  const { slug, title, excerpt, bodyHtml, image: img, seo } = contentInput(raw);
  const v = obj(raw);
  const base = { slug, title, excerpt, bodyHtml, image: img, seo };
  return kind === "page" ? { ...base, visibility: v.visibility === "customers" ? "customers" : "public" } : { ...base, categories: list(v.categories), tags: list(v.tags, 30) };
}

export type AutosaveResult = { ok: true; savedAt: string } | { ok: false; message: string };

/** Keeps unsaved work for an existing page or post. Never changes what visitors see. */
export async function autosaveContentAction(rawKind: ContentKind, id: string, raw: unknown): Promise<AutosaveResult> {
  const kind = kindOf(rawKind);
  const by = await actorWith(editCap(kind));
  if (!by) return { ok: false, message: denied.message };
  const r = await repositories.contentHistory.autosave(kind, String(id), snapshot(kind, raw), by);
  return r.ok ? { ok: true, savedAt: r.value.savedAt } : { ok: false, message: r.message ?? "Couldn't autosave." };
}

export async function discardAutosaveAction(rawKind: ContentKind, id: string): Promise<ContentActionResult> {
  const kind = kindOf(rawKind);
  const by = await actorWith(editCap(kind));
  if (!by) return denied;
  await repositories.contentHistory.discardAutosave(kind, String(id), by);
  return { ok: true, value: { id: String(id) } };
}

export async function restoreRevisionAction(rawKind: ContentKind, id: string, revisionId: string): Promise<ContentActionResult> {
  const kind = kindOf(rawKind);
  const by = await actorWith(editCap(kind));
  if (!by) return denied;
  const r = await repositories.contentHistory.restoreRevision(kind, String(id), String(revisionId), by);
  if (!r.ok) return { ok: false, errors: r.errors, message: r.message ?? "That version can't be restored." };
  refresh();
  return { ok: true, value: { id: String(id) } };
}

// --- Reusable blocks ---------------------------------------------------------------------------

export async function saveBlockAction(id: string | null, raw: unknown): Promise<ContentActionResult> {
  const by = await actorWith(id ? "pages.edit" : "pages.create");
  if (!by) return denied;
  const v = obj(raw);
  const kind: ContentBlockKind = isBlockKind(v.kind) ? v.kind : "announcement";
  return result(await repositories.blocks.save(id, { name: str(v.name, 120), kind, bodyHtml: str(v.bodyHtml, 60_000) }, by));
}

export async function deleteBlockAction(id: string): Promise<ContentActionResult> {
  const by = await actorWith("pages.delete");
  if (!by) return denied;
  const r = await repositories.blocks.remove(String(id), by);
  if (!r.ok) return { ok: false, errors: r.errors, message: r.message ?? "That block couldn't be deleted." };
  refresh();
  return { ok: true, value: { id: String(id) } };
}

export type BlockChoice = { id: string; name: string; kind: ContentBlockKind; preview: string };

/** Blocks for the editor's "Insert block" dialog: anyone who can edit pages or posts may insert one. */
export async function pickBlocksAction(search: string): Promise<BlockChoice[]> {
  if (!(await actorWith("pages.edit")) && !(await actorWith("posts.edit"))) return [];
  const { items } = await repositories.blocks.list({ search: str(search, 100) || undefined, perPage: 20 });
  return items.map((b) => ({ id: b.id, name: b.name, kind: b.kind, preview: htmlToText(b.bodyHtml).slice(0, 140) }));
}

/** Row actions on the Pages and Posts lists. */
export async function contentRowAction(kind: "page" | "post", id: string, action: "trash" | "restore" | "delete"): Promise<ContentActionResult> {
  const by = await actorWith(kind === "page" ? "pages.delete" : "posts.delete");
  if (!by) return denied;
  const repo = kind === "page" ? repositories.pages : repositories.posts;
  if (action === "trash") await repo.trash(String(id), by);
  else if (action === "restore") await repo.restore(String(id), by);
  else if (action === "delete") await repo.deleteForever(String(id), by);
  refresh();
  return { ok: true, value: { id: String(id) } };
}

export async function saveTermAction(kind: "category" | "tag" | "brand", from: string | null, name: string): Promise<ContentActionResult<{ name: string }>> {
  if (!(await actorWith(kind === "brand" ? "products.edit" : "posts.edit"))) return denied;
  const r =
    kind === "brand"
      ? from === null ? await repositories.catalogSettings.createBrand(String(name)) : await repositories.catalogSettings.renameBrand(String(from), String(name))
      : await repositories.posts.saveTerm(kind === "tag" ? "tag" : "category", from === null ? null : String(from), String(name));
  if (!r.ok) return { ok: false, errors: r.errors, message: r.message ?? "Some fields need attention." };
  refresh();
  return { ok: true, value: { name: r.value.name } };
}

export async function deleteTermAction(kind: "category" | "tag" | "brand", name: string): Promise<ContentActionResult<{ name: string }>> {
  if (!(await actorWith(kind === "brand" ? "products.delete" : "posts.edit"))) return denied;
  const r = kind === "brand" ? await repositories.catalogSettings.deleteBrand(String(name)) : await repositories.posts.deleteTerm(kind === "tag" ? "tag" : "category", String(name));
  if (!r.ok) return { ok: false, errors: r.errors, message: r.message ?? "That couldn't be deleted." };
  refresh();
  return { ok: true, value: r.value };
}

function menuItems(v: unknown, depth = 1): MenuItem[] {
  if (!Array.isArray(v) || depth > 5) return [];
  return v.slice(0, 100).map((raw): MenuItem => {
    const o = obj(raw);
    const kind = o.kind === "page" || o.kind === "category" ? o.kind : "custom";
    return { id: str(o.id, 60) || crypto.randomUUID(), label: str(o.label, 100), kind, ref: opt(o.ref, 100), url: opt(o.url, 300), children: menuItems(o.children, depth + 1) };
  });
}

const LOCATIONS: MenuLocation[] = ["header", "footer", "none"];

export async function saveMenuAction(id: string | null, raw: unknown): Promise<ContentActionResult> {
  const by = await actorWith("menus.edit");
  if (!by) return denied;
  const v = obj(raw);
  return result(await repositories.navigation.save(id, { name: str(v.name, 100), location: LOCATIONS.find((l) => l === v.location) ?? "none", items: menuItems(v.items) }, by));
}

export async function deleteMenuAction(id: string): Promise<ContentActionResult> {
  const by = await actorWith("menus.edit");
  if (!by) return denied;
  await repositories.navigation.remove(String(id), by);
  refresh();
  return { ok: true, value: { id: String(id) } };
}

/**
 * Homepage and About content is a nested document; the repository validates it. Only known section ids are accepted,
 * so a request can't invent new section types.
 */
export async function saveSiteContentAction(raw: unknown): Promise<ContentActionResult> {
  const by = await actorWith("homepage.edit");
  if (!by) return denied;
  const v = obj(raw) as unknown as SiteContentInput;
  const current = await repositories.siteContent.get();
  const known = new Map(current.sections.map((s) => [s.id, s.type]));
  const sections = Array.isArray(v.sections) ? v.sections.filter((s) => known.get(obj(s).id as string) === obj(s).type) : [];
  if (sections.length !== current.sections.length) return { ok: false, errors: {}, message: "The page was out of date. Reload and try again." };
  const r = await repositories.siteContent.update({ topBar: str(v.topBar, 200), sections, about: v.about ?? current.about }, by);
  if (!r.ok) return { ok: false, errors: r.errors, message: r.message ?? "Some fields need attention." };
  refresh();
  return { ok: true, value: { id: "site" } };
}
