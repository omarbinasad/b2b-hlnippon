import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { ContentForm } from "@/components/admin/content/content-form";
import { Notice } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditPostPage({ params }: PageProps<"/admin/posts/[id]">) {
  const item = await repositories.posts.getById((await params).id);
  if (!item) notFound();
  return (
    <>
      <Link href="/admin/posts" className="text-sm text-muted hover:text-foreground">← All posts</Link>
      <PageHeader title={item.title} description={`By ${item.authorName}`} />
      {item.status === "trash" && <div className="mb-4"><Notice tone="warning" title="This post is in the trash">Saving moves it out of the trash.</Notice></div>}
      <ContentForm kind="post" item={item} categories={await repositories.posts.categories()} tagOptions={(await repositories.posts.terms("tag")).map((t) => t.name)} />
      <div className="mt-6"><DemoEditingNotice /></div>
    </>
  );
}
