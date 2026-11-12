import type { Metadata } from "next";
import Link from "next/link";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { ProductCsvImport } from "@/components/admin/products/csv-import";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Import products" };

export default function ImportProductsPage() {
  return (
    <>
      <Link href="/admin/products" className="text-sm text-muted hover:text-foreground">← All products</Link>
      <PageHeader title="Import products" description="Add or update products from a CSV file. Columns are explained in the template." />
      <ProductCsvImport />
      <div className="mt-6"><DemoEditingNotice /></div>
    </>
  );
}
