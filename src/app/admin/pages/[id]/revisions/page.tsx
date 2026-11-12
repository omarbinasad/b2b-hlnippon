import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RevisionHistory } from "@/components/admin/content/revision-history";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";
import { param } from "@/lib/list-params";

export const metadata: Metadata = { title: "Page revisions" };

export default async function PageRevisionsPage({ params, searchParams }: PageProps<"/admin/pages/[id]/revisions">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const item = await repositories.pages.getById(id);
  if (!item) notFound();
  return (
    <>
      <Link href={`/admin/pages/${item.id}` as Route} className="text-sm text-muted hover:text-foreground">← Back to the editor</Link>
      <PageHeader title={`Revisions: ${item.title}`} description="Earlier saved versions. Compare any two, and restore an older one if you need to." />
      <RevisionHistory kind="page" item={item} compare={param(sp, "compare")} against={param(sp, "against")} />
      <div className="mt-6"><DemoEditingNotice /></div>
    </>
  );
}
