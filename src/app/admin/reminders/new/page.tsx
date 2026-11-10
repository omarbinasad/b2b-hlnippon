import type { Metadata } from "next";
import Link from "next/link";
import { CampaignForm } from "@/components/admin/notify/forms";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Add reminder campaign" };

export default async function NewCampaignPage() {
  const [routes, templates] = await Promise.all([repositories.delivery.listRoutes({ perPage: 100 }), repositories.emails.templates()]);
  const routeOptions = routes.items.map((r) => ({ id: r.id, name: r.name }));
  const templateOptions = templates.map((t) => ({ key: t.key, name: t.name }));
  return (
    <>
      <Link href="/admin/reminders" className="text-sm text-muted hover:text-foreground">← All campaigns</Link>
      <PageHeader title="Add reminder campaign" />
      <Card><CampaignForm routes={routeOptions} templates={templateOptions} /></Card>
    </>
  );
}
