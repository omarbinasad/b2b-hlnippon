import type { Metadata } from "next";
import Link from "next/link";
import { DemoEditingNotice, MockPermissionNote } from "@/components/admin/demo-notice";
import { StoreSettingsForm } from "@/components/admin/settings/store-settings-form";
import { PlannedFeatures } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const settings = await repositories.settings.getStore();
  return (
    <>
      <PageHeader title="Store settings" description={`Store location, contact details and units. Last saved ${formatDateTime(settings.updatedAt)}.`} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <StoreSettingsForm settings={settings} />
        <aside className="space-y-4">
          <p className="text-sm">
            Shipping zones and rates are under <Link href="/admin/shipping" className="font-medium text-brand hover:underline">Shipping</Link>.
          </p>
          <MockPermissionNote permission="settings.manage" />
          <DemoEditingNotice />
          <PlannedFeatures items={["Staff users and roles", "Email templates"]} />
        </aside>
      </div>
    </>
  );
}
