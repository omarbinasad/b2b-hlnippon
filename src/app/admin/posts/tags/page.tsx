import type { Metadata } from "next";
import Link from "next/link";
import { TermManager } from "@/components/admin/content/term-manager";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Tags" };

export default async function TagsPage() {
  const terms = await repositories.posts.terms("tag");
  return (
    <>
      <Link href="/admin/posts" className="text-sm text-muted hover:text-foreground">← All posts</Link>
      <PageHeader title="Tags" description="Used to group journal posts." />
      <TermManager kind="tag" terms={terms} />
      <div className="mt-6"><DemoEditingNotice /></div>
    </>
  );
}
