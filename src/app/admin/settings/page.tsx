import type { Metadata } from "next";
import { DemoEditingNotice, MockPermissionNote } from "@/components/admin/demo-notice";
import { SettingsNav } from "@/components/admin/settings/settings-nav";
import { GeneralSettingsForm, ResetDemoButton } from "@/components/admin/settings/settings-forms";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "General settings" };

export default async function GeneralSettingsPage() {
  const settings = await repositories.company.get();
  return (
    <>
      <PageHeader title="Settings" description={`Currency, location, language and units. Last saved ${formatDateTime(settings.updatedAt)}.`} />
      <SettingsNav current="general" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <GeneralSettingsForm settings={settings} />
        <aside className="space-y-4">
          <MockPermissionNote permission="company.manage" />
          <DemoEditingNotice />
          <ResetDemoButton />
        </aside>
      </div>
    </>
  );
}
