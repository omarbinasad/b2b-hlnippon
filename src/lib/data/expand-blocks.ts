import { blockIdsIn, expandBlocks } from "@/lib/content/blocks";
import { sanitizeRichHtml } from "@/lib/html/sanitize";
import { repositories } from "@/lib/data";

/**
 * Page or post HTML with its reusable-block markers replaced by the blocks' current content (src/lib/content/blocks.ts).
 * Missing blocks disappear. The result is still sanitized again where it is rendered.
 */
export async function withBlocks(html: string): Promise<string> {
  const clean = sanitizeRichHtml(html);
  const ids = blockIdsIn(clean);
  if (!ids.length) return clean;
  const blocks = await repositories.blocks.resolve(ids);
  return expandBlocks(clean, new Map(blocks.map((b) => [b.id, { kind: b.kind, bodyHtml: sanitizeRichHtml(b.bodyHtml) }])));
}
