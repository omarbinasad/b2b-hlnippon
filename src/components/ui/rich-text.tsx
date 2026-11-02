import { looksLikeHtml, sanitizeHtml } from "@/lib/html/sanitize";
import { cx } from "@/lib/cx";

/**
 * Renders stored rich text (e.g. imported product descriptions). HTML is sanitized on the
 * server with an allowlist (no attributes, links, scripts or styles); plain text renders as-is.
 */
export function RichText({ value, className }: { value: string; className?: string }) {
  if (!value.trim()) return null;
  if (!looksLikeHtml(value)) return <p className={cx("whitespace-pre-line", className)}>{value}</p>;
  return (
    <div
      className={cx(
        "space-y-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:font-semibold [&_h3]:text-foreground [&_h4]:font-semibold [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-foreground [&_table]:w-full [&_table]:text-sm [&_td]:border [&_td]:border-line [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-line [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-5",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }}
    />
  );
}
