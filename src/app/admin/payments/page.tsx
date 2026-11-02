import type { Metadata } from "next";
import Link from "next/link";
import { ActionNotice, DemoEditingNotice, MockPermissionNote } from "@/components/admin/demo-notice";
import { PaymentStatusBadges } from "@/components/admin/payments/payment-status";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { paymentMethodKindLabel } from "@/lib/payments/methods";
import { paymentListAction } from "./actions";

export const metadata: Metadata = { title: "Payment methods" };

const small = "inline-flex h-8 items-center gap-1 rounded-ui border border-line px-2.5 text-sm font-medium hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50";

export default async function PaymentMethodsPage({ searchParams }: PageProps<"/admin/payments">) {
  const sp = await searchParams;
  const notice = typeof sp.notice === "string" ? sp.notice : undefined;
  const [methods, checkout] = await Promise.all([repositories.payments.listMethods(), repositories.payments.checkoutMethods()]);

  return (
    <>
      <PageHeader title="Payment methods" description="Which payment options checkout will offer, in what order, and what customers see." />
      <ActionNotice notice={notice} />
      <div className="mb-6 space-y-3">
        <Notice tone="warning" title="Demo configuration only">
          No payment is processed and selecting a method never marks an order paid. Online payment stays “Not connected” until a backend payment integration exists; no card details or
          gateway keys are entered or stored here. Bank details are fictional examples.
        </Notice>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="methods-heading" className="min-w-0">
          <h2 id="methods-heading" className="mb-3 text-base font-semibold">Methods (display order)</h2>
          <ol className="space-y-3">
            {methods.map((m, i) => (
              <li key={m.id} className="rounded-ui border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted">
                      {i + 1}. {paymentMethodKindLabel[m.id]}
                      {m.legacyWooGatewayId && ` · legacy gateway “${m.legacyWooGatewayId}”`}
                    </p>
                    <h3 className="text-base font-semibold">
                      <Link href={`/admin/payments/${m.id}`} className="hover:underline">{m.title}</Link>
                    </h3>
                    {m.description && <p className="text-sm text-muted">{m.description}</p>}
                  </div>
                  <PaymentStatusBadges method={m} />
                </div>
                {!m.availability.availableAtCheckout && m.availability.reasons.length > 0 && (
                  <p className="mt-2 text-sm text-muted">Why not available: {m.availability.reasons.join(" ")}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ButtonLink href={`/admin/payments/${m.id}`} variant="secondary" size="sm">
                    <Icon name="pencil" className="size-4" /> Edit
                  </ButtonLink>
                  <form action={paymentListAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="op" value={m.enabled ? "disable" : "enable"} />
                    <button type="submit" className={small} aria-label={`${m.enabled ? "Disable" : "Enable"} ${m.title}`}>
                      {m.enabled ? "Disable" : "Enable"}
                    </button>
                  </form>
                  <form action={paymentListAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="op" value="up" />
                    <button type="submit" className={small} disabled={i === 0} aria-label={`Move ${m.title} up`}>
                      <Icon name="arrowUp" className="size-4" />
                    </button>
                  </form>
                  <form action={paymentListAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="op" value="down" />
                    <button type="submit" className={small} disabled={i === methods.length - 1} aria-label={`Move ${m.title} down`}>
                      <Icon name="arrowDown" className="size-4" />
                    </button>
                  </form>
                  <span className="text-xs text-muted">Updated {formatDateTime(m.updatedAt)}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="min-w-0 space-y-4">
          <Card title="Checkout will offer" description="Enabled and available methods, in order — what the future checkout receives.">
            {checkout.length ? (
              <ol className="space-y-2 text-sm">
                {checkout.map((c, i) => (
                  <li key={c.id} className="rounded-ui border border-line p-3">
                    <p className="font-medium">{i + 1}. {c.title}</p>
                    {c.description && <p className="text-xs text-muted">{c.description}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="No payment method available" description="Checkout would have no way to pay. Enable and configure at least one method." />
            )}
            <p className="mt-3 text-xs text-muted">Checkout is not built yet; this list comes from the same repository method it will use.</p>
          </Card>
          <MockPermissionNote permission="payments.manage" />
          <DemoEditingNotice />
        </div>
      </div>
    </>
  );
}
