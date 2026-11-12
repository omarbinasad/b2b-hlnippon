import type { Metadata } from "next";
import Link from "next/link";
import { BlockForm } from "@/components/admin/content/block-form";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Add block" };

export default function NewBlockPage() {
  return (
    <>
      <Link href="/admin/blocks" className="text-sm text-muted hover:text-foreground">← All blocks</Link>
      <PageHeader title="Add block" description="Choose a type to start from an example, then write your own content." />
      <BlockForm />
      <div className="mt-6"><DemoEditingNotice /></div>
    </>
  );
}
