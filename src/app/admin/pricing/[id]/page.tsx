import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoEditingNotice, MockPermissionNote } from "@/components/admin/demo-notice";
import { PricePrecedence } from "@/components/admin/pricing/precedence";
import { PriceRuleForm } from "@/components/admin/pricing/price-rule-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { loadRuleFormData } from "../form-data";

export async function generateMetadata({ params }: PageProps<"/admin/pricing/[id]">): Promise<Metadata> {
  const rule = await repositories.pricing.getRule((await params).id);
  return { title: rule ? `Rule: ${rule.name}` : "Rule not found" };
}

export default async function EditPriceRulePage({ params }: PageProps<"/admin/pricing/[id]">) {
  const { id } = await params;
  const rule = await repositories.pricing.getRule(id);
  if (!rule) notFound();
  const data = await loadRuleFormData(rule.target);
  const customerName = rule.audience.type === "customer" ? rule.audienceName : undefined;

  return (
    <>
      <Link href="/admin/pricing" className="text-sm text-muted hover:text-foreground">← Pricing rules</Link>
      <PageHeader
        title={rule.name}
        description={`${rule.id}${rule.legacyWooId ? ` · legacy #${rule.legacyWooId}` : ""} · created ${formatDateTime(rule.createdAt)} · updated ${formatDateTime(rule.updatedAt)}`}
        actions={<Badge tone={rule.status === "active" ? "success" : "neutral"}>{rule.status === "active" ? "Enabled" : "Disabled"}</Badge>}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <PriceRuleForm {...data} rule={rule} initialCustomerName={customerName} />
        <aside className="space-y-4">
          {rule.conflicts.length > 0 && (
            <Card title="Overlapping rules">
              <ul className="space-y-2 text-sm">
                {rule.conflicts.map((c) => (
                  <li key={c.otherId}>
                    <Badge tone={c.kind === "conflict" ? "warning" : "info"}>{c.kind === "conflict" ? "Conflict" : "Overlap"}</Badge>{" "}
                    <Link href={`/admin/pricing/${c.otherId}`} className="text-brand hover:underline">{c.otherName}</Link>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">
                Same customers, product level, dates and quantities. An overlap is decided by priority; a conflict has equal priority and is decided by the older rule.
              </p>
            </Card>
          )}
          <PricePrecedence open />
          <p className="text-xs text-muted">Changing a rule never changes existing orders — each order line keeps the price and rule it was created with.</p>
          <MockPermissionNote permission="pricing.manage" />
          <DemoEditingNotice />
        </aside>
      </div>
    </>
  );
}
