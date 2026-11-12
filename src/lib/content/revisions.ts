/**
 * Content revisions: pure rules shared by the mock and the compare screen. The backend must keep the same history
 * (a revision on every save that changes the content, newest 25 per item) and the same restore rule.
 */
import { htmlToText } from "../html/sanitize.ts";
import type { BlogPost, ContentKind, ContentPage, ContentSnapshot } from "../types/content.ts";
import { markersAsText } from "./blocks.ts";

/** Revisions kept per page or post; the oldest go first. */
export const REVISION_LIMIT = 25;

export function snapshotOf(kind: ContentKind, item: ContentPage | BlogPost): ContentSnapshot {
  const base: ContentSnapshot = { title: item.title, slug: item.slug, excerpt: item.excerpt, bodyHtml: item.bodyHtml, image: item.image, seo: { ...item.seo } };
  if (kind === "page") return { ...base, visibility: (item as ContentPage).visibility };
  const post = item as BlogPost;
  return { ...base, categories: [...post.categories], tags: [...post.tags] };
}

/** Stable form for comparing two snapshots (key order and empty values don't count). */
function normal(s: ContentSnapshot) {
  const seo = Object.fromEntries(Object.entries(s.seo).filter(([, v]) => v).sort(([a], [b]) => a.localeCompare(b)));
  return JSON.stringify([s.title, s.slug, s.excerpt, s.bodyHtml, s.image?.src ?? "", s.image?.alt ?? "", seo, s.visibility ?? "", s.categories ?? [], s.tags ?? []]);
}

export const sameSnapshot = (a: ContentSnapshot, b: ContentSnapshot) => normal(a) === normal(b);

export const bodyText = (html: string) => htmlToText(markersAsText(html));

export const wordCount = (html: string) => bodyText(html).split(/\s+/).filter(Boolean).length;

export type DiffPart = { type: "same" | "added" | "removed"; text: string };

/** Above this many changed words on each side, the compare shows "replaced" instead of a word-by-word diff. */
const DIFF_CELLS = 2_000_000;

/** Word-level diff (words and the spaces after them), with the unchanged start and end trimmed before the LCS. */
export function diffWords(before: string, after: string): DiffPart[] {
  const a = before.match(/\S+\s*|\s+/g) ?? [];
  const b = after.match(/\S+\s*|\s+/g) ?? [];
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const parts: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    if (!text) return;
    const last = parts.at(-1);
    if (last?.type === type) last.text += text;
    else parts.push({ type, text });
  };
  push("same", a.slice(0, start).join(""));
  if (midA.length * midB.length > DIFF_CELLS) {
    push("removed", midA.join(""));
    push("added", midB.join(""));
  } else {
    // LCS table, filled from the end so the walk below goes forwards.
    const n = midA.length;
    const m = midB.length;
    const t = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i][j] = midA[i] === midB[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (midA[i] === midB[j]) { push("same", midA[i]); i++; j++; }
      else if (t[i + 1][j] >= t[i][j + 1]) push("removed", midA[i++]);
      else push("added", midB[j++]);
    }
    while (i < n) push("removed", midA[i++]);
    while (j < m) push("added", midB[j++]);
  }
  push("same", a.slice(endA).join(""));
  return parts;
}

export interface FieldChange {
  label: string;
  parts: DiffPart[];
}

/** The fields that differ between two versions, in form order, each as a word diff. */
export function compareSnapshots(before: ContentSnapshot, after: ContentSnapshot): { changes: FieldChange[]; unchanged: string[] } {
  const fields: [string, string, string][] = [
    ["Title", before.title, after.title],
    ["Address", before.slug, after.slug],
    ["Content", bodyText(before.bodyHtml), bodyText(after.bodyHtml)],
    ["Excerpt", before.excerpt, after.excerpt],
    ["Featured image", before.image ? `${before.image.src} (${before.image.alt || "no description"})` : "None", after.image ? `${after.image.src} (${after.image.alt || "no description"})` : "None"],
    ["SEO title", before.seo.title ?? "", after.seo.title ?? ""],
    ["Meta description", before.seo.description ?? "", after.seo.description ?? ""],
    ["Canonical URL", before.seo.canonicalUrl ?? "", after.seo.canonicalUrl ?? ""],
    ["Sharing image", before.seo.ogImage ?? "", after.seo.ogImage ?? ""],
  ];
  if (before.visibility !== undefined || after.visibility !== undefined) fields.push(["Visibility", before.visibility ?? "", after.visibility ?? ""]);
  if (before.categories || after.categories) fields.push(["Categories", (before.categories ?? []).join(", "), (after.categories ?? []).join(", ")]);
  if (before.tags || after.tags) fields.push(["Tags", (before.tags ?? []).join(", "), (after.tags ?? []).join(", ")]);
  const changes: FieldChange[] = [];
  const unchanged: string[] = [];
  for (const [label, a, b] of fields) {
    // The content compares as text, but a change only in formatting or links still counts.
    const differs = label === "Content" ? a !== b || before.bodyHtml !== after.bodyHtml : a !== b;
    if (!differs) unchanged.push(label);
    else changes.push({ label, parts: a === b ? [{ type: "same", text: `${a}\n(Formatting, links or images changed.)` }] : diffWords(a, b) });
  }
  return { changes, unchanged };
}
