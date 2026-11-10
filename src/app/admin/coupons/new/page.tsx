import type { Metadata } from "next";
import Link from "next/link";
import { CouponForm } from "@/components/admin/coupons/coupon-form";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Add coupon" };

async function formData() {
  const [categories, groups] = await Promise.all([repositories.products.listCategories(), repositories.customers.listGroups()]);
  return {
    categories: categories.filter((c) => !c.parentId).sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.slug, label: c.name })),
    groups: groups.map((g) => ({ id: g.id, label: g.name })),
  };
}

export default async function NewCouponPage() {
  return (
    <>
      <Link href="/admin/coupons" className="text-sm text-muted hover:text-foreground">← All coupons</Link>
      <PageHeader title="Add coupon" />
      <CouponForm {...(await formData())} names={{ products: [], excluded: [], customers: [] }} />
    </>
  );
}
