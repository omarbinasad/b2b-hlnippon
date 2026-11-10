import { Can } from "@/components/admin/capabilities-context";
import type { Metadata } from "next";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { ShippingNav } from "@/components/admin/shipping/shipping-nav";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { Table } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { ruleOptions } from "@/lib/shipping/rule-options";
import { describeRule, type ConditionField } from "@/lib/shipping/rules";

export const metadata: Metadata = { title: "Conditional shipping rules" };

export default async function Page() {
  const [rules, options] = await Promise.all([repositories.shipping.listRules(), ruleOptions()]);
  const nameOf = (field: ConditionField, value: string) => {
    const list = field === "category" ? options.categories : field === "shipping_class" ? options.classes : field === "customer_group" ? options.groups : [];
    return list.find((o) => o.value === value)?.label ?? value;
  };
  return (
    <>
      <PageHeader title="Shipping" description="Change the charge when a cart meets your conditions. Rules run by priority." actions={<Can cap="shipping.manage"><ButtonLink href="/admin/shipping/rules/new"><Icon name="plus" className="size-4" /> Add rule</ButtonLink></Can>} />
      <ShippingNav current="rules" />
      {rules.length ? (
        <Table caption="Shipping rules">
          <thead><tr><th scope="col">Priority</th><th scope="col">Rule</th><th scope="col">Status</th></tr></thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td className="tabular-nums">{r.priority}</td>
                <td className="min-w-64"><Link href={`/admin/shipping/rules/${r.id}`} className="font-medium text-brand hover:underline">{r.name}</Link><span className="block text-xs text-muted">{describeRule(r, formatMoney, nameOf)}</span></td>
                <td><Badge tone={r.enabled ? "success" : "neutral"}>{r.enabled ? "On" : "Off"}</Badge></td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : <EmptyState title="No rules yet" description="Add one to change charges by weight, subtotal, location, group or coupon." />}
      <div className="mt-6"><DemoEditingNotice /></div>
    </>
  );
}
