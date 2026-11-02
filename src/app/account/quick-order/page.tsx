import type { Metadata } from "next";
import { QuickOrderSheet } from "@/components/quick-order/quick-order-sheet";
import { PageHeader } from "@/components/ui/page-header";
import { loadQuickOrderSheet } from "@/lib/storefront/quick-order";

export const metadata: Metadata = { title: "Quick order" };

export default async function QuickOrderPage() {
  const sheet = await loadQuickOrderSheet();

  return (
    <>
      <PageHeader title="Quick order" description="Search by product name or SKU, enter quantities, then add everything to your cart at once." />
      <QuickOrderSheet {...sheet} />
    </>
  );
}
