import type { Metadata } from "next";
import Link from "next/link";
import { RuleForm } from "@/components/admin/shipping/rule-form";
import { PageHeader } from "@/components/ui/page-header";
import { ruleOptions } from "@/lib/shipping/rule-options";

export const metadata: Metadata = { title: "Add shipping rule" };

export default async function NewRulePage() {
  return (
    <>
      <Link href="/admin/shipping/rules" className="text-sm text-muted hover:text-foreground">← All rules</Link>
      <PageHeader title="Add shipping rule" />
      <RuleForm options={await ruleOptions()} />
    </>
  );
}
