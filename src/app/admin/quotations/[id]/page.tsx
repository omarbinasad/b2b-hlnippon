import { AllowedLink, Can } from "@/components/admin/capabilities-context";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { QuoteForm } from "@/components/admin/quotations/quote-form";
import { QuotationDetails } from "@/components/order/quotation-details";
import { QuotationStatusBadge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Quotation" };

export default async function AdminQuotationPage({ params }: PageProps<"/admin/quotations/[id]">) {
  const q = await repositories.quotations.getById((await params).id);
  if (!q) notFound();
  return (
    <>
      <Link href="/admin/quotations" className="text-sm text-muted hover:text-foreground">← All quotations</Link>
      <PageHeader title={q.number} description={q.customerName} actions={<QuotationStatusBadge status={q.status} />} />
      <div className="space-y-6">
        {(q.status === "requested" || q.status === "quoted") && <Can cap="quotations.edit"><QuoteForm quotation={q} /></Can>}
        {q.orderId && <Notice tone="success" title={`Order ${q.orderNumber} created`}><AllowedLink href={`/admin/orders/${q.orderId}`} className="font-medium underline">Open the order</AllowedLink></Notice>}
        <QuotationDetails quotation={q} />
        <DemoEditingNotice />
      </div>
    </>
  );
}
