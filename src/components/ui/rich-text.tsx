import { looksLikeHtml, sanitizeHtml, sanitizeRichHtml } from "@/lib/html/sanitize";
import { cx } from "@/lib/cx";

/**
 * Renders stored rich text (e.g. imported product descriptions). HTML is sanitized on the
 * server with an allowlist (no attributes, links, scripts or styles); plain text renders as-is.
 */
export function RichText({ value, className, rich = false }: { value: string; className?: string; /** Editor content: also keeps checked links, images and alignment. */ rich?: boolean }) {
  if (!value.trim()) return null;
  if (!looksLikeHtml(value)) return <p className={cx("whitespace-pre-line", className)}>{value}</p>;
  return (
    <div
      className={cx(
        "space-y-3 [&_a]:text-brand [&_a]:underline [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-ui [&_blockquote]:border-l-4 [&_blockquote]:border-line [&_blockquote]:pl-4 [&_table]:w-full [&_table]:text-left [&_td]:border [&_td]:border-line [&_td]:p-2 [&_th]:border [&_th]:border-line [&_th]:bg-surface-muted [&_th]:p-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:font-semibold [&_h3]:text-foreground [&_h4]:font-semibold [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-foreground [&_table]:w-full [&_table]:text-sm [&_td]:border [&_td]:border-line [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-line [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-5",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: rich ? sanitizeRichHtml(value) : sanitizeHtml(value) }}
    />
  );
}
