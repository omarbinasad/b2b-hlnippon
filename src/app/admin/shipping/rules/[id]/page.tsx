import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { RuleForm } from "@/components/admin/shipping/rule-form";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";
import { ruleOptions } from "@/lib/shipping/rule-options";

export const metadata: Metadata = { title: "Edit shipping rule" };

export default async function EditRulePage({ params }: PageProps<"/admin/shipping/rules/[id]">) {
  const rule = await repositories.shipping.getRule((await params).id);
  if (!rule) notFound();
  return (
    <>
      <Link href="/admin/shipping/rules" className="text-sm text-muted hover:text-foreground">← All rules</Link>
      <PageHeader title={rule.name} />
      <RuleForm rule={rule} options={await ruleOptions()} />
      <div className="mt-6"><DemoEditingNotice /></div>
    </>
  );
}
