import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoEditingNotice, MockPermissionNote } from "@/components/admin/demo-notice";
import { TaxRules } from "@/components/admin/tax/tax-nav";
import { TaxRateForm } from "@/components/admin/tax/tax-rate-form";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { deleteTaxRateAction } from "../../actions";

export async function generateMetadata({ params }: PageProps<"/admin/tax/rates/[id]">): Promise<Metadata> {
  const rate = await repositories.tax.getRate((await params).id);
  return { title: rate ? `Tax rate: ${rate.name}` : "Rate not found" };
}

export default async function EditTaxRatePage({ params }: PageProps<"/admin/tax/rates/[id]">) {
  const { id } = await params;
  const [rate, rates, classes] = await Promise.all([repositories.tax.getRate(id), repositories.tax.listRates({ perPage: 500 }), repositories.catalogSettings.taxClasses()]);
  if (!rate) notFound();

  return (
    <>
      <Link href="/admin/tax" className="text-sm text-muted hover:text-foreground">← Tax</Link>
      <PageHeader title={rate.name} description={`${rate.id}${rate.legacyWooId ? ` · legacy #${rate.legacyWooId}` : ""} · updated ${formatDateTime(rate.updatedAt)}`} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <TaxRateForm rate={rate} others={rates.items.filter((r) => r.id !== rate.id)} classes={classes} />
        <aside className="space-y-4">
          <p className="text-xs text-muted">Orders keep the rate they were created with — editing or deleting this rate never changes existing orders.</p>
          <TaxRules />
          <Card title="Delete rate">
            <form action={deleteTaxRateAction}>
              <input type="hidden" name="id" value={rate.id} />
              <ConfirmButton
                title={`Delete “${rate.name}”?`}
                message="Addresses it covered will use a broader rate or be untaxed. Existing orders keep their tax snapshot."
                confirmLabel="Delete rate"
                className="text-sm font-medium text-danger hover:underline"
              >
                Delete this rate
              </ConfirmButton>
            </form>
          </Card>
          <MockPermissionNote permission="tax.manage" />
          <DemoEditingNotice />
        </aside>
      </div>
    </>
  );
}
