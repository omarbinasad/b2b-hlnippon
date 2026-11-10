"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changePasswordAction, updateProfileAction } from "@/app/account/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import type { CustomerProfileInput, FieldErrors } from "@/lib/types";

export function ProfileForm({ initial }: { initial: CustomerProfileInput }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState("");
  const [pending, start] = useTransition();
  const field = (key: "companyName" | "contactName" | "email" | "phone", label: string, type = "text") => (
    <Field id={`profile-${key}`} label={label} required error={errors[key]}>
      <Input id={`profile-${key}`} type={type} value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `profile-${key}-error` : undefined} />
    </Field>
  );
  return (
    <Card title="Business and contact details">
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await updateProfileAction(v);
            setErrors(r.ok ? {} : r.errors);
            setStatus(r.ok ? "Saved to the demo store." : r.message);
            if (r.ok) router.refresh();
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {field("companyName", "Business name")}
          {field("contactName", "Contact name")}
          {field("email", "Email", "email")}
          {field("phone", "Phone", "tel")}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-brand" checked={!v.remindersOptOut} onChange={(e) => setV({ ...v, remindersOptOut: !e.target.checked })} /> Send me delivery reminders by email</label>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save details"}</Button>
          <p role="status" className={Object.keys(errors).length ? "text-sm text-danger" : "text-sm text-muted"}>{status}</p>
        </div>
      </form>
    </Card>
  );
}

export function PasswordForm() {
  const [v, setV] = useState({ current: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState("");
  const [pending, start] = useTransition();
  const field = (key: keyof typeof v, label: string, autoComplete: string) => (
    <Field id={`pw-${key}`} label={label} required error={errors[key]}>
      <Input id={`pw-${key}`} type="password" autoComplete={autoComplete} value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `pw-${key}-error` : undefined} />
    </Field>
  );
  return (
    <Card title="Password" description="Demo: this checks the form only. No password is stored.">
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await changePasswordAction(v);
            setErrors(r.ok ? {} : r.errors);
            setStatus(r.ok ? "Accepted. The backend will save it once sign-in is connected." : r.message);
            if (r.ok) setV({ current: "", password: "", confirm: "" });
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {field("current", "Current password", "current-password")}
          {field("password", "New password", "new-password")}
          {field("confirm", "Confirm new password", "new-password")}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary" disabled={pending}>Change password</Button>
          <p role="status" className={Object.keys(errors).length ? "text-sm text-danger" : "text-sm text-muted"}>{status}</p>
        </div>
      </form>
    </Card>
  );
}
