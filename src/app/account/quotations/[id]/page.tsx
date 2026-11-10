import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QuotationResponse } from "@/components/account/quotation-forms";
import { QuotationDetails } from "@/components/order/quotation-details";
import { QuotationStatusBadge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { getPortalCustomerId } from "@/lib/auth/session";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Quotation" };

export default async function QuotationPage({ params }: PageProps<"/account/quotations/[id]">) {
  const q = await repositories.quotations.getById((await params).id, await getPortalCustomerId());
  if (!q) notFound();
  return (
    <>
      <Link href="/account/quotations" className="text-sm text-muted hover:text-foreground">← All quotations</Link>
      <PageHeader title={q.number} actions={<QuotationStatusBadge status={q.status} />} />
      <div className="space-y-6">
        {q.status === "requested" && <Notice>We have your request and will reply with a quote.</Notice>}
        {q.status === "quoted" && <QuotationResponse id={q.id} />}
        {q.orderId && <Notice tone="success" title={`Order ${q.orderNumber} created`}><Link href={`/account/orders/${q.orderId}`} className="font-medium underline">View the order</Link></Notice>}
        <QuotationDetails quotation={q} />
      </div>
    </>
  );
}
