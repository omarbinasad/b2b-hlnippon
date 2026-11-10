import { WriteGuard } from "@/components/admin/capabilities-context";
import type { Metadata } from "next";
import Link from "next/link";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { SenderForm } from "@/components/admin/notify/forms";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Email templates" };

export default async function EmailTemplatesPage() {
  const [templates, sender] = await Promise.all([repositories.emails.templates(), repositories.emails.sender()]);
  return (
    <>
      <PageHeader title="Email templates" description="What customers receive, and when." />
      <div className="space-y-6">
        <Notice>This demo never sends email. It records what would go out under Email logs. The backend sends them, with a queue and retries.</Notice>
        <WriteGuard cap="emails.manage"><SenderForm sender={sender} /></WriteGuard>
        <Table caption="Email templates">
          <thead><tr><th scope="col">Template</th><th scope="col">Sent when</th><th scope="col">Status</th></tr></thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.key}>
                <td className="min-w-48"><Link href={`/admin/emails/${t.key}`} className="font-medium text-brand hover:underline">{t.name}</Link><span className="block text-xs text-muted">{t.subject}</span></td>
                <td className="text-sm">{t.trigger}</td>
                <td><Badge tone={t.enabled ? "success" : "neutral"}>{t.enabled ? "On" : "Off"}</Badge></td>
              </tr>
            ))}
          </tbody>
        </Table>
        <DemoEditingNotice />
      </div>
    </>
  );
}
