/**
 * Reusable content blocks: pure rules shared by the editor, the mock and the page renderer. The backend must apply the
 * same: validate on save, store pages with the embed marker below, and expand blocks when serving a page.
 *
 * In page HTML a block is an empty marker: `<div data-block="blk-…" data-name="Holiday notice"></div>`. The sanitizer
 * keeps only that form. When a page is shown, each marker is replaced by the block's current content wrapped in
 * `<div data-block-kind="cta">…</div>`, so editing a block changes every page that uses it. Blocks can't contain blocks.
 */
import type { ContentBlockInput, ContentBlockKind } from "../types/content.ts";

export const BLOCK_KINDS: { value: ContentBlockKind; label: string; hint: string; starter: string }[] = [
  { value: "announcement", label: "Announcement", hint: "A short notice, such as holiday hours or a delivery change.", starter: "<p><strong>Notice:</strong> Orders placed on public holidays are packed on the next working day.</p>" },
  { value: "banner", label: "Banner", hint: "A highlighted message with a heading.", starter: "<h3>Stock up for the new season</h3><p>Plan your next order early to secure the quantities you need.</p>" },
  { value: "cta", label: "Call to action", hint: "Invites visitors to take one step, with a link.", starter: '<h3>Open a business account</h3><p>Approved businesses see wholesale prices and can reorder in a few clicks.</p><p><a href="/register">Apply for an account</a></p>' },
  { value: "contact", label: "Contact details", hint: "How to reach the team.", starter: '<h3>Questions about an order?</h3><p>Our team answers on working days.</p><p><a href="/contact">Contact us</a></p>' },
  { value: "productPromo", label: "Product promotion", hint: "Points visitors to a product or category.", starter: '<h3>Featured this month</h3><p>Describe the product and why it is worth ordering.</p><p><a href="/shop">See the product</a></p>' },
];

export const blockKindLabel = (kind: ContentBlockKind) => BLOCK_KINDS.find((k) => k.value === kind)?.label ?? kind;
export const isBlockKind = (v: unknown): v is ContentBlockKind => BLOCK_KINDS.some((k) => k.value === v);

/** Block ids look like "blk-1a2b3c4d". The sanitizer keeps a marker only with an id of this shape. */
export const BLOCK_ID = /^blk-[a-z0-9-]{1,40}$/;

const MARKER = /<div\b[^>]*\bdata-block="([^"]*)"[^>]*>\s*<\/div>/gi;

/** Ids of the blocks a page uses, in order, without repeats. */
export function blockIdsIn(html: string): string[] {
  const ids = new Set<string>();
  for (const m of html.matchAll(MARKER)) if (BLOCK_ID.test(m[1])) ids.add(m[1]);
  return [...ids];
}

const escapeAttr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The marker the editor inserts. */
export const blockMarker = (id: string, name: string) => `<div data-block="${escapeAttr(id)}" data-name="${escapeAttr(name.slice(0, 80))}"></div>`;

/** Removes every block marker (a block's own content can't hold blocks). */
export const stripBlockMarkers = (html: string) => html.replace(MARKER, "");

/**
 * Replaces each marker with the block's content. A block that no longer exists disappears. Expects sanitized HTML on
 * both sides; the result is sanitized again when rendered.
 */
export function expandBlocks(html: string, blocks: Map<string, { kind: ContentBlockKind; bodyHtml: string }>): string {
  return html.replace(MARKER, (_, id: string) => {
    const b = blocks.get(id);
    return b ? `<div data-block-kind="${b.kind}">${stripBlockMarkers(b.bodyHtml)}</div>` : "";
  });
}

/** For text views (revision compare): a marker becomes a readable line. */
export const markersAsText = (html: string) =>
  html.replace(MARKER, (whole: string) => `<p>[Reusable block: ${/\bdata-name="([^"]*)"/i.exec(whole)?.[1] || "unnamed"}]</p>`);

export function validateBlock(input: ContentBlockInput, textOf: (html: string) => string): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = input.name.trim();
  if (name.length < 2) errors.name = "Give the block a name, at least 2 characters.";
  else if (name.length > 80) errors.name = "Keep the name under 80 characters.";
  if (!isBlockKind(input.kind)) errors.kind = "Choose a block type.";
  if (input.bodyHtml.length > 50_000) errors.bodyHtml = "This block is too long. Keep it under 50,000 characters of content.";
  else if (!textOf(input.bodyHtml).trim() && !/<img\b/i.test(input.bodyHtml)) errors.bodyHtml = "Write the block's content.";
  return errors;
}
