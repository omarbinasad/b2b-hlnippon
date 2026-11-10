import type { Metadata } from "next";
import { SettingsNav } from "@/components/admin/settings/settings-nav";
import { SetupWizard } from "@/components/admin/settings/setup-wizard";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Setup wizard" };

export default async function SetupPage() {
  const [settings, zones, tax, rates, payments, groups, posts, pages] = await Promise.all([
    repositories.company.get(),
    repositories.shipping.listZones({ perPage: 1 }),
    repositories.tax.getSettings(),
    repositories.tax.listRates({ perPage: 1 }),
    repositories.payments.listMethods(),
    repositories.customers.listGroups(),
    repositories.posts.list({}),
    repositories.pages.listLive(),
  ]);
  return (
    <>
      <PageHeader title="Settings" description="Set up a new company step by step. You can come back at any time." />
      <SettingsNav current="setup" />
      <SetupWizard
        settings={settings}
        facts={{ zones: zones.total, taxEnabled: tax.enabled, taxRates: rates.total, paymentsEnabled: payments.filter((m) => m.enabled).length, groups: groups.length, livePages: pages.length, posts: posts.length }}
      />
    </>
  );
}
