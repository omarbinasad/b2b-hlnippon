import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blockIdsIn, blockMarker, expandBlocks, markersAsText, stripBlockMarkers, validateBlock } from "../src/lib/content/blocks.ts";
import { compareSnapshots, diffWords, sameSnapshot, snapshotOf, wordCount } from "../src/lib/content/revisions.ts";
import { htmlToText, sanitizeHtml, sanitizeRichHtml } from "../src/lib/html/sanitize.ts";
import type { BlogPost, ContentPage, ContentSnapshot } from "../src/lib/types/content.ts";

const AT = "2026-01-01T00:00:00+09:00";
const page = (patch: Partial<ContentPage> = {}): ContentPage => ({
  id: "page-1", slug: "terms", title: "Terms", excerpt: "", bodyHtml: "<p>Delivery takes two days.</p>", status: "published", seo: {}, authorName: "A", createdAt: AT, updatedAt: AT, visibility: "public", ...patch,
});
const snap = (patch: Partial<ContentSnapshot> = {}): ContentSnapshot => ({ ...snapshotOf("page", page()), ...patch });

describe("revision snapshots", () => {
  it("keeps the editable fields of a page or post, not its status", () => {
    const s = snapshotOf("page", page());
    assert.equal(s.visibility, "public");
    assert.equal("status" in s, false);
    const post = { ...page(), categories: ["News"], tags: ["a"], tag: "News", readingMinutes: 1 } as BlogPost;
    assert.deepEqual(snapshotOf("post", post).categories, ["News"]);
  });
  it("treats key order and empty SEO values as the same content", () => {
    assert.ok(sameSnapshot(snap({ seo: { title: "T", description: "" } }), snap({ seo: { title: "T" } })));
    assert.ok(!sameSnapshot(snap(), snap({ title: "Terms of sale" })));
    assert.ok(!sameSnapshot(snap(), snap({ bodyHtml: "<p><strong>Delivery</strong> takes two days.</p>" })));
  });
  it("counts words, including block markers as one line", () => {
    assert.equal(wordCount("<p>One two three</p>"), 3);
    assert.equal(wordCount(`<p>Hi</p>${blockMarker("blk-a", "Notice")}`), 4);
  });
});

describe("word diff", () => {
  const join = (parts: ReturnType<typeof diffWords>, type: string) => parts.filter((p) => p.type === type).map((p) => p.text).join("");
  it("marks added and removed words and keeps the rest", () => {
    const parts = diffWords("Delivery takes two days.", "Delivery takes three working days.");
    assert.equal(join(parts, "removed").trim(), "two");
    assert.equal(join(parts, "added").trim(), "three working");
    assert.equal(parts.map((p) => (p.type === "removed" ? "" : p.text)).join(""), "Delivery takes three working days.");
    assert.equal(parts.map((p) => (p.type === "added" ? "" : p.text)).join(""), "Delivery takes two days.");
  });
  it("returns one unchanged part for equal text", () => {
    assert.deepEqual(diffWords("same text", "same text"), [{ type: "same", text: "same text" }]);
  });
  it("handles empty sides and very long changes", () => {
    assert.deepEqual(diffWords("", "new"), [{ type: "added", text: "new" }]);
    const a = Array.from({ length: 3000 }, (_, i) => `a${i}`).join(" ");
    const b = Array.from({ length: 3000 }, (_, i) => `b${i}`).join(" ");
    const parts = diffWords(a, b);
    assert.equal(parts.length, 2);
  });
});

describe("compare versions", () => {
  it("lists only changed fields, in form order", () => {
    const { changes, unchanged } = compareSnapshots(snap(), snap({ title: "Terms of sale", seo: { description: "Rules" } }));
    assert.deepEqual(changes.map((c) => c.label), ["Title", "Meta description"]);
    assert.ok(unchanged.includes("Content"));
  });
  it("notices a change in formatting only", () => {
    const { changes } = compareSnapshots(snap(), snap({ bodyHtml: '<p>Delivery takes <a href="/shipping">two days</a>.</p>' }));
    assert.equal(changes[0].label, "Content");
    assert.match(changes[0].parts[0].text, /Formatting, links or images changed/);
  });
});

describe("reusable blocks", () => {
  const marker = blockMarker("blk-notice", 'Holiday "notice"');
  it("finds block ids once each and ignores bad ids", () => {
    const html = `<p>a</p>${marker}<p>b</p>${marker}<div data-block="javascript:x" data-name="x"></div>`;
    assert.deepEqual(blockIdsIn(html), ["blk-notice"]);
  });
  it("expands markers with the block's current content and drops missing blocks", () => {
    const html = `<p>Intro</p>${marker}${blockMarker("blk-gone", "Gone")}`;
    const out = expandBlocks(html, new Map([["blk-notice", { kind: "announcement" as const, bodyHtml: `<p>Closed Monday</p>${blockMarker("blk-notice", "loop")}` }]]));
    assert.equal(out, '<p>Intro</p><div data-block-kind="announcement"><p>Closed Monday</p></div>');
  });
  it("strips markers from a block's own content", () => {
    assert.equal(stripBlockMarkers(`<p>x</p>${marker}`), "<p>x</p>");
  });
  it("shows markers as readable lines in text views", () => {
    assert.match(htmlToText(markersAsText(marker)), /\[Reusable block: Holiday &quot;notice&quot;\]|\[Reusable block: Holiday "notice"\]/);
  });
  it("validates name, type and content", () => {
    assert.deepEqual(validateBlock({ name: "Notice", kind: "cta", bodyHtml: "<p>Hi</p>" }, htmlToText), {});
    const e = validateBlock({ name: "x", kind: "nope" as never, bodyHtml: "<p> </p>" }, htmlToText);
    assert.ok(e.name && e.kind && e.bodyHtml);
  });
});

describe("sanitizer and blocks", () => {
  it("keeps a valid marker, escaped, and closes it", () => {
    const out = sanitizeRichHtml('<div data-block="blk-a1" data-name="A &quot;b&quot; &lt;c&gt;" onclick="x()">inside</div>');
    assert.equal(out, '<div data-block="blk-a1" data-name="A &quot;b&quot; &lt;c&gt;"></div>inside');
  });
  it("drops markers with bad ids and plain divs, keeping their text", () => {
    assert.equal(sanitizeRichHtml('<div data-block="../x">t</div><div class="y">u</div>'), "tu");
  });
  it("keeps the block wrapper only for known kinds", () => {
    assert.equal(sanitizeRichHtml('<div data-block-kind="cta"><p>Go</p></div>'), '<div data-block-kind="cta"><p>Go</p></div>');
    assert.equal(sanitizeRichHtml('<div data-block-kind="evil" style="x"><p>Go</p></div>'), "<p>Go</p>");
  });
  it("leaves plain (non-editor) sanitizing unchanged", () => {
    assert.equal(sanitizeHtml('<div data-block="blk-a">t</div>'), "t");
  });
  it("is stable when run twice on expanded content", () => {
    const once = sanitizeRichHtml(expandBlocks(sanitizeRichHtml(`<p>a</p>${blockMarker("blk-a", "A")}`), new Map([["blk-a", { kind: "banner" as const, bodyHtml: "<h3>Sale</h3>" }]])));
    assert.equal(sanitizeRichHtml(once), once);
    assert.equal(once, '<p>a</p><div data-block-kind="banner"><h3>Sale</h3></div>');
  });
});

describe("publishing a page that is only a block", () => {
  it("counts a block marker as content", async () => {
    const { validateContent } = await import("../src/lib/content/rules.ts");
    const base = { slug: "notice", title: "Notice", excerpt: "", status: "published" as const, seo: {} };
    assert.equal(validateContent({ ...base, bodyHtml: blockMarker("blk-a", "A") }, { taken: () => false }).bodyHtml, undefined);
    assert.ok(validateContent({ ...base, bodyHtml: "<p> </p>" }, { taken: () => false }).bodyHtml);
  });
});
