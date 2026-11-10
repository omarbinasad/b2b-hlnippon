import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TemplateForm } from "@/components/admin/notify/forms";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";
import type { EmailTemplateKey } from "@/lib/types";

export const metadata: Metadata = { title: "Email template" };

export default async function EmailTemplatePage({ params }: PageProps<"/admin/emails/[key]">) {
  const template = await repositories.emails.template((await params).key as EmailTemplateKey);
  if (!template) notFound();
  return (
    <>
      <Link href="/admin/emails" className="text-sm text-muted hover:text-foreground">← All templates</Link>
      <PageHeader title={template.name} />
      <TemplateForm template={template} />
    </>
  );
}
