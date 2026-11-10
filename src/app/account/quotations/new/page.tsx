import type { Metadata } from "next";
import Link from "next/link";
import { QuotationRequestForm } from "@/components/account/quotation-forms";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Request a quotation" };

export default function NewQuotationPage() {
  return (
    <>
      <Link href="/account/quotations" className="text-sm text-muted hover:text-foreground">← All quotations</Link>
      <PageHeader title="Request a quotation" />
      <QuotationRequestForm />
    </>
  );
}
