"use client";

import { useCan } from "@/components/admin/capabilities-context";
import { useState, useTransition } from "react";
import { createCustomerAction } from "@/app/admin/customers/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { accountStatusHelp, accountStatusLabels } from "@/lib/customers/status";
import type { CustomerGroup, FieldErrors } from "@/lib/types";

/** Essentials only — addresses, business details and route can be completed later. */
export function QuickCustomerForm({ groups }: { groups: CustomerGroup[] }) {
  const can = useCan();
  const [values, setValues] = useState({ companyName: "", contactName: "", phone: "", email: "", status: "pending" as "pending" | "approved", groupId: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const described = (id: string, hint = false) => (errors[id] ? `qc-${id}-error` : hint ? `qc-${id}-hint` : undefined);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await createCustomerAction(values);
          if (!result) return; // redirected to the new customer
          if (!result.ok) {
            setErrors(result.errors);
            setMessage(result.message);
          }
        });
      }}
      className="space-y-5"
    >
      <Field id="qc-companyName" label="Business name" required error={errors.companyName}>
        <Input id="qc-companyName" value={values.companyName} onChange={set("companyName")} maxLength={120} autoComplete="organization" aria-invalid={Boolean(errors.companyName)} aria-describedby={described("companyName")} />
      </Field>
      <Field id="qc-contactName" label="Contact person" error={errors.contactName}>
        <Input id="qc-contactName" value={values.contactName} onChange={set("contactName")} maxLength={200} autoComplete="name" />
      </Field>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">
          Phone or email <span className="text-danger" aria-hidden>*</span>
        </legend>
        <p className="text-xs text-muted">At least one is required so staff can reach the customer.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="qc-phone" label="Phone" error={errors.phone} hint="e.g. 090-1234-5678">
            <Input id="qc-phone" type="tel" inputMode="tel" value={values.phone} onChange={set("phone")} maxLength={20} autoComplete="tel" aria-invalid={Boolean(errors.phone)} aria-describedby={described("phone", true)} />
          </Field>
          <Field id="qc-email" label="Email" error={errors.email}>
            <Input id="qc-email" type="email" value={values.email} onChange={set("email")} maxLength={200} autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={described("email")} />
          </Field>
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-medium">
          Initial approval status <span className="text-danger" aria-hidden>*</span>
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(["pending", "approved"] as const).map((s) => (
            <label key={s} className="flex cursor-pointer gap-3 rounded-ui border border-line p-3 has-checked:border-brand has-checked:bg-brand-soft">
              <input type="radio" name="qc-status" value={s} disabled={s === "approved" && !can("customer_approval.approve")} checked={values.status === s} onChange={() => setValues((v) => ({ ...v, status: s }))} className="mt-0.5 accent-brand" />
              <span>
                <span className="block text-sm font-medium">{accountStatusLabels[s]}</span>
                <span className="block text-xs text-muted">{accountStatusHelp[s]}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.status && <p className="mt-1 text-xs text-danger">{errors.status}</p>}
      </fieldset>
      <Field id="qc-groupId" label="Customer group" hint="Optional. Groups will drive future price and quantity rules." error={errors.groupId}>
        <Select id="qc-groupId" value={values.groupId} onChange={set("groupId")} aria-describedby={described("groupId", true)}>
          <option value="">No group</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </Select>
      </Field>
      <p role="alert" className="text-sm text-danger">{message}</p>
      <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add customer"}</Button>
    </form>
  );
}
