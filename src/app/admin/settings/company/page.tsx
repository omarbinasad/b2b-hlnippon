import type { Metadata } from "next";
import { DemoEditingNotice, MockPermissionNote } from "@/components/admin/demo-notice";
import { CompanyBrandingForm, ResetDemoButton } from "@/components/admin/settings/settings-forms";
import { SettingsNav } from "@/components/admin/settings/settings-nav";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Company & Branding" };

export default async function CompanyBrandingPage() {
  const settings = await repositories.company.get();
  return (
    <>
      <PageHeader title="Settings" description="Your company's identity. Changes apply to the store, customer portal and admin as soon as you save." />
      <SettingsNav current="company" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <CompanyBrandingForm settings={settings} />
        <aside className="space-y-4">
          <MockPermissionNote permission="company.manage" />
          <DemoEditingNotice images />
          <ResetDemoButton />
        </aside>
      </div>
    </>
  );
}
