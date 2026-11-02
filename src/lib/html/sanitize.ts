/**
 * Allowlist HTML sanitizer for imported rich text (product descriptions from the old store).
 * Pure and dependency-free so the import script and the server render share it.
 *
 * - Keeps a small set of formatting tags and drops ALL attributes (no links, styles,
 *   classes, event handlers or URLs survive).
 * - Removes dangerous elements together with their content (script, style, iframe, …).
 * - Unknown tags are dropped but their text is kept; stray `<`, `>` and `&` are escaped.
 * - Output is balanced: every opened tag is closed.
 */

const ALLOWED = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "small", "sub", "sup",
  "ul", "ol", "li", "h2", "h3", "h4", "h5", "h6", "blockquote", "hr",
  "table", "thead", "tbody", "tr", "th", "td",
]);
const VOID = new Set(["br", "hr"]);
/** Page-level headings would compete with the page's own h1/h2. */
const RENAME: Record<string, string> = { h1: "h2", b: "strong", i: "em" };
const DROP_WITH_CONTENT = "script|style|iframe|object|embed|noscript|template|svg|math|textarea|select|button|form|head|title";

const escapeText = (text: string) =>
  text.replace(/&(?!(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});)/gi, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return "";
  const html = input
    .replace(/<!--[\s\S]*?(?:-->|$)/g, "")
    .replace(new RegExp(`<(${DROP_WITH_CONTENT})\\b[\\s\\S]*?(?:<\\/\\1\\s*>|$)`, "gi"), "");

  const out: string[] = [];
  const open: string[] = [];
  // A tag, or a malformed markup fragment ("<!x", "</ >", "<?php"); a lone "<" (e.g. "< 5 kg") stays text.
  const token = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>|<[!?/][^>]*>?/g;
  let last = 0;
  for (let m = token.exec(html); m; m = token.exec(html)) {
    out.push(escapeText(html.slice(last, m.index)));
    last = token.lastIndex;
    const raw = m[1]?.toLowerCase();
    if (!raw) continue; // malformed "<…" fragment: dropped
    const tag = RENAME[raw] ?? raw;
    if (!ALLOWED.has(tag)) continue;
    if (m[0].startsWith("</")) {
      const at = open.lastIndexOf(tag);
      if (at === -1) continue;
      while (open.length > at) out.push(`</${open.pop()}>`);
    } else if (VOID.has(tag)) {
      out.push(`<${tag}>`);
    } else {
      out.push(`<${tag}>`);
      open.push(tag);
    }
  }
  out.push(escapeText(html.slice(last)));
  while (open.length) out.push(`</${open.pop()}>`);
  return out.join("").replace(/<p>(?:\s|&nbsp;)*<\/p>/g, "").trim();
}

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", times: "×", yen: "¥" };

/** Decodes HTML entities (named subset + numeric). */
export function decodeEntities(text: string): string {
  return text.replace(/&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
    }
    return NAMED[code.toLowerCase()] ?? whole;
  });
}

/** HTML → plain text (for names, short descriptions and notes). */
export function htmlToText(input: string | null | undefined): string {
  if (!input) return "";
  const withBreaks = sanitizeHtml(input).replace(/<\/(p|li|h[2-6]|tr|blockquote)>|<br>/g, "\n").replace(/<[^>]+>/g, "");
  return decodeEntities(withBreaks)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** True when the string contains markup worth rendering as HTML. */
export const looksLikeHtml = (text: string) => /<\/?[a-z][a-z0-9]*\b[^>]*>/i.test(text);
