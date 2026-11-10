import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CmsArticle } from "@/components/storefront/cms-article";
import { Notice } from "@/components/ui/feedback";
import { getViewer } from "@/lib/auth/session";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Preview", robots: { index: false } };

/** Staff preview of the last saved version, whatever its status. Mock check; the backend must authorize it. */
export default async function PreviewPage({ params }: PageProps<"/preview/[kind]/[id]">) {
  const { kind, id } = await params;
  if ((await getViewer()).kind !== "admin") notFound();
  const item = kind === "page" ? await repositories.pages.getById(id) : kind === "post" ? await repositories.posts.getById(id) : null;
  if (!item) notFound();
  return (
    <>
      <div className="mx-auto mb-6 max-w-3xl"><Notice tone="warning" title={`Preview: ${item.status}`}>This is the last saved version. Visitors see it only once it is published.</Notice></div>
      <CmsArticle title={item.title} excerpt={item.excerpt} bodyHtml={item.bodyHtml} image={item.image} />
    </>
  );
}
