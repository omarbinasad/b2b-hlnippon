"use client";

import { useTransition } from "react";
import { resetDemoCompanyAction } from "@/app/admin/settings/actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import type { CompanySettingsInput } from "@/lib/types";
import { BrandingFields, CompanyInfoFields, ContactFields, DocumentBrandingFields, LocaleFields, SaveBar, UnitFields, useCompanyDraft } from "./company-fields";

export function CompanyBrandingForm({ settings }: { settings: CompanySettingsInput }) {
  const form = useCompanyDraft(settings);
  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} className="space-y-6">
      <CompanyInfoFields form={form} />
      <BrandingFields form={form} />
      <ContactFields form={form} />
      <DocumentBrandingFields form={form} />
      <SaveBar form={form} />
    </form>
  );
}

export function GeneralSettingsForm({ settings }: { settings: CompanySettingsInput }) {
  const form = useCompanyDraft(settings);
  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} className="space-y-6">
      <LocaleFields form={form} savedCurrency={settings.locale.currencyCode} />
      <UnitFields form={form} />
      {/* The company's own address must fit the country, so it can be corrected here in the same save. */}
      {Object.keys(form.errors).some((k) => k.startsWith("contact.")) && (
        <>
          <Notice tone="warning" title="Your contact details don't fit the new country">Update the marked fields below, then save again.</Notice>
          <ContactFields form={form} />
        </>
      )}
      <SaveBar form={form} />
    </form>
  );
}

export function ResetDemoButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Restore the sample company's settings? Your changes to company, branding and locale settings will be replaced.")) return;
        start(async () => {
          await resetDemoCompanyAction();
          // A full reload, so open forms pick up the restored values.
          window.location.reload();
        });
      }}
    >
      {pending ? "Restoring…" : "Restore sample settings"}
    </Button>
  );
}
