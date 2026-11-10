import type { Metadata } from "next";
import Link from "next/link";
import { ContentForm } from "@/components/admin/content/content-form";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Add page" };

export default async function NewPagePage() {
  return (
    <>
      <Link href="/admin/pages" className="text-sm text-muted hover:text-foreground">← All pages</Link>
      <PageHeader title="Add page" />
      <ContentForm kind="page" />
    </>
  );
}
