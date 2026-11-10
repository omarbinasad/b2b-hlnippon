import { AllowedLink, Can, WriteGuard } from "@/components/admin/capabilities-context";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddressBook } from "@/components/admin/customers/address-book";
import { DeleteCustomerButton } from "@/components/admin/customers/delete-customer";
import { CustomerStatusPanel } from "@/components/admin/customers/status-panel";
import { ActionNotice, DemoEditingNotice, MockPermissionNote } from "@/components/admin/demo-notice";
import { AccountStatusBadge, OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Table } from "@/components/ui/table";
import { accountStatusLabels } from "@/lib/customers/status";
import { repositories } from "@/lib/data";
import { allPages } from "@/lib/data/all-pages";
import { formatDate, formatDateTime, formatFileSize, formatMoney, formatNumber } from "@/lib/format";
import { DOCUMENT_KINDS } from "@/lib/validation/documents";

export async function generateMetadata({ params }: PageProps<"/admin/customers/[id]">): Promise<Metadata> {
  const c = await repositories.customers.getById((await params).id);
  return { title: c?.companyName ?? "Customer not found" };
}

export default async function AdminCustomerPage({ params, searchParams }: PageProps<"/admin/customers/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const customer = await repositories.customers.getListItem(id);
  if (!customer) notFound();
  const [orders, routes] = await Promise.all([
    repositories.orders.list({ customerId: id, perPage: 8 }),
    allPages((page, perPage) => repositories.delivery.listRoutes({ page, perPage })),
  ]);
  const route = routes.find((r) => r.id === customer.deliveryRouteId);
  const notice = typeof sp.notice === "string" ? sp.notice : undefined;
  const missing = [
    !customer.contactName && "contact person",
    !customer.phone && "phone",
    !customer.email && "email",
    !customer.addresses.length && "address",
    !customer.businessType && "business type",
  ].filter(Boolean);

  const detail = (label: string, value?: string) => (
    <div className="flex justify-between gap-4 py-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right break-all">{value || <span className="text-muted">—</span>}</dd>
    </div>
  );

  return (
    <>
      <Link href="/admin/customers" className="text-sm text-muted hover:text-foreground">← All customers</Link>
      <PageHeader
        title={customer.companyName}
        description={`Customer since ${formatDate(customer.createdAt)}${customer.legacyWooId ? ` · legacy #${customer.legacyWooId}` : ""} · ID ${customer.id}`}
        actions={
          <>
            <AccountStatusBadge status={customer.status} />
            {customer.orderCount === 0 && <Can cap="customers.delete"><DeleteCustomerButton customerId={customer.id} name={customer.companyName} /></Can>}
            <Can cap="customers.edit"><ButtonLink href={`/admin/customers/${customer.id}/edit`} variant="secondary">Edit details</ButtonLink></Can>
          </>
        }
      />
      <ActionNotice notice={notice} />
      {missing.length > 0 && (
        <p className="mb-4 rounded-ui border border-line bg-surface-muted px-3 py-2 text-sm">
          Details to complete: {missing.join(", ")}.{" "}
          <AllowedLink href={`/admin/customers/${customer.id}/edit`} className="font-medium text-brand hover:underline">Edit details</AllowedLink>
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Orders" value={formatNumber(customer.orderCount)} hint="Excluding cancelled" />
        <StatCard label="Total spend" value={formatMoney(customer.totalSpend)} hint="After refunds" />
        <StatCard label="Last order" value={customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "—"} />
        <StatCard label="Group" value={customer.groupName ?? "None"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Card title="Addresses" description="Delivery and billing addresses. Orders keep their own copy, so edits don't change past orders.">
            <WriteGuard cap="customers.edit"><AddressBook
              customerId={customer.id}
              addresses={customer.addresses}
              defaults={{ companyName: customer.companyName, recipientName: customer.contactName ?? "", phone: customer.phone ?? "" }}
            /></WriteGuard>
          </Card>

          <Card
            title="Orders"
            actions={customer.orderCount > 0 ? <AllowedLink href={`/admin/orders?customer=${customer.id}`} className="text-sm font-medium text-brand hover:underline">View all</AllowedLink> : undefined}
          >
            {orders.items.length ? (
              <Table caption="Recent orders" density="compact">
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col">Placed</th>
                    <th scope="col">Fulfillment</th>
                    <th scope="col">Payment</th>
                    <th scope="col" className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.items.map((o) => (
                    <tr key={o.id}>
                      <td><AllowedLink href={`/admin/orders/${o.id}`} className="font-medium text-brand hover:underline">{o.number}</AllowedLink></td>
                      <td className="whitespace-nowrap">{formatDate(o.placedAt)}</td>
                      <td><OrderStatusBadge status={o.status} /></td>
                      <td><PaymentStatusBadge status={o.paymentStatus} /></td>
                      <td className="text-right whitespace-nowrap tabular-nums">{formatMoney(o.totals.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState
                title="No orders yet"
                description={customer.status === "approved" ? "Create the first order on the customer's behalf." : "Orders can be created once the customer is approved."}
                action={customer.status === "approved" ? <Can cap="orders_create.create"><ButtonLink href="/admin/orders/new" variant="secondary">New order</ButtonLink></Can> : undefined}
              />
            )}
          </Card>

          <Card title="Approval history" description="Every decision with who made it, when and why.">
            <ol className="space-y-3 border-l border-line pl-4">
              {[...customer.statusHistory].reverse().map((e) => (
                <li key={e.id} className="relative text-sm">
                  <span aria-hidden className="absolute top-1.5 -left-[1.3rem] size-2.5 rounded-full bg-brand" />
                  <p className="font-medium">
                    {e.from ? `${accountStatusLabels[e.from]} → ${accountStatusLabels[e.to]}` : `Created as ${accountStatusLabels[e.to]}`}
                  </p>
                  <p className="text-xs text-muted">{formatDateTime(e.at)} · {e.by.name}{e.by.role === "customer" ? " (customer)" : ""}</p>
                  {e.reason && <p className="mt-0.5 text-muted">“{e.reason}”</p>}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card title="Approval">
            <Can cap="customer_approval.approve"><CustomerStatusPanel customerId={customer.id} companyName={customer.companyName} status={customer.status} /></Can>
            <div className="mt-3">
              <MockPermissionNote permission="customer_approval.approve" />
            </div>
          </Card>

          <Card title="Contact">
            <dl className="divide-y divide-line text-sm">
              {detail("Contact person", customer.contactName)}
              {detail("Phone", customer.phone)}
              {detail("Email", customer.email)}
            </dl>
          </Card>

          <Card title="Business">
            <dl className="divide-y divide-line text-sm">
              {detail("Business type", customer.businessType)}
              {detail("Trade licence", customer.tradeLicenseNumber)}
              {detail("Invoice registration no.", customer.vatRegistrationNumber)}
              {detail("Group", customer.groupName)}
              {detail("Delivery route", route?.name)}
            </dl>
            {customer.groupId && (
              <p className="mt-2 text-xs text-muted">
                <Link href={`/admin/customer-groups/${customer.groupId}`} className="text-brand hover:underline">View group</Link> · group ID{" "}
                <code>{customer.groupId}</code>
              </p>
            )}
          </Card>

          <Can cap="customer_approval.view"><Card title="Identity documents" description="Uploaded with the application. Staff only.">
            {customer.documents?.length ? (
              <ul className="divide-y divide-line text-sm">
                {customer.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block font-medium">{DOCUMENT_KINDS[d.kind]}</span>
                      <span className="block truncate text-xs text-muted">{d.fileName} · {formatFileSize(d.size)}</span>
                    </span>
                    <a href={`/admin/customers/${customer.id}/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="shrink-0 font-medium text-brand hover:underline">
                      View
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">None uploaded.</p>
            )}
            <p className="mt-2 text-xs text-muted">Demo: files are kept in server memory only and are lost on restart.</p>
          </Card></Can>

          {customer.internalNote && (
            <Card title="Internal note">
              <p className="text-sm whitespace-pre-line">{customer.internalNote}</p>
              <p className="mt-2 text-xs text-muted">Staff only — never shown to the customer.</p>
            </Card>
          )}
        </div>
      </div>

      <div className="mt-6">
        <DemoEditingNotice />
      </div>
    </>
  );
}
