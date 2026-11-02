import type { Route } from "next";
import type { IconName } from "@/components/ui/icons";

/**
 * Storefront Home content and images — the one place to change homepage copy and
 * imagery. Brand name, logo and contact details stay in `site.ts`.
 *
 * IMAGES: put files in /public/images and set the path here (e.g. "/images/hero.webp").
 * `null` renders a clearly labelled placeholder. Never use external URLs or the design
 * screenshot itself.
 */
export interface ImageAsset {
  src: string;
  alt: string;
  width: number;
  height: number;
}

/** Image paths. All null until the supplied assets are added to /public/images. */
export const storefrontImages: {
  hero: ImageAsset | null;
  owner: ImageAsset | null;
  delivery: ImageAsset | null;
  /** Keyed by category slug; categories can also carry their own image from the catalog. */
  categories: Record<string, ImageAsset | null>;
  journal: Record<string, ImageAsset | null>;
} = {
  hero: { src: "/images/herob2b.webp", alt: "Warehouse with stacked grocery boxes and a refrigerated delivery truck", width: 1962, height: 802 },
  owner: { src: "/images/owner.webp", alt: "Business owner standing in the warehouse", width: 1749, height: 1454 },
  delivery: null,
  categories: {},
  journal: {},
};

/** File names to drop into /public/images (shown on the placeholders). */
export const expectedImageFiles = {
  hero: "hero.webp (wide warehouse/delivery scene, about 1920×700)",
  owner: "owner.webp (portrait, about 640×800)",
  delivery: "delivery.webp (delivery truck, about 960×540)",
  category: (slug: string) => `category-${slug}.webp (about 480×360)`,
  journal: (key: string) => `journal-${key}.webp (about 480×360)`,
};

/**
 * Icon shown next to each top-level category in the "All categories" menu (header + mobile menu),
 * keyed by category slug. Unlisted categories use `defaultCategoryIcon`.
 */
export const categoryIcons: Record<string, IconName> = {
  meat: "meat",
  fish: "fish",
  "vegetables-fruits": "apple",
  cooking: "pot",
  "masala-spices": "flame",
  "snacks-sweets": "cookie",
  "drink-beverage": "cupSoda",
  "nuts-dry-fruits": "nut",
  "country-wise": "globe",
  "ramadan-special": "moon",
  "combo-offer": "percent",
  others: "box",
};
export const defaultCategoryIcon: IconName = "tag";

export const homeContent = {
  topBar: "Wholesale halal groceries for businesses across Japan",
  /**
   * Home hero slider, in order (the first slide is the page's main heading). `image` (optional) fills the card behind
   * a brand overlay; slides without one show the `icons` grid. Links must point to existing routes.
   */
  heroSlides: [
    {
      eyebrow: "Trusted halal wholesale supplier",
      title: "Reliable halal supply for your business",
      description: "Halal groceries, wholesale pricing for approved businesses, and scheduled delivery across Japan.",
      cta: { label: "Explore product catalog", href: "/shop" as Route },
      image: "hero" as const,
      icons: [] as IconName[],
    },
    {
      eyebrow: "Pantry staples · Wholesale packs",
      title: "Rice, lentils & everyday essentials",
      description: "Basmati and jasmine rice, flour, lentils, ghee and oils in restaurant and retail pack sizes.",
      cta: { label: "Shop cooking essentials", href: "/shop?category=cooking" as Route },
      image: null,
      icons: ["wheat", "flame", "meat", "fish", "sparkles", "apple", "cookie", "cupSoda", "cart"] as IconName[],
    },
    {
      eyebrow: "Halal meat & frozen",
      title: "Halal meat and fish, delivered chilled",
      description: "Beef, chicken, mutton and seafood for kitchens and shops, on scheduled delivery routes.",
      cta: { label: "Shop meat", href: "/shop?category=meat" as Route },
      image: null,
      icons: ["meat", "fish", "shieldCheck", "flame", "pot", "nut", "globe", "gift", "percent"] as IconName[],
    },
  ],
  /** Highlights shown under every hero slide. */
  heroHighlights: [
    { icon: "shieldCheck" as IconName, label: "Halal certified suppliers" },
    { icon: "sparkles" as IconName, label: "Fresh, high quality" },
    { icon: "truck" as IconName, label: "Scheduled delivery" },
  ],
  /**
   * Top-level categories featured on Home (category grid + quick order), in this order.
   * Slugs of the imported sample catalog (src/lib/data/fixtures). Missing or hidden slugs are
   * skipped and the grid is filled with other top-level categories that have an image.
   */
  featuredCategories: {
    slugs: [
      "meat",
      "fish",
      "vegetables-fruits",
      "cooking",
      "masala-spices",
      "snacks-sweets",
      "drink-beverage",
      "nuts-dry-fruits",
      "country-wise",
      "ramadan-special",
    ],
    max: 12,
  },
  benefits: [
    { icon: "halal", title: "Halal products", text: "A wide range of halal groceries" },
    { icon: "coins", title: "Wholesale pricing", text: "Business prices after account approval" },
    { icon: "truck", title: "Scheduled delivery", text: "Delivery routes with set days and cutoffs" },
    { icon: "support", title: "Dedicated support", text: "Our team helps with orders and accounts" },
  ] as const,
  business: {
    eyebrow: "For food businesses",
    title: "Built for food businesses",
    text: "Wholesale supply with customer-specific pricing, case quantities and support for restaurants, grocers and caterers.",
    cta: { label: "Learn more about us", href: "/about" as Route },
    cards: [
      { icon: "invoice", title: "Pay on delivery or bank transfer", text: "Payment options shown at checkout once ordering opens." },
      { icon: "repeat", title: "Quick repeat orders", text: "Find products by name or SKU and build your order fast." },
      { icon: "support", title: "Dedicated assistance", text: "Talk to our team about your account and orders." },
      { icon: "box", title: "Case quantities", text: "Minimum and maximum quantities per product line." },
    ] as const,
  },
  delivery: {
    eyebrow: "Delivery information",
    title: "Plan your stock. We'll plan the delivery.",
    text: "Choose your prefecture to see the delivery route, delivery days and order cutoff.",
  },
  steps: [
    { title: "Create an account", text: "Fill in the business application form." },
    { title: "Submit business details", text: "Tell us about your business and delivery address." },
    { title: "Get approved", text: "We review and approve your application." },
    { title: "See trade prices", text: "Approved accounts see wholesale prices and quantity rules." },
  ],
  /** SAMPLE journal teasers — articles are not written yet, so these are not links. */
  journal: [
    { key: "stocking", tag: "Business tips", title: "Stocking essentials for your restaurant", text: "Key halal ingredients a restaurant kitchen should keep in stock." },
    { key: "pack-sizes", tag: "Wholesale guide", title: "Choosing the right wholesale pack sizes", text: "How to pick pack sizes that fit your storage and turnover." },
    { key: "repeat-orders", tag: "Ordering tips", title: "Making repeat orders easier", text: "Ways to streamline restocking and keep your business running." },
  ],
  contactStrip: { title: "Let's grow your business together.", text: "Join our wholesale network across Japan.", cta: { label: "Contact our team", href: "/contact" as Route } },
};
