import { Can } from "@/components/admin/capabilities-context";
import type { Metadata } from "next";
import Link from "next/link";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import type { MenuItem } from "@/lib/types";

export const metadata: Metadata = { title: "Navigation menus" };

const LOCATION = { header: "Store header", footer: "Store footer", none: "Not shown" } as const;
const count = (items: MenuItem[]): number => items.reduce((n, i) => n + 1 + count(i.children), 0);

export default async function MenusPage() {
  const menus = await repositories.navigation.list();
  return (
    <>
      <PageHeader
        title="Navigation menus"
        description="The links in your store header and footer."
        actions={<Can cap="menus.edit"><ButtonLink href="/admin/menus/new"><Icon name="plus" className="size-4" /> Add menu</ButtonLink></Can>}
      />
      <Table caption="Menus">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Shown in</th>
            <th scope="col">Items</th>
            <th scope="col">Updated</th>
          </tr>
        </thead>
        <tbody>
          {menus.map((m) => (
            <tr key={m.id}>
              <td><Link href={`/admin/menus/${m.id}`} className="font-medium text-brand hover:underline">{m.name}</Link></td>
              <td><Badge tone={m.location === "none" ? "neutral" : "success"}>{LOCATION[m.location]}</Badge></td>
              <td>{count(m.items)}</td>
              <td className="whitespace-nowrap">{formatDateTime(m.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="mt-6"><DemoEditingNotice /></div>
    </>
  );
}
