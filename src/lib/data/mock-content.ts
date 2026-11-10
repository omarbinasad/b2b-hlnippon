import "server-only";

import { effectiveStatus, isLive, readingMinutes, validateContent } from "@/lib/content/rules";
import { validateMenu } from "@/lib/content/menu";
import { sanitizeRichHtml } from "@/lib/html/sanitize";
import type { BlogPost, BlogPostInput, BlogPostSummary, ContentInput, ContentPage, ContentPageInput, ContentStatus, FieldErrors, MenuItem, NavigationMenu, ResolvedMenuItem, TermKind } from "@/lib/types";
import { validateSiteContent } from "@/lib/validation/site-content";
import { seedPosts } from "./mock/posts";
import { HERO_SLIDE, HERO_SLIDES, seedMenus, seedPages, seedSiteContent } from "./mock/site-content";
import { clone, invalid, now } from "./mock-store-helpers";
import { matches, paginate, sortBy, type SortKey } from "./mock-utils";
import type { ContentListQuery, NavigationRepository, PageRepository, PostRepository, SiteContentRepository } from "./repositories";

/* DEMO STORE: website content lives in server memory; edits survive refreshes but not a restart. */
const store = globalThis as typeof globalThis & {
  __mockContentV2?: { pages: ContentPage[]; posts: BlogPost[]; menus: NavigationMenu[]; site: typeof seedSiteContent; extraTerms: Record<TermKind, string[]> };
};
store.__mockContentV2 ??= { pages: structuredClone(seedPages), posts: structuredClone(seedPosts), menus: structuredClone(seedMenus), site: structuredClone(seedSiteContent), extraTerms: { category: [], tag: [] } };
const db = store.__mockContentV2;

// A server already running when the owner removed featured products from the sample homepage follows, once.
const homeFlags = globalThis as typeof globalThis & { __mockFeaturedOffApplied?: boolean };
if (!homeFlags.__mockFeaturedOffApplied) {
  homeFlags.__mockFeaturedOffApplied = true;
  const featured = db.site.sections.find((s) => s.type === "featuredProducts");
  if (featured) featured.enabled = false;
}

// A server already running when this section arrived gains it, keeping any homepage edits.
if (!db.site.sections.some((s) => s.type === "brands")) {
  const seed = seedSiteContent.sections.find((s) => s.type === "brands");
  const after = db.site.sections.findIndex((s) => s.type === "business");
  if (seed) db.site.sections.splice(after + 1, 0, structuredClone(seed));
}

// A server already running with the earlier sample hero switches to the owner's photo design, once. Edited heroes are kept.
const heroFlags = globalThis as typeof globalThis & { __mockPhotoHeroApplied?: boolean };
if (!heroFlags.__mockPhotoHeroApplied) {
  heroFlags.__mockPhotoHeroApplied = true;
  const hero = db.site.sections.find((s) => s.type === "hero");
  if (hero?.type === "hero" && hero.slides[0]?.title === "Reliable halal supply for your business") hero.slides = [structuredClone(HERO_SLIDE)];
}

// Once, for a running server: the hero becomes a three-slide carousel (if it's still the one sample slide), and the
// header menu drops Quick order, as the owner asked. Anything edited since is left alone.
const v3 = globalThis as typeof globalThis & { __mockHomeV3Applied?: boolean };
if (!v3.__mockHomeV3Applied) {
  v3.__mockHomeV3Applied = true;
  const hero = db.site.sections.find((s) => s.type === "hero");
  if (hero?.type === "hero" && hero.slides.length === 1 && hero.slides[0].title === HERO_SLIDE.title) hero.slides = structuredClone(HERO_SLIDES);
  const header = db.menus.find((m) => m.id === "menu-header");
  if (header) header.items = header.items.filter((i) => !(i.id === "mi-quick" && i.label === "Quick order"));
}

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

function listContent<T extends ContentPage | BlogPost>(items: T[], { search, status, sort = "updated", dir, page, perPage }: ContentListQuery, extra: (item: T) => boolean = () => true) {
  const filtered = items.filter((i) => {
    const s = effectiveStatus(i);
    return (status ? s === status : s !== "trash") && extra(i) && matches(search, i.title, i.slug, i.excerpt);
  });
  const key = (i: T): SortKey => (sort === "title" ? i.title.toLowerCase() : sort === "published" ? i.publishedAt : i.updatedAt);
  return paginate(sortBy(filtered, key, dir ?? (sort === "title" ? "asc" : "desc")), page, perPage);
}

function counts(items: { status: ContentStatus; publishedAt?: string }[]) {
  const c: Record<ContentStatus, number> = { draft: 0, published: 0, scheduled: 0, trash: 0 };
  for (const i of items) c[effectiveStatus(i)] += 1;
  return c;
}

/** Fields both content types take from the form. Publishing without a date stamps the current time. */
function applyInput(input: ContentInput, existing?: { publishedAt?: string }) {
  return {
    slug: input.slug.trim(),
    title: input.title.trim(),
    excerpt: input.excerpt.trim(),
    bodyHtml: sanitizeRichHtml(input.bodyHtml),
    status: input.status,
    publishedAt: input.status === "scheduled" ? input.publishedAt : input.status === "published" ? (existing?.publishedAt && Date.parse(existing.publishedAt) <= Date.now() ? existing.publishedAt : now()) : existing?.publishedAt,
    image: input.image,
    seo: input.seo,
  };
}

function trash<T extends ContentPage | BlogPost>(items: T[], id: string) {
  const item = items.find((i) => i.id === id);
  if (item && item.status !== "trash") {
    item.trashedFrom = item.status;
    item.status = "trash";
    item.updatedAt = now();
  }
}

function restore<T extends ContentPage | BlogPost>(items: T[], id: string) {
  const item = items.find((i) => i.id === id);
  if (item?.status === "trash") {
    item.status = item.trashedFrom ?? "draft";
    item.trashedFrom = undefined;
    item.updatedAt = now();
  }
}

export const mockPageRepository: PageRepository = {
  async getLiveBySlug(slug) {
    const p = db.pages.find((x) => x.slug === slug && isLive(x));
    return p ? clone(p) : null;
  },
  async listLive() {
    return clone(db.pages.filter((p) => isLive(p)));
  },
  async adminList(query = {}) {
    return clone(listContent(db.pages, query));
  },
  async statusCounts() {
    return counts(db.pages);
  },
  async getById(id) {
    const p = db.pages.find((x) => x.id === id);
    return p ? clone(p) : null;
  },
  async save(id, input: ContentPageInput, actor) {
    const errors = validateContent(input, { reserved: true, taken: (slug) => db.pages.some((p) => p.slug === slug && p.id !== id) });
    if (Object.keys(errors).length) return invalid(errors);
    const at = now();
    const existing = id ? db.pages.find((p) => p.id === id) : undefined;
    if (id && !existing) return { ok: false, errors: {} as FieldErrors, message: "That page no longer exists." };
    const next: ContentPage = { ...(existing ?? { id: newId("page"), authorName: actor.name, createdAt: at }), ...applyInput(input, existing), visibility: input.visibility, updatedAt: at };
    if (existing) Object.assign(existing, next);
    else db.pages.unshift(next);
    return { ok: true, value: clone(next) };
  },
  async trash(id) {
    trash(db.pages, id);
  },
  async restore(id) {
    restore(db.pages, id);
  },
  async deleteForever(id) {
    const i = db.pages.findIndex((p) => p.id === id && p.status === "trash");
    if (i >= 0) db.pages.splice(i, 1);
  },
};

const termsOf = (p: BlogPost, kind: TermKind) => (kind === "category" ? p.categories : p.tags);
const termNames = (kind: TermKind) => [...new Set([...db.posts.flatMap((p) => termsOf(p, kind)), ...db.extraTerms[kind]])].sort((a, b) => a.localeCompare(b));

const summary = ({ id, slug, title, excerpt, tag, image, authorName, publishedAt, readingMinutes: r }: BlogPost): BlogPostSummary => ({ id, slug, title, excerpt, tag, image, authorName, publishedAt, readingMinutes: r });
const liveNewest = () => sortBy(db.posts.filter((p) => isLive(p)), (p) => p.publishedAt, "desc");

export const mockPostRepository: PostRepository = {
  async list({ excludeSlug, limit } = {}) {
    return clone(liveNewest().filter((p) => p.slug !== excludeSlug).slice(0, limit).map(summary));
  },
  async getBySlug(slug) {
    const p = db.posts.find((x) => x.slug === slug && isLive(x));
    return p ? clone(p) : null;
  },
  async archive({ search, category, categories, page, perPage }) {
    const wanted = [...(categories ?? []), ...(category ? [category] : [])];
    const filtered = liveNewest().filter((p) => (!wanted.length || wanted.some((c) => p.categories.includes(c))) && matches(search, p.title, p.excerpt, ...p.tags, ...p.categories));
    const result = paginate(filtered, page, perPage);
    return clone({ ...result, items: result.items.map(summary) });
  },
  async categories() {
    return termNames("category");
  },
  async terms(kind) {
    return termNames(kind).map((name) => ({ name, count: db.posts.filter((p) => p.status !== "trash" && termsOf(p, kind).includes(name)).length }));
  },
  async saveTerm(kind, from, raw) {
    const name = raw.trim();
    const bad = (message: string) => ({ ok: false as const, errors: { name: message } as FieldErrors, message });
    if (name.length < 2 || name.length > 40) return bad("Use 2 to 40 characters.");
    if (name.includes(",")) return bad("A name can't contain a comma.");
    const clash = termNames(kind).find((t) => t.toLowerCase() === name.toLowerCase());
    if (clash && clash !== from) return bad("That name is already in use.");
    if (from === null) db.extraTerms[kind].push(name);
    else {
      db.extraTerms[kind] = db.extraTerms[kind].map((t) => (t === from ? name : t));
      for (const p of db.posts) {
        const next = termsOf(p, kind).map((t) => (t === from ? name : t));
        if (kind === "category") {
          p.categories = next;
          p.tag = next[0] ?? "";
        } else p.tags = next;
      }
    }
    return { ok: true, value: { name } };
  },
  async deleteTerm(kind, name) {
    if (kind === "category" && db.posts.some((p) => isLive(p) && p.categories.length === 1 && p.categories[0] === name)) {
      return { ok: false, errors: {} as FieldErrors, message: "A published post has only this category. Give it another category first." };
    }
    db.extraTerms[kind] = db.extraTerms[kind].filter((t) => t !== name);
    for (const p of db.posts) {
      const next = termsOf(p, kind).filter((t) => t !== name);
      if (kind === "category") {
        p.categories = next;
        p.tag = next[0] ?? "";
      } else p.tags = next;
    }
    return { ok: true, value: { name } };
  },
  async adminList({ category, ...query } = {}) {
    return clone(listContent(db.posts, query, (p) => !category || p.categories.includes(category)));
  },
  async statusCounts() {
    return counts(db.posts);
  },
  async getById(id) {
    const p = db.posts.find((x) => x.id === id);
    return p ? clone(p) : null;
  },
  async save(id, input: BlogPostInput, actor) {
    const errors = validateContent(input, { taken: (slug) => db.posts.some((p) => p.slug === slug && p.id !== id) });
    const clean = (list: string[]) => [...new Set(list.map((c) => c.trim()).filter(Boolean))].slice(0, 12);
    const categories = clean(input.categories);
    if (input.status === "published" && !categories.length) errors.categories = "Add at least one category before publishing.";
    if (Object.keys(errors).length) return invalid(errors);
    const at = now();
    const existing = id ? db.posts.find((p) => p.id === id) : undefined;
    if (id && !existing) return { ok: false, errors: {} as FieldErrors, message: "That post no longer exists." };
    const applied = applyInput(input, existing);
    const next: BlogPost = {
      ...(existing ?? { id: newId("post"), authorName: actor.name, createdAt: at }),
      ...applied,
      categories,
      tags: clean(input.tags),
      tag: categories[0] ?? "",
      readingMinutes: readingMinutes(applied.bodyHtml),
      updatedAt: at,
    };
    if (existing) Object.assign(existing, next);
    else db.posts.unshift(next);
    return { ok: true, value: clone(next) };
  },
  async trash(id) {
    trash(db.posts, id);
  },
  async restore(id) {
    restore(db.posts, id);
  },
  async deleteForever(id) {
    const i = db.posts.findIndex((p) => p.id === id && p.status === "trash");
    if (i >= 0) db.posts.splice(i, 1);
  },
};

function resolveItems(items: MenuItem[]): ResolvedMenuItem[] {
  return items.flatMap((item): ResolvedMenuItem[] => {
    let href: string | undefined;
    if (item.kind === "custom") href = item.url;
    else if (item.kind === "category") href = `/shop?category=${encodeURIComponent(item.ref ?? "")}`;
    else {
      const page = db.pages.find((p) => p.id === item.ref && isLive(p));
      href = page && `/${page.slug}`;
    }
    const children = resolveItems(item.children);
    // A link to a page that isn't live disappears; a parent with live children stays as a heading.
    if (!href && !children.length) return [];
    return [{ id: item.id, label: item.label, href: href ?? "#", children }];
  });
}

export const mockNavigationRepository: NavigationRepository = {
  async list() {
    return clone(db.menus);
  },
  async getById(id) {
    const m = db.menus.find((x) => x.id === id);
    return m ? clone(m) : null;
  },
  async resolved(location) {
    const m = db.menus.find((x) => x.location === location);
    return m ? resolveItems(m.items) : [];
  },
  async save(id, input) {
    const errors = validateMenu(input);
    if (Object.keys(errors).length) return invalid(errors);
    const at = now();
    // A location holds one menu: taking it moves any other menu off that spot.
    if (input.location !== "none") for (const m of db.menus) if (m.id !== id && m.location === input.location) m.location = "none";
    const existing = id ? db.menus.find((m) => m.id === id) : undefined;
    if (id && !existing) return { ok: false, errors: {} as FieldErrors, message: "That menu no longer exists." };
    const next: NavigationMenu = { id: existing?.id ?? newId("menu"), name: input.name.trim(), location: input.location, items: input.items, updatedAt: at };
    if (existing) Object.assign(existing, next);
    else db.menus.push(next);
    return { ok: true, value: clone(next) };
  },
  async remove(id) {
    const i = db.menus.findIndex((m) => m.id === id);
    if (i >= 0) db.menus.splice(i, 1);
  },
};

export const mockSiteContentRepository: SiteContentRepository = {
  async get() {
    return clone(db.site);
  },
  async update(input) {
    const errors = validateSiteContent(input);
    if (Object.keys(errors).length) return invalid(errors);
    db.site = { ...clone(input), updatedAt: now() };
    return { ok: true, value: clone(db.site) };
  },
};
