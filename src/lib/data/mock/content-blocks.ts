import type { ContentBlock } from "@/lib/types";

/* SAMPLE reusable blocks for the demo store. Editable under Website content → Reusable blocks; not platform rules. */
const AT = "2026-01-01T00:00:00+09:00";

export const seedBlocks: ContentBlock[] = [
  {
    id: "blk-holiday-notice",
    name: "Holiday packing notice",
    kind: "announcement",
    bodyHtml: "<p><strong>Holiday notice:</strong> orders placed on public holidays are packed and shipped on the next working day.</p>",
    authorName: "Website team",
    createdAt: AT,
    updatedAt: AT,
  },
  {
    id: "blk-account-cta",
    name: "Open a business account",
    kind: "cta",
    bodyHtml: '<h3>Buying for a business?</h3><p>Approved business customers see wholesale prices, quantity rules and fast reordering.</p><p><a href="/register">Apply for a business account</a></p>',
    authorName: "Website team",
    createdAt: AT,
    updatedAt: AT,
  },
  {
    id: "blk-contact-team",
    name: "Contact the sales team",
    kind: "contact",
    bodyHtml: '<h3>Need help with an order?</h3><p>Our sales team answers on working days and can quote for large or regular orders.</p><p><a href="/contact">Send us a message</a></p>',
    authorName: "Website team",
    createdAt: AT,
    updatedAt: AT,
  },
];
