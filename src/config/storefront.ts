import type { IconName } from "@/components/ui/icons";
import type { SiteImage } from "@/lib/types";

/**
 * Storefront display defaults. Website copy and images are edited in the admin (Homepage, Pages) and read through
 * `repositories.siteContent`; sample values are in `src/lib/data/mock/site-content.ts`.
 */
export type ImageAsset = SiteImage;

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
