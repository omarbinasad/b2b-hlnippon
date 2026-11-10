import type { Metadata } from "next";
import type { ContentBase } from "@/lib/types";

/** Page metadata from a page's or post's SEO fields, falling back to its title, excerpt and featured image. */
export function seoMetadata(item: Pick<ContentBase, "title" | "excerpt" | "seo" | "image" | "publishedAt">, path: string, indexable = true): Metadata {
  const title = item.seo.title?.trim() || item.title;
  const description = item.seo.description?.trim() || item.excerpt || undefined;
  const image = item.seo.ogImage || item.image?.src;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: item.seo.canonicalUrl || path },
    openGraph: { type: "article", title, description, url: path, publishedTime: item.publishedAt, ...(image ? { images: [image] } : {}) },
    ...(indexable ? {} : { robots: { index: false } }),
  };
}
