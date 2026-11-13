import type { ProductImage } from "./catalog";
import type { ID, ISODateString } from "./common";

export type ContentStatus = "draft" | "published" | "scheduled" | "trash";

export interface SeoFields {
  /** Falls back to the title. */
  title?: string;
  /** Falls back to the excerpt. */
  description?: string;
  canonicalUrl?: string;
  /** Social sharing image; falls back to the featured image. */
  ogImage?: string;
}

/** What pages and posts have in common. */
export interface ContentBase {
  id: ID;
  slug: string;
  title: string;
  /** Short summary for cards and search results. */
  excerpt: string;
  /** Sanitized HTML: on save by the backend, and again when rendered (src/lib/html/sanitize.ts). */
  bodyHtml: string;
  status: ContentStatus;
  /** When a scheduled item goes live, or when it was published. */
  publishedAt?: ISODateString;
  /** Absent = no featured image. */
  image?: ProductImage;
  seo: SeoFields;
  authorName: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  /** Status to return to when restored from the trash. */
  trashedFrom?: Exclude<ContentStatus, "trash">;
}

/** Who may see a page. "customers" is a UI rule in the demo; the backend must enforce it. */
export type PageVisibility = "public" | "customers";

export interface ContentPage extends ContentBase {
  visibility: PageVisibility;
}

/** A journal article. */
export interface BlogPost extends ContentBase {
  /** First category, shown on cards. */
  tag: string;
  categories: string[];
  tags: string[];
  readingMinutes: number;
}

export type TermKind = "category" | "tag";

/** A blog category or tag with the number of posts using it. */
export interface TermUsage {
  name: string;
  count: number;
}

export type ContentInput = Pick<ContentBase, "slug" | "title" | "excerpt" | "bodyHtml" | "status" | "publishedAt" | "image" | "seo">;
export type ContentPageInput = ContentInput & { visibility: PageVisibility };
export type BlogPostInput = ContentInput & { categories: string[]; tags: string[] };

export type ContactTopic = "general" | "products" | "account" | "orders" | "other";

/** What the public contact form sends. */
export interface ContactMessageInput {
  name: string;
  company?: string;
  email: string;
  phone?: string;
  topic: ContactTopic;
  message: string;
}

export interface ContactMessage extends ContactMessageInput {
  id: ID;
  receivedAt: ISODateString;
}

/** A post without its body, for cards. */
export type BlogPostSummary = Pick<BlogPost, "id" | "slug" | "title" | "excerpt" | "tag" | "image" | "authorName" | "publishedAt" | "readingMinutes">;

// --- Navigation menus -----------------------------------------------------------------------

export type MenuLocation = "header" | "footer" | "none";

export interface MenuItem {
  id: ID;
  label: string;
  /** "page" and "category" follow the target; "custom" uses `url`. */
  kind: "page" | "category" | "custom";
  /** Page id or category slug. */
  ref?: string;
  url?: string;
  children: MenuItem[];
}

export interface NavigationMenu {
  id: ID;
  name: string;
  location: MenuLocation;
  items: MenuItem[];
  updatedAt: ISODateString;
}

export type NavigationMenuInput = Pick<NavigationMenu, "name" | "location" | "items">;

/** A menu item ready to render. Links to pages that are not live are left out. */
export interface ResolvedMenuItem {
  id: ID;
  label: string;
  href: string;
  children: ResolvedMenuItem[];
}

// --- Homepage and About content -------------------------------------------------------------

export interface SiteImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface CtaLink {
  label: string;
  href: string;
}

export interface IconText {
  /** Name from the icon set. */
  icon: string;
  title: string;
  text: string;
}

export interface HeroSlide {
  eyebrow: string;
  title: string;
  description: string;
  cta: CtaLink;
  /** Optional text link next to the button, such as "Open a trade account". */
  secondaryCta?: CtaLink | null;
  /** With an image the slide uses the photo layout: the photo fills it and the copy sits on a frosted card. */
  image: SiteImage | null;
  /** The photo for the dark theme. Without one, the light photo is used in both. */
  imageDark?: SiteImage | null;
  /** Optional photos for phones (under 640px wide), usually portrait. Without them phones show the banner photos, cropped. */
  imageMobile?: SiteImage | null;
  /** Phone photo for the dark theme. Without one, the phone light-theme photo is used (or the dark banner if there is no phone photo). */
  imageMobileDark?: SiteImage | null;
  /** Shown when there is no image. */
  icons: string[];
}

/** One homepage section. `type` decides its fields; order and visibility are shared. */
export type HomeSection = { id: ID; enabled: boolean } & (
  | { type: "hero"; slides: HeroSlide[]; highlights: { icon: string; label: string }[] }
  | { type: "benefits"; items: IconText[] }
  | { type: "categories"; eyebrow: string; title: string; slugs: string[]; max: number }
  | { type: "featuredProducts"; eyebrow: string; title: string; max: number }
  | { type: "quickOrder"; title: string; text: string }
  | { type: "business"; eyebrow: string; title: string; text: string; cta: CtaLink; image: SiteImage | null; cards: IconText[] }
  | { type: "brands"; title: string; max: number }
  | { type: "promo"; eyebrow: string; title: string; text: string; cta: CtaLink; image: SiteImage | null }
  | { type: "delivery"; eyebrow: string; title: string; text: string; image: SiteImage | null }
  | { type: "steps"; eyebrow: string; title: string; items: { title: string; text: string }[] }
  | { type: "journal"; eyebrow: string; title: string; max: number }
  | { type: "contact"; title: string; text: string; cta: CtaLink }
);

export type HomeSectionType = HomeSection["type"];

export interface AboutContent {
  eyebrow: string;
  title: string;
  text: string;
  image: SiteImage | null;
  pillars: IconText[];
  valuesEyebrow: string;
  valuesTitle: string;
  values: IconText[];
  serveEyebrow: string;
  serveTitle: string;
  serveText: string;
  serve: { icon: string; title: string }[];
  ctaTitle: string;
  ctaText: string;
}

/** A small icon and label, such as "Safe shipping". */
export interface IconLabel {
  icon: string;
  label: string;
}

export interface SiteContent {
  topBar: string;
  sections: HomeSection[];
  about: AboutContent;
  /** Badges under Add to cart on every product page (at most 6). Empty or missing hides the row. */
  productBadges?: IconLabel[];
  updatedAt: ISODateString;
}

export type SiteContentInput = Pick<SiteContent, "topBar" | "sections" | "about" | "productBadges">;

// --- Revisions, autosave and reusable blocks (docs/CMS-AND-CONTENT-MANAGEMENT.md) ---------------

export type ContentKind = "page" | "post";

/** The editable fields of a page or post, as kept in a revision or an autosave. Status and dates aren't part of it. */
export interface ContentSnapshot {
  title: string;
  slug: string;
  excerpt: string;
  bodyHtml: string;
  image?: ProductImage;
  seo: SeoFields;
  /** Pages only. */
  visibility?: PageVisibility;
  /** Posts only. */
  categories?: string[];
  tags?: string[];
}

/** One saved version of a page or post. Kept on every save that changes the content (the newest 25 per item). */
export interface ContentRevision {
  id: ID;
  kind: ContentKind;
  itemId: ID;
  createdAt: ISODateString;
  authorName: string;
  /** The item's status right after this version was saved. */
  status: ContentStatus;
  /** "Saved", "Original version" or "Restored from …". */
  note: string;
  snapshot: ContentSnapshot;
}

/** A revision in the history list, without its content. */
export type ContentRevisionSummary = Omit<ContentRevision, "snapshot"> & { title: string; words: number };

/**
 * Unsaved editing work kept by the server while someone edits. It never changes the page or post itself: the editor
 * offers it back when it is newer than the saved version. The demo keeps one per item; the backend keeps one per user per item.
 */
export interface ContentAutosave {
  kind: ContentKind;
  itemId: ID;
  savedAt: ISODateString;
  authorName: string;
  snapshot: ContentSnapshot;
}

export type ContentBlockKind = "announcement" | "banner" | "cta" | "contact" | "productPromo";

/** Reusable content written once and inserted into many pages or posts. Editing it changes every page that uses it. */
export interface ContentBlock {
  id: ID;
  name: string;
  kind: ContentBlockKind;
  /** Sanitized like page content. Can't contain other blocks. */
  bodyHtml: string;
  authorName: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type ContentBlockInput = Pick<ContentBlock, "name" | "kind" | "bodyHtml">;

/** A block in the admin list, with how many pages and posts (not in the trash) use it. */
export type ContentBlockSummary = ContentBlock & { usedBy: number };

/** A page or post that contains a block. */
export interface ContentBlockUse {
  kind: ContentKind;
  id: ID;
  title: string;
  status: ContentStatus;
}
