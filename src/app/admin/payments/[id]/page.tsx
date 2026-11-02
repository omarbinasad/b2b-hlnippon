import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoEditingNotice, MockPermissionNote } from "@/components/admin/demo-notice";
import { PaymentMethodForm } from "@/components/admin/payments/payment-method-form";
import { PaymentStatusBadges } from "@/components/admin/payments/payment-status";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { paymentMethodKindLabel } from "@/lib/payments/methods";
import type { PaymentMethodId } from "@/lib/types";

const IDS: PaymentMethodId[] = ["pay_on_delivery", "bank_transfer", "online"];

export async function generateMetadata({ params }: PageProps<"/admin/payments/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: IDS.includes(id as PaymentMethodId) ? `Payment: ${paymentMethodKindLabel[id as PaymentMethodId]}` : "Payment method not found" };
}

export default async function PaymentMethodPage({ params }: PageProps<"/admin/payments/[id]">) {
  const { id } = await params;
  if (!IDS.includes(id as PaymentMethodId)) notFound();
  const method = await repositories.payments.getMethod(id as PaymentMethodId);
  if (!method) notFound();

  return (
    <>
      <Link href="/admin/payments" className="text-sm text-muted hover:text-foreground">← Payment methods</Link>
      <PageHeader title={paymentMethodKindLabel[method.id]} description={`Updated ${formatDateTime(method.updatedAt)}`} actions={<PaymentStatusBadges method={method} />} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <PaymentMethodForm method={method} />
        <aside className="space-y-4">
          <Card title="Availability">
            <p className="text-sm">{method.availability.availableAtCheckout ? "Offered at checkout." : "Not offered at checkout."}</p>
            {method.availability.reasons.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                {method.availability.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
            )}
          </Card>
          <p className="text-xs text-muted">Choosing a method never marks an order paid; staff confirm payments separately (a later module).</p>
          <MockPermissionNote permission="payments.manage" />
          <DemoEditingNotice />
        </aside>
      </div>
    </>
  );
}
