import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SavedListEditor } from "@/components/account/saved-list-editor";
import { PageHeader } from "@/components/ui/page-header";
import { getPortalCustomerId } from "@/lib/auth/session";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Saved list" };

export default async function SavedListPage({ params }: PageProps<"/account/lists/[id]">) {
  const list = await repositories.savedLists.get(await getPortalCustomerId(), (await params).id);
  if (!list) notFound();
  return (
    <>
      <Link href="/account/lists" className="text-sm text-muted hover:text-foreground">← All lists</Link>
      <PageHeader title={list.name} />
      <SavedListEditor key={list.updatedAt} list={list} />
    </>
  );
}
