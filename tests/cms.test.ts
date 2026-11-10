import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { depthOf, indent, moveDown, moveItem, moveUp, outdent, removeItem, validateMenu } from "../src/lib/content/menu.ts";
import { effectiveStatus, isLive, readingMinutes, RESERVED_SLUGS, slugify, validateContent } from "../src/lib/content/rules.ts";
import { sanitizeRichHtml } from "../src/lib/html/sanitize.ts";
import { setupChecklist, type SetupFacts } from "../src/lib/company/setup-checklist.ts";
import { SAMPLE_COMPANY } from "../src/config/sample-company.ts";
import { isOpenOrder } from "../src/lib/orders/status.ts";
import type { ContentInput, MenuItem } from "../src/lib/types/content.ts";

const input = (patch: Partial<ContentInput> = {}): ContentInput => ({ slug: "a-page", title: "A page", excerpt: "", bodyHtml: "<p>Hello</p>", status: "draft", seo: {}, ...patch });
const free = { taken: () => false };

describe("slugs", () => {
  it("makes readable addresses", () => {
    assert.equal(slugify("  Café & Delivery Terms! "), "cafe-delivery-terms");
  });
  it("refuses bad, reserved and duplicate addresses", () => {
    assert.ok(validateContent(input({ slug: "Bad Slug" }), free).slug);
    for (const slug of RESERVED_SLUGS) assert.ok(validateContent(input({ slug }), { ...free, reserved: true }).slug, slug);
    assert.ok(validateContent(input(), { taken: () => true }).slug);
  });
  it("posts may use a reserved word, since they live under /blog", () => {
    assert.ok(!validateContent(input({ slug: "shop" }), free).slug);
  });
});

describe("publishing rules", () => {
  it("a draft can be empty; a published item can't", () => {
    assert.ok(!validateContent(input({ bodyHtml: "" }), free).bodyHtml);
    assert.ok(validateContent(input({ bodyHtml: "<p> </p>", status: "published" }), free).bodyHtml);
  });
  it("scheduling needs a future time", () => {
    const now = Date.parse("2026-06-01T00:00:00Z");
    assert.ok(validateContent(input({ status: "scheduled" }), { ...free, now }).publishedAt);
    assert.ok(validateContent(input({ status: "scheduled", publishedAt: "2026-05-01T00:00:00Z" }), { ...free, now }).publishedAt);
    assert.ok(!validateContent(input({ status: "scheduled", publishedAt: "2026-07-01T00:00:00Z" }), { ...free, now }).publishedAt);
  });
  it("a scheduled item goes live at its time", () => {
    const item = { status: "scheduled" as const, publishedAt: "2026-07-01T00:00:00Z" };
    assert.equal(isLive(item, Date.parse("2026-06-30T23:59:00Z")), false);
    assert.equal(isLive(item, Date.parse("2026-07-01T00:00:00Z")), true);
    assert.equal(effectiveStatus(item, Date.parse("2026-08-01T00:00:00Z")), "published");
  });
  it("drafts and trash are never live", () => {
    assert.equal(isLive({ status: "draft" }), false);
    assert.equal(isLive({ status: "trash", publishedAt: "2020-01-01T00:00:00Z" }), false);
  });
  it("checks SEO fields", () => {
    const e = validateContent(input({ seo: { title: "x".repeat(71), canonicalUrl: "not a url", ogImage: "javascript:alert(1)" } }), free);
    assert.ok(e["seo.title"] && e["seo.canonicalUrl"] && e["seo.ogImage"]);
  });
  it("estimates reading time", () => {
    assert.equal(readingMinutes("<p>short</p>"), 1);
    assert.equal(readingMinutes(`<p>${"word ".repeat(600)}</p>`), 3);
  });
});

describe("rich content sanitizer", () => {
  it("keeps safe formatting, links, images and alignment", () => {
    const out = sanitizeRichHtml(`<h2 style="text-align:center">T</h2><a href="/shop">a</a><a href="https://example.com">b</a><img src="/media/x" alt="A">`);
    assert.match(out, /<h2 style="text-align:center">T<\/h2>/);
    assert.match(out, /href="\/shop"/);
    assert.match(out, /href="https:\/\/example.com" rel="noopener noreferrer"/);
    assert.match(out, /<img src="\/media\/x" alt="A">/);
  });
  for (const [name, html] of [
    ["script", `<script>alert(1)</script>`],
    ["event handler", `<img src="/x" onerror="alert(1)">`],
    ["javascript link", `<a href="javascript:alert(1)">x</a>`],
    ["encoded javascript link", `<a href="&#106;avascript:alert(1)">x</a>`],
    ["tab in javascript link", `<a href="java\tscript:alert(1)">x</a>`],
    ["data image", `<img src="data:image/png;base64,AAAA">`],
    ["data image holding markup", `<img src="data:image/svg+xml,<svg onload=alert(1)>">`],
    ["protocol-relative image", `<img src="//evil.example/x.png">`],
    ["style injection", `<p style="background:url(javascript:alert(1))">x</p>`],
    ["iframe", `<iframe src="https://evil.example"></iframe>`],
  ] as const) {
    it(`neutralises ${name}`, () => {
      const out = sanitizeRichHtml(html);
      assert.ok(!/<script|<iframe|<img[^>]*(?:onerror=|onload=|src="(?:data:|\/\/))|<a [^>]*href="[^"]*script:|style="background/i.test(out), out);
    });
  }
  it("keeps quotes inside an alt value from breaking out", () => {
    assert.match(sanitizeRichHtml(`<img src="/x" alt="&quot; onerror=&quot;alert(1)">`), /alt="&quot; onerror=&quot;alert\(1\)"/);
  });
});

const item = (id: string, children: MenuItem[] = []): MenuItem => ({ id, label: id, kind: "custom", url: "/", children });
const ids = (items: MenuItem[]): unknown[] => items.map((i) => (i.children.length ? [i.id, ids(i.children)] : i.id));

describe("menu tree", () => {
  const tree = [item("a"), item("b", [item("b1"), item("b2")]), item("c")];
  it("moves up and down within a level", () => {
    assert.deepEqual(ids(moveUp(tree, "c")), ["a", "c", ["b", ["b1", "b2"]]]);
    assert.deepEqual(ids(moveDown(tree, "a")), [["b", ["b1", "b2"]], "a", "c"]);
    assert.deepEqual(ids(moveUp(tree, "a")), ids(tree));
    assert.deepEqual(ids(moveDown(tree, "c")), ids(tree));
    assert.deepEqual(ids(moveUp(tree, "b2")), ["a", ["b", ["b2", "b1"]], "c"]);
  });
  it("indents under the item above and outdents after the parent", () => {
    assert.deepEqual(ids(indent(tree, "c")), ["a", ["b", ["b1", "b2", "c"]]]);
    assert.deepEqual(ids(outdent(tree, "b1")), ["a", ["b", ["b2"]], "b1", "c"]);
    assert.deepEqual(ids(indent(tree, "a")), ids(tree));
    assert.deepEqual(ids(outdent(tree, "a")), ids(tree));
  });
  it("drops onto a position, adjusting for the removed item", () => {
    assert.deepEqual(ids(moveItem(tree, "a", { parentId: null, index: 2 })), [["b", ["b1", "b2"]], "a", "c"]);
    assert.deepEqual(ids(moveItem(tree, "c", { parentId: "b", index: 1 })), ["a", ["b", ["b1", "c", "b2"]]]);
  });
  it("won't nest an item inside itself or go past three levels", () => {
    assert.deepEqual(ids(moveItem(tree, "b", { parentId: "b1", index: 0 })), ids(tree));
    const deep = [item("x", [item("y", [item("z")])]), item("n", [item("m")])];
    assert.deepEqual(ids(moveItem(deep, "n", { parentId: "y", index: 0 })), ids(deep));
    assert.equal(depthOf(deep, "z"), 3);
  });
  it("removes an item with its children", () => {
    assert.deepEqual(ids(removeItem(tree, "b")), ["a", "c"]);
  });
  it("validates labels, links and targets", () => {
    const e = validateMenu({
      name: "M",
      location: "header",
      items: [
        { id: "1", label: " ", kind: "custom", url: "/x", children: [] },
        { id: "2", label: "L", kind: "custom", url: "javascript:alert(1)", children: [] },
        { id: "3", label: "L", kind: "page", children: [] },
      ],
    });
    assert.ok(e["item.1.label"] && e["item.2.url"] && e["item.3.ref"]);
  });
});

describe("setup checklist", () => {
  const facts: SetupFacts = { zones: 2, taxEnabled: false, taxRates: 0, paymentsEnabled: 1, groups: 1, livePages: 1, posts: 1 };
  const find = (list: ReturnType<typeof setupChecklist>, key: string) => list.find((s) => s.key === key)!;
  it("flags placeholder contact details and a missing favicon", () => {
    const list = setupChecklist(SAMPLE_COMPANY, facts);
    assert.equal(find(list, "company").done, false);
    assert.equal(find(list, "branding").done, false);
    assert.equal(find(list, "shipping").done, true);
  });
  it("links unfinished settings that live elsewhere", () => {
    const list = setupChecklist(SAMPLE_COMPANY, { ...facts, zones: 0, paymentsEnabled: 0, groups: 0, livePages: 0 });
    for (const key of ["shipping", "payments", "b2b", "content"]) {
      assert.equal(find(list, key).done, false, key);
      assert.ok(find(list, key).href, key);
    }
  });
  it("tax on without rates needs attention; tax off is a valid choice", () => {
    assert.equal(find(setupChecklist(SAMPLE_COMPANY, { ...facts, taxEnabled: true }), "tax").done, false);
    assert.equal(find(setupChecklist(SAMPLE_COMPANY, facts), "tax").done, true);
  });
});

describe("open orders", () => {
  it("counts only unfinished orders that aren't fully refunded", () => {
    for (const status of ["received", "preparing", "on_the_way"] as const) assert.equal(isOpenOrder({ status, paymentStatus: "unpaid" }), true);
    for (const status of ["delivered", "cancelled"] as const) assert.equal(isOpenOrder({ status, paymentStatus: "paid" }), false);
    assert.equal(isOpenOrder({ status: "preparing", paymentStatus: "refunded" }), false);
    assert.equal(isOpenOrder({ status: "preparing", paymentStatus: "partially_refunded" }), true);
  });
});
