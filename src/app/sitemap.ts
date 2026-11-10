import type { MetadataRoute } from "next";
import { repositories } from "@/lib/data";

const base = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Public addresses only. Pages limited to customers stay out. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [pages, posts] = await Promise.all([repositories.pages.listLive(), repositories.posts.list()]);
  return [
    ...["", "/shop", "/about", "/contact", "/blog"].map((p) => ({ url: `${base()}${p}` })),
    ...pages.filter((p) => p.visibility === "public" && !p.seo.canonicalUrl).map((p) => ({ url: `${base()}/${p.slug}`, lastModified: p.updatedAt })),
    ...posts.map((p) => ({ url: `${base()}/blog/${p.slug}`, lastModified: p.publishedAt })),
  ];
}
