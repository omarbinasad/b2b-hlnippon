import type { BlogPost } from "@/lib/types";

/** SAMPLE articles for the demo: general guidance written for this project, not published advice. Newest first. */
const seed = (p: Omit<BlogPost, "status" | "categories" | "tags" | "seo" | "createdAt" | "updatedAt">): BlogPost => ({ ...p, status: "published", categories: [p.tag], tags: [], seo: {}, createdAt: p.publishedAt ?? "", updatedAt: p.publishedAt ?? "" });

export const seedPosts: BlogPost[] = ([
  {
    id: "post-003",
    slug: "making-repeat-orders-easier",
    title: "Making repeat orders easier",
    excerpt: "Ways to streamline restocking and keep your business running.",
    tag: "Ordering tips",
    authorName: "Wholesale team",
    publishedAt: "2026-10-12T09:00:00+09:00",
    readingMinutes: 3,
    bodyHtml: `
<p>Most of what a food business buys each week is the same list with small changes. The less time that list takes to order, the more time goes back to the kitchen or the shop floor.</p>
<h2>Keep one regular list</h2>
<p>Write down the products you reorder most, with the quantity you usually need. Reviewing a short list is faster than searching for each item, and it makes forgotten items much less likely.</p>
<h2>Order on a fixed day</h2>
<p>Pick a day that leaves enough time before your delivery route's cutoff, and order on that day every week. A routine keeps stock levels predictable and avoids rushed orders.</p>
<ul>
<li>Count your fast-moving items before you order.</li>
<li>Check your delivery days and order cutoff for your area.</li>
<li>Note anything you ran out of since the last delivery.</li>
</ul>
<h2>Start from your last order</h2>
<p>When your needs are similar to last time, reordering a past order and adjusting the quantities is the quickest route. For several different products at once, the quick order sheet lets you search by name or SKU and add everything in one step.</p>
<h2>Review once a month</h2>
<p>Look back at what you ordered and what you actually used. Trim slow items from your regular list, and raise quantities on anything that keeps running out.</p>
`,
  },
  {
    id: "post-002",
    slug: "choosing-wholesale-pack-sizes",
    title: "Choosing the right wholesale pack sizes",
    excerpt: "How to pick pack sizes that fit your storage and turnover.",
    tag: "Wholesale guide",
    authorName: "Wholesale team",
    publishedAt: "2026-09-24T09:00:00+09:00",
    readingMinutes: 4,
    bodyHtml: `
<p>A larger pack usually costs less per kilogram, but that saving only counts if you use the product before it loses quality. The right size depends on how fast you use it and where you can keep it.</p>
<h2>Start with how fast you use it</h2>
<p>Work out how much of a product you use in a typical week. Then compare that with the time the product stays at its best once opened. A pack that lasts a few weeks is usually better value than a cheaper one that is thrown away half used.</p>
<h2>Check your storage first</h2>
<ul>
<li><strong>Dry goods:</strong> do you have a cool, dry space away from heat and strong smells?</li>
<li><strong>Chilled and frozen:</strong> is there room in the freezer for the whole delivery, not just the usual amount?</li>
<li><strong>Handling:</strong> can your staff lift and move the largest pack safely?</li>
</ul>
<h2>Split large packs carefully</h2>
<p>If you buy in bulk and divide into smaller containers, label each one with the product name and the date it was opened. Keep the original packaging information so you can still check ingredients and allergens.</p>
<h2>Try before you commit</h2>
<p>When you are unsure, order a smaller size first and track how long it lasts. Once you know your real usage, moving up a size is an easy decision. Bulk prices can also change with the quantity, so check your price in the cart.</p>
`,
  },
  {
    id: "post-001",
    slug: "stocking-essentials-for-your-restaurant",
    title: "Stocking essentials for your restaurant",
    excerpt: "Key halal ingredients a restaurant kitchen should keep in stock.",
    tag: "Business tips",
    authorName: "Wholesale team",
    publishedAt: "2026-09-05T09:00:00+09:00",
    readingMinutes: 3,
    bodyHtml: `
<p>A well-stocked kitchen copes with a busy night without a last-minute shopping trip. The aim is not to hold more stock, but to always have the items your menu depends on.</p>
<h2>Build around your menu</h2>
<p>Go through your best-selling dishes and list every ingredient they need. The items that appear in many dishes are your essentials, and they should never run out.</p>
<h2>Core items to keep on hand</h2>
<ul>
<li><strong>Rice and flour:</strong> long-storing staples that most menus rely on.</li>
<li><strong>Lentils and beans:</strong> useful for both main dishes and sides.</li>
<li><strong>Oil and ghee:</strong> used across nearly every dish, and easy to underestimate.</li>
<li><strong>Spices and masala:</strong> keep sealed, and buy in amounts you will use while they are fresh.</li>
<li><strong>Frozen meat and fish:</strong> plan freezer space around your delivery days.</li>
</ul>
<h2>Set a minimum for each item</h2>
<p>Decide the lowest level you are comfortable with for each essential, based on your weekly use and the days between deliveries. When a shelf reaches that level, the item goes on the next order.</p>
<h2>Check halal details when you receive goods</h2>
<p>Keep the certification information your customers may ask about, and check labels on new products before they go into the kitchen. If a product changes, ask your supplier for the current details.</p>
<h2>Rotate your stock</h2>
<p>Put new deliveries behind older stock so the oldest is used first. A quick check of dates each week prevents waste and keeps quality consistent.</p>
`,
  },
] satisfies Omit<BlogPost, "status" | "categories" | "tags" | "seo" | "createdAt" | "updatedAt">[]).map(seed);
