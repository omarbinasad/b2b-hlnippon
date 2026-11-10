import type { Metadata } from "next";
import Link from "next/link";
import { NewListForm } from "@/components/account/saved-list-editor";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { getPortalCustomerId } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Saved lists" };

export default async function SavedListsPage() {
  const lists = await repositories.savedLists.list(await getPortalCustomerId());
  return (
    <>
      <PageHeader title="Saved lists" description="Products you reorder together. Add a whole list to your cart in one step." />
      <div className="space-y-6">
        <Card><NewListForm /></Card>
        {lists.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {lists.map((l) => (
              <li key={l.id}>
                <Link href={`/account/lists/${l.id}`} className="block rounded-ui border border-line bg-surface p-4 hover:border-brand">
                  <span className="font-semibold">{l.name}</span>
                  <span className="mt-1 block text-sm text-muted">{l.items.length} product{l.items.length === 1 ? "" : "s"} · updated {formatDateTime(l.updatedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No saved lists yet" description="Create one above, or save a past order as a list from its order page." />}
      </div>
    </>
  );
}
