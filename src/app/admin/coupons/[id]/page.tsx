import { AllowedLink } from "@/components/admin/capabilities-context";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CouponForm } from "@/components/admin/coupons/coupon-form";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";
import { formatDateTime, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Edit coupon" };

async function formData() {
  const [categories, groups] = await Promise.all([repositories.products.listCategories(), repositories.customers.listGroups()]);
  return {
    categories: categories.filter((c) => !c.parentId).sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.slug, label: c.name })),
    groups: groups.map((g) => ({ id: g.id, label: g.name })),
  };
}

export default async function EditCouponPage({ params }: PageProps<"/admin/coupons/[id]">) {
  const coupon = await repositories.coupons.getById((await params).id);
  if (!coupon) notFound();
  const [data, usage, products, excluded, customers] = await Promise.all([
    formData(),
    repositories.coupons.usage(coupon.id, { perPage: 50 }),
    repositories.products.getPicks(coupon.productIds),
    repositories.products.getPicks(coupon.excludedProductIds),
    Promise.all(coupon.customerIds.map((id) => repositories.customers.getById(id))),
  ]);
  const label = (p: { id: string; name: string; sku: string }) => ({ id: p.id, label: `${p.name} (${p.sku})` });
  return (
    <>
      <Link href="/admin/coupons" className="text-sm text-muted hover:text-foreground">← All coupons</Link>
      <PageHeader title={coupon.code} />
      <CouponForm coupon={coupon} {...data} names={{ products: products.map(label), excluded: excluded.map(label), customers: customers.flatMap((c) => (c ? [{ id: c.id, label: c.companyName }] : [])) }} />
      <div className="mt-6 space-y-6">
        <Card title="Usage history">
          {usage.items.length ? (
            <Table caption="Orders that used this coupon" density="compact">
              <thead><tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col" className="text-right">Discount</th><th scope="col">When</th></tr></thead>
              <tbody>{usage.items.map((u) => <tr key={u.id}><td><AllowedLink href={`/admin/orders/${u.orderId}`} className="text-brand hover:underline">{u.orderNumber}</AllowedLink></td><td>{u.customerName}</td><td className="text-right tabular-nums">{formatMoney(u.discount)}</td><td className="whitespace-nowrap">{formatDateTime(u.at)}</td></tr>)}</tbody>
            </Table>
          ) : <p className="text-sm text-muted">Not used yet.</p>}
        </Card>
        <DemoEditingNotice />
      </div>
    </>
  );
}
