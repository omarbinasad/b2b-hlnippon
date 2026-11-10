import { AllowedLink } from "@/components/admin/capabilities-context";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { CampaignForm, EmailPreview, SimulateButton } from "@/components/admin/notify/forms";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";
import { formatCalendarDate, formatDateTime } from "@/lib/format";
import { sanitizeRichHtml } from "@/lib/html/sanitize";
import type { SegmentRecipient } from "@/lib/reminders/segment";

export const metadata: Metadata = { title: "Reminder campaign" };

function Recipients({ title, description, list }: { title: string; description: string; list: SegmentRecipient[] }) {
  return (
    <Card title={`${title} (${list.length})`} description={description}>
      {list.length ? (
        <ul className="scrollbar-thin max-h-64 space-y-1.5 overflow-y-auto text-sm">
          {list.map((r) => <li key={r.customerId}><AllowedLink href={`/admin/customers/${r.customerId}`} className="font-medium text-brand hover:underline">{r.name}</AllowedLink><span className="block text-xs break-all text-muted">{r.email}{r.orderNumbers.length ? ` · ${r.orderNumbers.join(", ")}` : ""}</span></li>)}
        </ul>
      ) : <p className="text-sm text-muted">Nobody right now.</p>}
    </Card>
  );
}

export default async function CampaignPage({ params }: PageProps<"/admin/reminders/[id]">) {
  const { id } = await params;
  const [p, routes, templates, history] = await Promise.all([repositories.reminders.preview(id), repositories.delivery.listRoutes({ perPage: 100 }), repositories.emails.templates(), repositories.reminders.history(id, { perPage: 25 })]);
  if (!p) notFound();
  return (
    <>
      <Link href="/admin/reminders" className="text-sm text-muted hover:text-foreground">← All campaigns</Link>
      <PageHeader title={p.campaign.name} description={`${p.route.name}: ${p.route.areas.join(", ")}`} />
      <div className="space-y-6">
        <Card title="Campaign"><CampaignForm campaign={p.campaign} routes={routes.items.map((r) => ({ id: r.id, name: r.name }))} templates={templates.map((t) => ({ key: t.key, name: t.name }))} /></Card>
        {p.next ? (
          <Notice title={`Next delivery: ${formatCalendarDate(p.next.date)}`}>This reminder would go out on {formatCalendarDate(p.sendOn!)} at {p.campaign.sendTime}. Customers can order until {formatCalendarDate(p.next.orderByDate)}, {p.next.orderByTime}.</Notice>
        ) : <Notice tone="warning" title="No upcoming delivery date">This schedule has no dates, so nothing would go out.</Notice>}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Recipients title="Group A: with an order" description="In this area, with an open order for that date." list={p.segments.withOrder} />
          <Recipients title="Group B: without an order" description="In this area, with no order for that date." list={p.segments.withoutOrder} />
        </div>
        {p.segments.excluded.length > 0 && (
          <Card title={`Not included (${p.segments.excluded.length})`}>
            <ul className="space-y-1 text-sm">{p.segments.excluded.map((x) => <li key={x.customerId}>{x.name} <span className="text-xs text-muted">{x.reason}</span></li>)}</ul>
          </Card>
        )}
        {p.emails && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section aria-label="Email for group A" className="min-w-0 space-y-2"><h2 className="font-semibold">Email for group A</h2><EmailPreview subject={p.emails.withOrder.subject} bodyHtml={sanitizeRichHtml(p.emails.withOrder.bodyHtml)} /></section>
            <section aria-label="Email for group B" className="min-w-0 space-y-2"><h2 className="font-semibold">Email for group B</h2><EmailPreview subject={p.emails.withoutOrder.subject} bodyHtml={sanitizeRichHtml(p.emails.withoutOrder.bodyHtml)} /></section>
          </div>
        )}
        <Card title="Sending history" description="Demo: rows are simulated. Nothing leaves this server.">
          <SimulateButton id={p.campaign.id} />
          {history.items.length ? (
            <div className="mt-3">
              <Table caption="Sending history" density="compact">
                <thead><tr><th scope="col">To</th><th scope="col">Subject</th><th scope="col">Status</th><th scope="col">When</th></tr></thead>
                <tbody>{history.items.map((l) => <tr key={l.id}><td className="break-all">{l.to}</td><td>{l.subject}</td><td><Badge tone={l.status === "failed" ? "danger" : "info"}>{l.status === "failed" ? "Failed" : "Simulated"}</Badge></td><td className="whitespace-nowrap">{formatDateTime(l.at)}</td></tr>)}</tbody>
              </Table>
            </div>
          ) : <p className="mt-3 text-sm text-muted">Nothing yet.</p>}
        </Card>
        <DemoEditingNotice />
      </div>
    </>
  );
}
