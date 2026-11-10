import type { Metadata } from "next";
import Link from "next/link";
import { ContentForm } from "@/components/admin/content/content-form";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Add post" };

export default async function NewPostPage() {
  return (
    <>
      <Link href="/admin/posts" className="text-sm text-muted hover:text-foreground">← All posts</Link>
      <PageHeader title="Add post" />
      <ContentForm kind="post" categories={await repositories.posts.categories()} tagOptions={(await repositories.posts.terms("tag")).map((t) => t.name)} />
    </>
  );
}
