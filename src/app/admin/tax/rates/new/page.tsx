import type { Metadata } from "next";
import Link from "next/link";
import { DemoEditingNotice, MockPermissionNote } from "@/components/admin/demo-notice";
import { TaxRules } from "@/components/admin/tax/tax-nav";
import { TaxRateForm } from "@/components/admin/tax/tax-rate-form";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "New tax rate" };

export default async function NewTaxRatePage() {
  const [rates, classes] = await Promise.all([repositories.tax.listRates({ perPage: 500 }), repositories.catalogSettings.taxClasses()]);
  return (
    <>
      <Link href="/admin/tax" className="text-sm text-muted hover:text-foreground">← Tax</Link>
      <PageHeader title="New tax rate" description="Demo rates must be fictional — do not enter a legal rate here." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <TaxRateForm others={rates.items} classes={classes} />
        <aside className="space-y-4">
          <TaxRules open />
          <MockPermissionNote permission="tax.manage" />
          <DemoEditingNotice />
        </aside>
      </div>
    </>
  );
}
