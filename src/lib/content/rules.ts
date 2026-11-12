/** Pure publishing rules for pages and posts, shared by the forms and the mock. The backend must enforce the same. */
import { htmlToText, sanitizeRichHtml } from "../html/sanitize.ts";
import { blockIdsIn } from "./blocks.ts";
import type { ContentInput, ContentStatus } from "../types/content.ts";

type Errors = Record<string, string>;

/** URLs the app already uses at the top level; a CMS page can't take them. */
export const RESERVED_SLUGS = ["about", "account", "admin", "api", "application-pending", "blog", "cart", "checkout", "contact", "forgot-password", "login", "reset-password", "media", "preview", "register", "shop"];

export const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export const isSlug = (s: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);

/** Visible to the public: published, or scheduled and the time has come. */
export function isLive(item: { status: ContentStatus; publishedAt?: string }, now = Date.now()) {
  if (item.status === "published") return true;
  return item.status === "scheduled" && !!item.publishedAt && Date.parse(item.publishedAt) <= now;
}

/** How the status reads in lists: a scheduled item past its time counts as published. */
export const effectiveStatus = (item: { status: ContentStatus; publishedAt?: string }, now = Date.now()): ContentStatus => (item.status === "scheduled" && isLive(item, now) ? "published" : item.status);

export function validateContent(input: ContentInput, options: { taken: (slug: string) => boolean; reserved?: boolean; now?: number }): Errors {
  const errors: Errors = {};
  const title = input.title.trim();
  if (title.length < 2) errors.title = "Enter a title.";
  else if (title.length > 160) errors.title = "Keep the title under 160 characters.";
  if (!isSlug(input.slug)) errors.slug = "Use lowercase letters, numbers and hyphens, e.g. delivery-terms.";
  else if (options.reserved && RESERVED_SLUGS.includes(input.slug)) errors.slug = "This address is used by another part of the site.";
  else if (options.taken(input.slug)) errors.slug = "Another item already uses this address.";
  if (input.excerpt.length > 300) errors.excerpt = "Keep the excerpt under 300 characters.";
  // A reusable block or an image counts as content: a page can be just a block.
  if (input.status === "published") {
    const clean = sanitizeRichHtml(input.bodyHtml);
    if (!htmlToText(clean).trim() && !blockIdsIn(clean).length && !/<img\b/.test(clean)) errors.bodyHtml = "Add some content before publishing.";
  }
  if (input.status === "scheduled") {
    const at = input.publishedAt ? Date.parse(input.publishedAt) : Number.NaN;
    if (Number.isNaN(at)) errors.publishedAt = "Choose when to publish.";
    else if (at <= (options.now ?? Date.now())) errors.publishedAt = "Choose a time in the future, or publish now.";
  }
  const seo = input.seo;
  if ((seo.title ?? "").length > 70) errors["seo.title"] = "Search engines cut titles after about 60 characters.";
  if ((seo.description ?? "").length > 200) errors["seo.description"] = "Search engines cut descriptions after about 160 characters.";
  if (seo.canonicalUrl && !/^https?:\/\/\S+$/.test(seo.canonicalUrl)) errors["seo.canonicalUrl"] = "Use a full link starting with https://";
  if (seo.ogImage && !/^(?:https:\/\/\S+|\/(?!\/)\S+)$/.test(seo.ogImage)) errors["seo.ogImage"] = "Use an image from the media library.";
  return errors;
}

/** Whole minutes at 200 words a minute, at least one. */
export const readingMinutes = (html: string) => Math.max(1, Math.round(htmlToText(html).split(/\s+/).filter(Boolean).length / 200));
