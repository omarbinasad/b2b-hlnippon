import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { ContentForm } from "@/components/admin/content/content-form";
import { Notice } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Edit page" };

export default async function EditPagePage({ params }: PageProps<"/admin/pages/[id]">) {
  const item = await repositories.pages.getById((await params).id);
  if (!item) notFound();
  return (
    <>
      <Link href="/admin/pages" className="text-sm text-muted hover:text-foreground">← All pages</Link>
      <PageHeader title={item.title} description={`By ${item.authorName}`} />
      {item.status === "trash" && <div className="mb-4"><Notice tone="warning" title="This page is in the trash">Saving moves it out of the trash.</Notice></div>}
      <ContentForm kind="page" item={item} />
      <div className="mt-6"><DemoEditingNotice /></div>
    </>
  );
}
