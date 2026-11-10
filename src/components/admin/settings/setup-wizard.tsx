"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { completeSetupAction } from "@/app/admin/settings/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { setupChecklist, type SetupFacts } from "@/lib/company/setup-checklist";
import { cx } from "@/lib/cx";
import type { CompanySettings, FieldErrors } from "@/lib/types";
import { BrandingFields, CompanyInfoFields, ContactFields, LocaleFields, UnitFields, useCompanyDraft } from "./company-fields";

const REVIEW = "Final review";
const HELP: Record<string, string> = {
  shipping: "Decide where you deliver and what it costs. Zones match customers' addresses to delivery rates.",
  tax: "Tax stays off until you turn it on. Sample rates are fictional, so enter the rates that apply to your business.",
  payments: "Choose how customers pay. No payment is processed by this frontend.",
  b2b: "Customers apply for an account and see wholesale prices once approved. Groups and rules set who pays what.",
  content: "Replace the sample pages, homepage text and journal with your own. Sample policies need a legal review.",
};
const CTA: Record<string, string> = { shipping: "Manage shipping", tax: "Manage tax", payments: "Manage payment methods", b2b: "Manage customer groups", content: "Manage pages" };

/** First step showing a field with an error. */
function stepOf(errors: FieldErrors) {
  const keys = Object.keys(errors);
  if (keys.some((k) => !k.includes(".") || k.startsWith("contact."))) return 0;
  if (keys.some((k) => k.startsWith("branding."))) return 1;
  if (keys.some((k) => k === "locale.weightUnit" || k === "locale.dimensionUnit")) return 3;
  return 2;
}

export function SetupWizard({ settings, facts }: { settings: CompanySettings; facts: SetupFacts }) {
  const form = useCompanyDraft(settings);
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [finishing, startFinish] = useTransition();
  const { draft: v } = form;
  const checklist = setupChecklist({ ...settings, ...v }, facts);
  const titles = [...checklist.map((c) => c.title), REVIEW];
  const open = checklist.filter((c) => !c.done);
  const saves = step <= 3;
  const current = checklist[step];

  const go = (to: number) => {
    setDone(false);
    setStep(to);
    window.scrollTo({ top: 0 });
  };
  const next = () => {
    if (!saves) return go(step + 1);
    form.save(() => go(step + 1), (e) => setStep(stepOf(e)));
  };
  const finish = () =>
    startFinish(async () => {
      const r = await completeSetupAction();
      if (r.ok) {
        setDone(true);
        router.refresh();
      }
    });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <ol aria-label="Setup steps" className="scrollbar-none relative flex min-w-0 gap-1 overflow-x-auto lg:flex-col">
        {titles.map((title, i) => {
          const item = checklist[i];
          return (
            <li key={title} className="shrink-0">
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={i === step ? "step" : undefined}
                className={cx("flex w-full items-center gap-2 rounded-ui px-3 py-2 text-left text-sm", i === step ? "bg-brand-soft font-medium text-brand" : "text-muted hover:bg-surface-muted hover:text-foreground")}
              >
                <span className={cx("grid size-6 shrink-0 place-items-center rounded-full border text-xs", item?.done ? "border-success bg-success-soft text-success" : item ? "border-warning bg-warning-soft text-warning" : "border-line")}>
                  {item?.done ? <Icon name="check" className="size-3.5" /> : i + 1}
                  <span className="sr-only">{item ? (item.done ? " finished" : " needs attention") : ""}</span>
                </span>
                <span className="whitespace-nowrap lg:whitespace-normal">{title}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <form noValidate onSubmit={(e) => { e.preventDefault(); next(); }} className="min-w-0 space-y-6">
        <h2 className="text-lg font-semibold">Step {step + 1} of {titles.length}: {titles[step]}</h2>
        {Object.keys(form.errors).length > 0 && <Notice tone="warning" title="Some fields need attention">Fix the marked fields to continue. Your other steps are kept.</Notice>}
        {current && <Notice tone={current.done ? "success" : "warning"} title={current.done ? "Looks finished" : "Needs attention"}>{current.detail}</Notice>}

        {step === 0 && (<><CompanyInfoFields form={form} /><ContactFields form={form} /></>)}
        {step === 1 && <BrandingFields form={form} />}
        {step === 2 && <LocaleFields form={form} savedCurrency={settings.locale.currencyCode} />}
        {step === 3 && <UnitFields form={form} />}
        {step > 3 && current?.href && (
          <Card>
            <p className="text-sm text-muted">{HELP[current.key]}</p>
            <Link href={current.href as Route} target="_blank" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">{CTA[current.key]} <span aria-hidden>↗</span><span className="sr-only">(opens in a new tab)</span></Link>
          </Card>
        )}
        {step === checklist.length && (
          <Card title={v.companyName}>
            {open.length > 0 ? (
              <>
                <p className="text-sm font-medium">{open.length} of {checklist.length} steps still need attention:</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {open.map((c) => (
                    <li key={c.key} className="flex flex-wrap gap-x-2">
                      <button type="button" onClick={() => go(checklist.indexOf(c))} className="font-medium text-brand hover:underline">{c.title}</button>
                      <span className="text-muted">{c.detail}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : <p className="text-sm">All {checklist.length} steps look finished.</p>}
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Store name</dt><dd>{v.storeName}</dd></div>
              <div><dt className="text-muted">Contact</dt><dd className="break-all">{v.contact.email} · {v.contact.phone}</dd></div>
              <div><dt className="text-muted">Country and currency</dt><dd>{v.locale.country} · {v.locale.currencyCode} ({v.locale.currencySymbol})</dd></div>
              <div><dt className="text-muted">Time zone</dt><dd>{v.locale.timeZone}</dd></div>
            </dl>
            {settings.setup.completedAt && !done && <p className="mt-4 text-sm text-muted">Setup has been finished before. You can finish again after changing anything.</p>}
            {done && <div className="mt-4"><Notice tone="success" title="Setup finished">Saved to the demo store. Nothing is live until the backend is connected.</Notice></div>}
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {step > 0 && <Button variant="secondary" onClick={() => go(step - 1)}>Back</Button>}
          {step < titles.length - 1 ? (
            <Button type="submit" disabled={form.pending}>{form.pending ? "Saving…" : saves ? "Save and continue" : "Continue"}</Button>
          ) : (
            <Button disabled={finishing} onClick={finish}>{finishing ? "Finishing…" : "Finish setup"}</Button>
          )}
        </div>
      </form>
    </div>
  );
}
