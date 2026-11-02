import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { CreateOrderForm } from "@/components/admin/orders/create-order-form";
import { PageHeader } from "@/components/ui/page-header";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "New order" };

export default async function NewOrderPage() {
  await connection(); // "today" must be the request date, not the build date
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: siteConfig.timeZone }).format(new Date());

  return (
    <>
      <Link href="/admin/orders" className="text-sm text-muted hover:text-foreground">← All orders</Link>
      <PageHeader title="New order" description="Create an order on behalf of an approved customer." />
      <div className="mb-6">
        <DemoEditingNotice />
      </div>
      <CreateOrderForm today={today} />
    </>
  );
}
