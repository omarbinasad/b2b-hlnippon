import type { Metadata } from "next";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { InvoiceSettingsForm } from "@/components/admin/settings/invoice-settings-form";
import { SettingsNav } from "@/components/admin/settings/settings-nav";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";
import { invoiceSnapshot } from "@/lib/orders/invoice";

export const metadata: Metadata = { title: "Invoice settings" };

export default async function InvoiceSettingsPage() {
  const [settings, store, orders] = await Promise.all([repositories.company.get(), repositories.settings.getStore(), repositories.orders.list({ status: "delivered", perPage: 1 })]);
  const order = orders.items[0] && (await repositories.orders.getById(orders.items[0].id));
  return (
    <>
      <PageHeader title="Settings" description="How invoices look, and how the backend should send them." />
      <SettingsNav current="invoices" />
      <InvoiceSettingsForm settings={settings} store={store} sample={order ? invoiceSnapshot(order) : null} />
      <div className="mt-6"><DemoEditingNotice /></div>
    </>
  );
}
