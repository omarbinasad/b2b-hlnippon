"use client";

import { useRouter } from "next/navigation";
import { updateInvoiceSettingsAction } from "@/app/admin/settings/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { InvoiceDocument } from "@/components/order/invoice-document";
import type { CompanyDocumentBranding, CompanySettingsInput, InvoiceSnapshot, StoreSettings } from "@/lib/types";
import { useCompanyDraft } from "./company-fields";

export function InvoiceSettingsForm({ settings, store, sample }: { settings: CompanySettingsInput; store: StoreSettings; sample: InvoiceSnapshot | null }) {
  const router = useRouter();
  const form = useCompanyDraft(settings, updateInvoiceSettingsAction);
  const d = form.draft.documents;
  const set = (patch: Partial<CompanyDocumentBranding>) => form.setDraft({ ...form.draft, documents: { ...d, ...patch } });
  const check = (key: "showLogoOnInvoice" | "showRegistrationOnInvoice" | "showTaxNumberOnInvoice" | "attachInvoicePdf" | "emailInvoiceOnIssue", label: string) => (
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-brand" checked={Boolean(d[key])} onChange={(e) => set({ [key]: e.target.checked })} /> {label}</label>
  );
  const prefix = d.invoicePrefix || "INV";
  return (
    <div className="grid gap-6 2xl:grid-cols-2">
      <form noValidate onSubmit={(e) => { e.preventDefault(); form.save(() => router.refresh()); }} className="min-w-0 space-y-6">
        <Card title="Document" description="Business details and the logo come from Company & Branding.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="inv-title" label="Invoice title"><Input id="inv-title" value={d.invoiceTitle ?? ""} placeholder="Invoice" onChange={(e) => set({ invoiceTitle: e.target.value })} /></Field>
            <Field id="inv-prefix" label="Number prefix" error={form.errors["documents.invoicePrefix"]} hint={`Next invoices look like ${prefix}-${new Date().getFullYear()}-0001. Issued numbers never change.`}>
              <Input id="inv-prefix" value={d.invoicePrefix ?? ""} onChange={(e) => set({ invoicePrefix: e.target.value.toUpperCase() })} aria-invalid={Boolean(form.errors["documents.invoicePrefix"])} aria-describedby={form.errors["documents.invoicePrefix"] ? "inv-prefix-error" : "inv-prefix-hint"} />
            </Field>
            <div className="sm:col-span-2"><Field id="inv-header" label="Note above the footer" hint="e.g. payment terms."><Textarea id="inv-header" rows={2} value={d.invoiceHeaderNote ?? ""} onChange={(e) => set({ invoiceHeaderNote: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field id="inv-footer" label="Footer" hint="e.g. bank details."><Textarea id="inv-footer" rows={2} value={d.invoiceFooter ?? ""} onChange={(e) => set({ invoiceFooter: e.target.value })} /></Field></div>
          </div>
          <div className="mt-4 space-y-2">
            {check("showLogoOnInvoice", "Show the logo")}
            {check("showRegistrationOnInvoice", "Show the business registration number")}
            {check("showTaxNumberOnInvoice", "Show the tax registration number")}
          </div>
        </Card>
        <Card title="PDF and email" description="Settings for the backend. In this demo no PDF is created and no email is sent.">
          <div className="space-y-2">
            {check("attachInvoicePdf", "Attach the PDF to invoice emails")}
            {check("emailInvoiceOnIssue", "Email the customer when an invoice is issued")}
          </div>
        </Card>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={form.pending}>{form.pending ? "Saving…" : "Save changes"}</Button>
          <p role="status" className={Object.keys(form.errors).length ? "text-sm text-danger" : "text-sm text-muted"}>{form.status}</p>
        </div>
      </form>
      <section aria-label="Template preview" className="min-w-0 space-y-3">
        <h2 className="font-semibold">Template preview</h2>
        <Notice>This is the browser view. Printing it is not a server-generated PDF; the backend will create and store real PDF files.</Notice>
        {sample ? <InvoiceDocument draft={sample} store={store} settings={form.draft} /> : <p className="text-sm text-muted">No sample order to preview.</p>}
      </section>
    </div>
  );
}
