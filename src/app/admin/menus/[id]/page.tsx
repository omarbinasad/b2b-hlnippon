import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MenuBuilder } from "@/components/admin/content/menu-builder";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Edit menu" };

export default async function EditMenuPage({ params }: PageProps<"/admin/menus/[id]">) {
  const menu = await repositories.navigation.getById((await params).id);
  if (!menu) notFound();
  const [pages, categories] = await Promise.all([repositories.pages.listLive(), repositories.products.listCategories()]);
  const pageOptions = pages.map((p) => ({ value: p.id, label: p.title }));
  const categoryOptions = categories.filter((c) => !c.parentId).sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.slug, label: c.name }));
  return (
    <>
      <Link href="/admin/menus" className="text-sm text-muted hover:text-foreground">← All menus</Link>
      <PageHeader title={menu.name} />
      <MenuBuilder menu={menu} pages={pageOptions} categories={categoryOptions} />
      <div className="mt-6"><DemoEditingNotice /></div>
    </>
  );
}
