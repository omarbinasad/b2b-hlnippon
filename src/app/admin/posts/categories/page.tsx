import type { Metadata } from "next";
import Link from "next/link";
import { TermManager } from "@/components/admin/content/term-manager";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const terms = await repositories.posts.terms("category");
  return (
    <>
      <Link href="/admin/posts" className="text-sm text-muted hover:text-foreground">← All posts</Link>
      <PageHeader title="Categories" description="Used to group journal posts." />
      <TermManager kind="category" terms={terms} />
      <div className="mt-6"><DemoEditingNotice /></div>
    </>
  );
}
