import type { Metadata } from "next";
import Link from "next/link";
import { MenuBuilder } from "@/components/admin/content/menu-builder";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Add menu" };

export default async function NewMenuPage() {
  const [pages, categories] = await Promise.all([repositories.pages.listLive(), repositories.products.listCategories()]);
  const pageOptions = pages.map((p) => ({ value: p.id, label: p.title }));
  const categoryOptions = categories.filter((c) => !c.parentId).sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.slug, label: c.name }));
  return (
    <>
      <Link href="/admin/menus" className="text-sm text-muted hover:text-foreground">← All menus</Link>
      <PageHeader title="Add menu" />
      <MenuBuilder pages={pageOptions} categories={categoryOptions} />
    </>
  );
}
