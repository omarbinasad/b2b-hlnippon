import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CmsArticle } from "@/components/storefront/cms-article";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { canSeeWholesalePrices, getViewer } from "@/lib/auth/session";
import { seoMetadata } from "@/lib/content/seo";
import { repositories } from "@/lib/data";

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const page = await repositories.pages.getLiveBySlug((await params).slug);
  if (!page) return {};
  return seoMetadata(page, `/${page.slug}`, page.visibility === "public");
}

/** A page made in the admin (Pages). Static routes such as /shop take priority, and those addresses are reserved. */
export default async function CmsPage({ params }: PageProps<"/[slug]">) {
  const page = await repositories.pages.getLiveBySlug((await params).slug);
  if (!page) notFound();
  if (page.visibility === "customers") {
    const viewer = await getViewer();
    // Screen rule in the demo; the backend must not return this content to anyone else.
    if (!canSeeWholesalePrices(viewer)) {
      return <EmptyState title="This page is for approved customers" description="Log in with an approved business account to read it." action={<ButtonLink href="/login">Log in</ButtonLink>} />;
    }
  }
  return <CmsArticle title={page.title} excerpt={page.excerpt} bodyHtml={page.bodyHtml} image={page.image} />;
}
