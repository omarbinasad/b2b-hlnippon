import type { Metadata } from "next";
import Link from "next/link";
import { DemoEditingNotice, MockPermissionNote } from "@/components/admin/demo-notice";
import { PricePrecedence } from "@/components/admin/pricing/precedence";
import { PriceRuleForm } from "@/components/admin/pricing/price-rule-form";
import { PageHeader } from "@/components/ui/page-header";
import { loadRuleFormData } from "../form-data";

export const metadata: Metadata = { title: "New pricing rule" };

export default async function NewPriceRulePage() {
  const data = await loadRuleFormData();
  return (
    <>
      <Link href="/admin/pricing" className="text-sm text-muted hover:text-foreground">← Pricing rules</Link>
      <PageHeader title="New pricing rule" description="A price for some customers on some products, optionally in quantity tiers." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <PriceRuleForm {...data} />
        <aside className="space-y-4">
          <PricePrecedence open />
          <MockPermissionNote permission="pricing.manage" />
          <DemoEditingNotice />
        </aside>
      </div>
    </>
  );
}
