import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoEditingNotice, MockPermissionNote } from "@/components/admin/demo-notice";
import { QuantityPrecedence } from "@/components/admin/pricing/precedence";
import { QuantityRuleForm } from "@/components/admin/pricing/quantity-rule-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { loadRuleFormData } from "../../form-data";

export async function generateMetadata({ params }: PageProps<"/admin/pricing/quantity/[id]">): Promise<Metadata> {
  const rule = await repositories.quantityRules.get((await params).id);
  return { title: rule ? `Quantity rule: ${rule.name}` : "Rule not found" };
}

export default async function EditQuantityRulePage({ params }: PageProps<"/admin/pricing/quantity/[id]">) {
  const { id } = await params;
  const rule = await repositories.quantityRules.get(id);
  if (!rule) notFound();
  const { categories, initialPicks, initialProduct } = await loadRuleFormData(rule.target);

  return (
    <>
      <Link href="/admin/pricing/quantity" className="text-sm text-muted hover:text-foreground">← Quantity rules</Link>
      <PageHeader
        title={rule.name}
        description={`${rule.id}${rule.legacyWooId ? ` · legacy #${rule.legacyWooId}` : ""} · updated ${formatDateTime(rule.updatedAt)}`}
        actions={<Badge tone={rule.status === "active" ? "success" : "neutral"}>{rule.status === "active" ? "Enabled" : "Disabled"}</Badge>}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <QuantityRuleForm rule={rule} categories={categories} initialPicks={initialPicks} initialProduct={initialProduct} />
        <aside className="space-y-4">
          {rule.conflicts.length > 0 && (
            <Card title="Overlapping rules">
              <ul className="space-y-2 text-sm">
                {rule.conflicts.map((c) => (
                  <li key={c.otherId}>
                    <Badge tone={c.kind === "conflict" ? "warning" : "info"}>{c.kind === "conflict" ? "Conflict" : "Overlap"}</Badge>{" "}
                    <Link href={`/admin/pricing/quantity/${c.otherId}`} className="text-brand hover:underline">{c.otherName}</Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <QuantityPrecedence />
          <MockPermissionNote permission="pricing.manage" />
          <DemoEditingNotice />
        </aside>
      </div>
    </>
  );
}
