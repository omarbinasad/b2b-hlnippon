"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { deleteCampaignAction, deleteRouteAction, previewTemplateAction, resetTemplateAction, retryEmailAction, saveCampaignAction, saveRouteAction, saveSenderAction, saveTemplateAction, simulateCampaignAction } from "@/app/admin/notify-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { addressLabels, regionNames } from "@/lib/locations";
import type { DeliveryRoute, EmailSenderSettings, EmailTemplate, EmailTemplateKey, FieldErrors, ReminderCampaign, Weekday } from "@/lib/types";

const DAYS: [Weekday, string][] = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]];

function DateList({ id, label, hint, value, onChange }: { id: string; label: string; hint: string; value: string[]; onChange: (v: string[]) => void }) {
  const [date, setDate] = useState("");
  return (
    <fieldset>
      <legend className="text-sm font-medium">{label}</legend>
      <p className="text-xs text-muted">{hint}</p>
      <div className="mt-2 flex gap-2">
        <div className="min-w-0 flex-1"><Input id={id} aria-label={`Add to ${label.toLowerCase()}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <Button variant="secondary" disabled={!date} onClick={() => { if (!value.includes(date)) onChange([...value, date].sort()); setDate(""); }}>Add</Button>
      </div>
      {value.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {value.map((d) => <li key={d} className="flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1 text-xs">{d}<button type="button" aria-label={`Remove ${d}`} className="text-muted hover:text-danger" onClick={() => onChange(value.filter((x) => x !== d))}><Icon name="close" className="size-3.5" /></button></li>)}
        </ul>
      )}
    </fieldset>
  );
}

export function RouteForm({ route }: { route?: DeliveryRoute }) {
  const router = useRouter();
  const [name, setName] = useState(route?.name ?? "");
  const [areas, setAreas] = useState<string[]>(route?.areas ?? []);
  const [area, setArea] = useState("");
  const [days, setDays] = useState<Weekday[]>(route?.deliveryDays ?? []);
  const [cutoff, setCutoff] = useState(route?.cutoffTime ?? "16:00");
  const [excluded, setExcluded] = useState(route?.excludedDates ?? []);
  const [extra, setExtra] = useState(route?.extraDates ?? []);
  const [active, setActive] = useState(route?.active ?? true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const addArea = (v: string) => { const a = v.trim(); if (a && !areas.includes(a)) setAreas([...areas, a]); setArea(""); };
  const regions = regionNames().filter((r) => !areas.includes(r));
  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveRouteAction(route?.id ?? null, { name, areas, deliveryDays: days, cutoffTime: cutoff, excludedDates: excluded, extraDates: extra, active });
          if (!r.ok) {
            setErrors(r.errors);
            setMessage(r.message);
            return;
          }
          setErrors({});
          setMessage("Saved to the demo store.");
          if (!route) router.replace(`/admin/delivery/${r.value.id}`);
          else router.refresh();
        });
      }}
    >
      <Card title="Delivery area">
        <div className="space-y-4">
          <Field id="rt-name" label="Name" required error={errors.name}><Input id="rt-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "rt-name-error" : undefined} /></Field>
          <fieldset>
            <legend className="text-sm font-medium">Areas served</legend>
            <p className="text-xs text-muted">A {addressLabels().region.toLowerCase()} or city. Customers are matched by their delivery addresses.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {regions.length > 0 && (
                <div className="min-w-48 flex-1">
                  <Select aria-label="Add a region" value="" onChange={(e) => addArea(e.target.value)}>
                    <option value="">Add a {addressLabels().region.toLowerCase()}…</option>
                    {regions.map((r) => <option key={r} value={r}>{r}</option>)}
                  </Select>
                </div>
              )}
              <div className="flex min-w-48 flex-1 gap-2">
                <div className="min-w-0 flex-1"><Input aria-label="Add a city or area" placeholder="Or type a city" value={area} onChange={(e) => setArea(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addArea(area); } }} /></div>
                <Button variant="secondary" disabled={!area.trim()} onClick={() => addArea(area)}>Add</Button>
              </div>
            </div>
            {areas.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {areas.map((a) => <li key={a} className="flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1 text-xs">{a}<button type="button" aria-label={`Remove ${a}`} className="text-muted hover:text-danger" onClick={() => setAreas(areas.filter((x) => x !== a))}><Icon name="close" className="size-3.5" /></button></li>)}
              </ul>
            )}
            {errors.areas && <p className="mt-1 text-sm text-danger">{errors.areas}</p>}
          </fieldset>
        </div>
      </Card>
      <Card title="Schedule" description="Shipping charges are managed separately under Shipping.">
        <div className="space-y-4">
          <fieldset>
            <legend className="text-sm font-medium">Delivery days</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {DAYS.map(([d, label]) => <label key={d} className="flex items-center gap-1.5 text-sm"><input type="checkbox" className="size-4 accent-brand" checked={days.includes(d)} onChange={(e) => setDays(e.target.checked ? [...days, d] : days.filter((x) => x !== d))} /> {label}</label>)}
            </div>
            {errors.deliveryDays && <p className="mt-1 text-sm text-danger">{errors.deliveryDays}</p>}
          </fieldset>
          <div className="max-w-xs"><Field id="rt-cutoff" label="Order cut-off" required error={errors.cutoffTime} hint="The day before delivery, store time."><Input id="rt-cutoff" type="time" value={cutoff} onChange={(e) => setCutoff(e.target.value)} aria-invalid={Boolean(errors.cutoffTime)} /></Field></div>
          <div className="grid gap-4 md:grid-cols-2">
            <DateList id="rt-extra" label="Extra dates" hint="Delivery on these dates even if not a regular day." value={extra} onChange={setExtra} />
            <DateList id="rt-excluded" label="Holidays and excluded dates" hint="No delivery on these dates." value={excluded} onChange={setExcluded} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-brand" checked={active} onChange={(e) => setActive(e.target.checked)} /> Schedule is active</label>
        </div>
      </Card>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save schedule"}</Button>
        {route && <Button variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => setConfirming(true)}>Delete</Button>}
        <p role="status" className={Object.keys(errors).length ? "text-sm text-danger" : "text-sm text-muted"}>{message}</p>
      </div>
      <Dialog open={confirming} onClose={() => setConfirming(false)} title={`Delete "${name}"?`} description="Customers in these areas will have no delivery dates. To pause it, untick active instead.">
        {errors.delete && <p role="alert" className="mb-3 text-sm text-danger">{errors.delete}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(false)}>Keep it</Button>
          <Button variant="danger" disabled={pending} onClick={() => start(async () => { if (!route) return; const r = await deleteRouteAction(route.id); if (!r.ok) return setErrors({ delete: r.message }); router.push("/admin/delivery"); })}>Delete</Button>
        </div>
      </Dialog>
    </form>
  );
}

export function CampaignForm({ campaign, routes, templates }: { campaign?: ReminderCampaign; routes: { id: string; name: string }[]; templates: { key: EmailTemplateKey; name: string }[] }) {
  const router = useRouter();
  const [v, setV] = useState({
    name: campaign?.name ?? "",
    deliveryRouteId: campaign?.deliveryRouteId ?? "",
    leadDays: String(campaign?.leadDays ?? 1),
    sendTime: campaign?.sendTime ?? "09:00",
    enabled: campaign?.enabled ?? true,
    templateWithOrder: campaign?.templateWithOrder ?? ("reminder_with_order" as EmailTemplateKey),
    templateWithoutOrder: campaign?.templateWithoutOrder ?? ("reminder_without_order" as EmailTemplateKey),
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveCampaignAction(campaign?.id ?? null, v);
          if (!r.ok) {
            setErrors(r.errors);
            setMessage(r.message);
            return;
          }
          setErrors({});
          setMessage("Saved to the demo store.");
          if (!campaign) router.replace(`/admin/reminders/${r.value.id}`);
          else router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field id="cm-name" label="Campaign name" required error={errors.name}><Input id="cm-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "cm-name-error" : undefined} /></Field></div>
        <Field id="cm-route" label="Delivery schedule" required error={errors.deliveryRouteId}>
          <Select id="cm-route" value={v.deliveryRouteId} onChange={(e) => setV({ ...v, deliveryRouteId: e.target.value })} aria-invalid={Boolean(errors.deliveryRouteId)}>
            <option value="">Choose…</option>
            {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="cm-lead" label="Days before delivery" error={errors.leadDays}><Input id="cm-lead" type="number" min={0} max={14} value={v.leadDays} onChange={(e) => setV({ ...v, leadDays: e.target.value })} aria-invalid={Boolean(errors.leadDays)} /></Field>
          <Field id="cm-time" label="Send at" error={errors.sendTime}><Input id="cm-time" type="time" value={v.sendTime} onChange={(e) => setV({ ...v, sendTime: e.target.value })} aria-invalid={Boolean(errors.sendTime)} /></Field>
        </div>
        <Field id="cm-tpl-a" label="Email for customers with an order"><Select id="cm-tpl-a" value={v.templateWithOrder} onChange={(e) => setV({ ...v, templateWithOrder: e.target.value as EmailTemplateKey })}>{templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}</Select></Field>
        <Field id="cm-tpl-b" label="Email for customers without an order"><Select id="cm-tpl-b" value={v.templateWithoutOrder} onChange={(e) => setV({ ...v, templateWithoutOrder: e.target.value as EmailTemplateKey })}>{templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}</Select></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-brand" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} /> Enabled</label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save campaign"}</Button>
        {campaign && <Button variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => setConfirming(true)}>Delete</Button>}
        <p role="status" className={Object.keys(errors).length ? "text-sm text-danger" : "text-sm text-muted"}>{message}</p>
      </div>
      <Dialog open={confirming} onClose={() => setConfirming(false)} title={`Delete "${v.name}"?`}>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(false)}>Keep it</Button>
          <Button variant="danger" disabled={pending} onClick={() => start(async () => { if (campaign) await deleteCampaignAction(campaign.id); router.push("/admin/reminders"); })}>Delete</Button>
        </div>
      </Dialog>
    </form>
  );
}

export function SimulateButton({ id }: { id: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await simulateCampaignAction(id);
            setMessage(r.ok ? `Simulated: ${r.value.created} logged, ${r.value.skipped} skipped as already logged for this date. No email was sent.` : r.message);
            router.refresh();
          })
        }
      >
        {pending ? "Simulating…" : "Simulate this run"}
      </Button>
      <p role="status" className="text-sm text-muted">{message}</p>
    </div>
  );
}

export function TemplateForm({ template }: { template: EmailTemplate }) {
  const router = useRouter();
  const [v, setV] = useState({ enabled: template.enabled, subject: template.subject, bodyHtml: template.bodyHtml, attachInvoice: template.attachInvoice });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewTemplateAction>>>(null);
  const [pending, start] = useTransition();
  const { subject, bodyHtml } = v;
  useEffect(() => {
    let live = true;
    previewTemplateAction(template.key, { subject, bodyHtml }).then((p) => { if (live) setPreview(p); });
    return () => { live = false; };
  }, [template.key, subject, bodyHtml]);
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <form
        noValidate
        className="min-w-0 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveTemplateAction(template.key, v);
            setErrors(r.ok ? {} : r.errors);
            setMessage(r.ok ? "Saved to the demo store." : r.message);
            if (r.ok) router.refresh();
          });
        }}
      >
        <Card title="Template" description={`Sent when: ${template.trigger}.`}>
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-brand" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} /> Enabled</label>
            <Field id="em-subject" label="Subject" required error={errors.subject}><Input id="em-subject" value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} aria-invalid={Boolean(errors.subject)} aria-describedby={errors.subject ? "em-subject-error" : undefined} /></Field>
            <Field id="em-body" label="Message" required error={errors.bodyHtml} hint="Simple HTML. Links and images are checked when the message is shown."><Textarea id="em-body" rows={9} value={v.bodyHtml} onChange={(e) => setV({ ...v, bodyHtml: e.target.value })} aria-invalid={Boolean(errors.bodyHtml)} aria-describedby={errors.bodyHtml ? "em-body-error" : "em-body-hint"} /></Field>
            {template.supportsAttachment && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-brand" checked={v.attachInvoice} onChange={(e) => setV({ ...v, attachInvoice: e.target.checked })} /> Attach the invoice PDF (backend)</label>}
            <div>
              <p className="text-sm font-medium">Placeholders</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">{template.placeholders.map((p) => <li key={p}><code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">{`{{${p}}}`}</code></li>)}</ul>
            </div>
          </div>
        </Card>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save template"}</Button>
          <Button variant="ghost" disabled={pending} onClick={() => start(async () => { await resetTemplateAction(template.key); window.location.reload(); })}>Restore default</Button>
          <p role="status" className={Object.keys(errors).length ? "text-sm text-danger" : "text-sm text-muted"}>{message}</p>
        </div>
      </form>
      <section aria-label="Email preview" className="min-w-0 space-y-3">
        <h2 className="font-semibold">Preview</h2>
        <Notice>Sample values shown. This demo never sends email.</Notice>
        <EmailPreview from={preview?.from} subject={preview?.subject ?? ""} bodyHtml={preview?.safeHtml ?? ""} footer={preview?.footer} />
      </section>
    </div>
  );
}

export function EmailPreview({ from, subject, bodyHtml, footer }: { from?: string; subject: string; bodyHtml: string; footer?: string }) {
  return (
    <div className="overflow-hidden rounded-ui border border-line bg-surface text-sm">
      <dl className="space-y-0.5 border-b border-line bg-surface-muted p-3 text-xs">
        {from && <div className="flex gap-2"><dt className="text-muted">From</dt><dd className="break-all">{from}</dd></div>}
        <div className="flex gap-2"><dt className="text-muted">Subject</dt><dd className="font-medium">{subject}</dd></div>
      </dl>
      <div className="space-y-2 p-4 [&_a]:text-brand [&_a]:underline" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      {footer && <p className="border-t border-line p-3 text-xs whitespace-pre-line text-muted">{footer}</p>}
    </div>
  );
}

export function SenderForm({ sender }: { sender: EmailSenderSettings }) {
  const router = useRouter();
  const [v, setV] = useState({ senderName: sender.senderName, senderEmail: sender.senderEmail, replyTo: sender.replyTo ?? "", footer: sender.footer ?? "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const field = (key: "senderName" | "senderEmail" | "replyTo", label: string) => (
    <Field id={`sd-${key}`} label={label} required={key !== "replyTo"} error={errors[key]}><Input id={`sd-${key}`} value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `sd-${key}-error` : undefined} /></Field>
  );
  return (
    <Card title="Sender">
      <form noValidate className="space-y-3" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveSenderAction(v); setErrors(r.ok ? {} : r.errors); setMessage(r.ok ? "Saved to the demo store." : r.message); if (r.ok) router.refresh(); }); }}>
        <div className="grid gap-3 sm:grid-cols-3">
          {field("senderName", "Sender name")}
          {field("senderEmail", "Sender email")}
          {field("replyTo", "Reply-to")}
        </div>
        <Field id="sd-footer" label="Footer"><Textarea id="sd-footer" rows={2} value={v.footer} onChange={(e) => setV({ ...v, footer: e.target.value })} /></Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary" disabled={pending}>Save sender</Button>
          <p role="status" className={Object.keys(errors).length ? "text-sm text-danger" : "text-sm text-muted"}>{message}</p>
        </div>
      </form>
    </Card>
  );
}

export function RetryButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { await retryEmailAction(id); router.refresh(); })}>Retry</Button>;
}
