import type { Metadata } from "next";
import Link from "next/link";
import { DemoEditingNotice, MockPermissionNote } from "@/components/admin/demo-notice";
import { QuantityPrecedence } from "@/components/admin/pricing/precedence";
import { QuantityRuleForm } from "@/components/admin/pricing/quantity-rule-form";
import { PageHeader } from "@/components/ui/page-header";
import { loadRuleFormData } from "../../form-data";

export const metadata: Metadata = { title: "New quantity rule" };

export default async function NewQuantityRulePage() {
  const { categories, initialPicks, initialProduct } = await loadRuleFormData();
  return (
    <>
      <Link href="/admin/pricing/quantity" className="text-sm text-muted hover:text-foreground">← Quantity rules</Link>
      <PageHeader title="New quantity rule" description="Minimum and/or maximum quantity per order line." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <QuantityRuleForm categories={categories} initialPicks={initialPicks} initialProduct={initialProduct} />
        <aside className="space-y-4">
          <QuantityPrecedence />
          <MockPermissionNote permission="pricing.manage" />
          <DemoEditingNotice />
        </aside>
      </div>
    </>
  );
}
