"use client";

import { useState, useTransition } from "react";
import { savePaymentMethodAction } from "@/app/admin/payments/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { PAYMENT_LIMITS } from "@/lib/payments/methods";
import type { FieldErrors, PaymentMethodSettings } from "@/lib/types";

/** Customer-facing texts, enable switch and (bank transfer) account details. Never any secrets. */
export function PaymentMethodForm({ method }: { method: PaymentMethodSettings }) {
  const [enabled, setEnabled] = useState(method.enabled);
  const [title, setTitle] = useState(method.title);
  const [description, setDescription] = useState(method.description);
  const [instructions, setInstructions] = useState(method.instructions);
  const [bank, setBank] = useState({
    accountName: method.bank?.accountName ?? "",
    bankName: method.bank?.bankName ?? "",
    accountNumber: method.bank?.accountNumber ?? "",
    branchName: method.bank?.branchName ?? "",
    routingNumber: method.bank?.routingNumber ?? "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const isBank = method.id === "bank_transfer";
  const isOnline = method.id === "online";

  const described = (id: string, key: string, hint = false) => (errors[key] ? `${id}-error` : hint ? `${id}-hint` : undefined);
  const bankField = (key: keyof typeof bank, label: string, opts: { required?: boolean; hint?: string; inputMode?: "numeric" } = {}) => {
    const id = `pm-bank-${key}`;
    const k = `bank.${key}`;
    return (
      <Field id={id} label={label} required={opts.required} hint={opts.hint} error={errors[k]}>
        <Input id={id} value={bank[key]} onChange={(e) => setBank({ ...bank, [key]: e.target.value })} inputMode={opts.inputMode} autoComplete="off" aria-invalid={Boolean(errors[k])} aria-describedby={described(id, k, Boolean(opts.hint))} />
      </Field>
    );
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await savePaymentMethodAction(method.id, { enabled, title, description, instructions, bank: isBank ? bank : undefined });
          if (!result) return; // saved → redirected
          if (!result.ok) {
            setErrors(result.errors);
            setMessage(result.message);
          }
        });
      }}
      className="space-y-6"
    >
      <Card title="Availability">
        <label className="flex items-start gap-3 rounded-ui border border-line p-3 has-checked:border-brand has-checked:bg-brand-soft">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="mt-0.5 size-4 accent-brand" />
          <span>
            <span className="block text-sm font-medium">Enabled</span>
            <span className="block text-xs text-muted">
              {isOnline
                ? "Even when enabled, online payment stays unavailable at checkout until a payment provider is connected on the backend."
                : isBank
                  ? "Bank transfer is offered at checkout only when enabled and the account name, bank and account number are filled in."
                  : "Offered at checkout when enabled."}
            </span>
          </span>
        </label>
      </Card>

      <Card title="What customers see">
        <div className="space-y-4">
          <Field id="pm-title" label="Title" required error={errors.title} hint="Shown as the option name at checkout.">
            <Input id="pm-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={PAYMENT_LIMITS.title} aria-invalid={Boolean(errors.title)} aria-describedby={described("pm-title", "title", true)} />
          </Field>
          <Field id="pm-description" label="Short description" error={errors.description} hint="One line next to the option.">
            <Input id="pm-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={PAYMENT_LIMITS.description} aria-invalid={Boolean(errors.description)} aria-describedby={described("pm-description", "description", true)} />
          </Field>
          <Field id="pm-instructions" label="Instructions" error={errors.instructions} hint="Shown after the customer chooses this method and on their order.">
            <Textarea id="pm-instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={PAYMENT_LIMITS.instructions} aria-invalid={Boolean(errors.instructions)} aria-describedby={described("pm-instructions", "instructions", true)} />
          </Field>
        </div>
      </Card>

      {isBank && (
        <Card title="Bank account details" description="Shown to customers who choose bank transfer. Use fictional values in this demo — never real account data.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">{bankField("accountName", "Account name", { required: enabled })}</div>
            {bankField("bankName", "Bank name", { required: enabled })}
            {bankField("branchName", "Branch")}
            {bankField("accountNumber", "Account number", { required: enabled, inputMode: "numeric", hint: "6–30 digits; spaces and dashes allowed." })}
            {bankField("routingNumber", "Routing number", { inputMode: "numeric", hint: "Optional, 9 digits." })}
          </div>
        </Card>
      )}

      {isOnline && (
        <Card title="Payment provider">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-ui border border-line bg-surface-muted p-3">
            <div>
              <p className="text-sm font-medium">{method.online?.status === "connected" ? `Connected${method.online.providerName ? `: ${method.online.providerName}` : ""}` : "Not connected"}</p>
              <p className="text-xs text-muted">
                Connecting a provider needs a backend integration. Credentials (API keys, secrets) will be stored only on the server — never entered here, in client code or in browser storage.
              </p>
            </div>
            <Button variant="secondary" disabled aria-describedby="pm-connect-note">Connect provider</Button>
          </div>
          <p id="pm-connect-note" className="mt-2 text-xs text-muted">Unavailable in this demo.</p>
        </Card>
      )}

      <p role="alert" className="text-sm text-danger">{message}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <ButtonLink href="/admin/payments" variant="secondary">Cancel</ButtonLink>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save payment method"}</Button>
      </div>
    </form>
  );
}
