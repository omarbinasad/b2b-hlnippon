/** Allowlist HTML sanitizer used for imported descriptions. Run with `npm test`. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeEntities, htmlToText, looksLikeHtml, sanitizeHtml } from "../src/lib/html/sanitize.ts";

describe("sanitizeHtml", () => {
  it("keeps allowed formatting tags and drops every attribute", () => {
    assert.equal(
      sanitizeHtml('<p data-start="1" class="x" style="color:red"><strong onclick="x()">Beef</strong> liver</p>'),
      "<p><strong>Beef</strong> liver</p>",
    );
  });

  it("removes dangerous elements together with their content", () => {
    assert.equal(sanitizeHtml('<p>a</p><script>alert(1)</script><style>p{}</style><iframe src="x"></iframe><p>b</p>'), "<p>a</p><p>b</p>");
    assert.equal(sanitizeHtml("<p>a</p><script>never closed"), "<p>a</p>");
  });

  it("drops links, images and unknown tags but keeps their text", () => {
    assert.equal(sanitizeHtml('<p>See <a href="javascript:alert(1)">our shop</a><img src=x onerror=alert(1)></p>'), "<p>See our shop</p>");
    assert.equal(sanitizeHtml("<div><span>Halal</span></div>"), "Halal");
  });

  it("escapes stray brackets and ampersands, keeps entities", () => {
    assert.equal(sanitizeHtml("<p>Fish & chips < 5 kg &amp; more</p>"), "<p>Fish &amp; chips &lt; 5 kg &amp; more</p>");
  });

  it("balances unclosed and stray tags", () => {
    assert.equal(sanitizeHtml("<ul><li>One<li>Two"), "<ul><li>One<li>Two</li></li></ul>");
    assert.equal(sanitizeHtml("</p>text</strong>"), "text");
  });

  it("renames page-level headings and legacy tags", () => {
    assert.equal(sanitizeHtml("<h1>Title</h1><b>bold</b><i>it</i>"), "<h2>Title</h2><strong>bold</strong><em>it</em>");
  });

  it("removes comments and empty paragraphs", () => {
    assert.equal(sanitizeHtml("<!-- note --><p> </p><p>&nbsp;</p><p>x</p>"), "<p>x</p>");
  });

  it("is idempotent", () => {
    const once = sanitizeHtml('<h1 id="a">T</h1><ul><li>a & b<script>x</script></ul>');
    assert.equal(sanitizeHtml(once), once);
  });
});

describe("htmlToText / decodeEntities", () => {
  it("turns HTML into plain lines", () => {
    assert.equal(htmlToText("<p>Beef liver (1kg) &#8211; 100% halal</p>\n<ul><li>Iron</li><li>Fresh &amp; clean</li></ul>"), "Beef liver (1kg) – 100% halal\nIron\nFresh & clean");
  });

  it("decodes named and numeric entities", () => {
    assert.equal(decodeEntities("Masala &amp; Spices &#x2014; &yen;1,130 &unknown;"), "Masala & Spices — ¥1,130 &unknown;");
  });

  it("detects markup", () => {
    assert.equal(looksLikeHtml("Plain text, 5 < 6"), false);
    assert.equal(looksLikeHtml("<p>Text</p>"), true);
  });
});
