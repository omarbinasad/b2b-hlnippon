"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { isEmail } from "@/lib/customers/contact";
import { validateNewPassword } from "@/lib/validation/password";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  if (sent) {
    return (
      <div className="mt-5 space-y-4">
        <Notice tone="success" title="Check your email">If an account exists for that address, we&apos;d send a reset link. In this demo no email is sent.</Notice>
        <Link href="/reset-password?token=demo" className="block text-center text-sm font-medium text-brand hover:underline">Continue to the demo reset page</Link>
      </div>
    );
  }
  return (
    <form noValidate className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); if (!isEmail(email)) return setError("Enter a valid email address."); setSent(true); }}>
      <Field id="forgot-email" label="Email" required error={error}>
        <Input id="forgot-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? "forgot-email-error" : undefined} />
      </Field>
      <Button type="submit" className="w-full">Send reset link</Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token?: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  if (!token) return <div className="mt-5"><Notice tone="warning" title="This link isn't valid">Ask for a new reset link. <Link href="/forgot-password" className="font-medium underline">Request one</Link></Notice></div>;
  if (done) return <div className="mt-5 space-y-4"><Notice tone="success" title="Password form accepted">In this demo no password is stored. The backend will save it.</Notice><Link href="/login" className="block text-center text-sm font-medium text-brand hover:underline">Back to log in</Link></div>;
  return (
    <form noValidate className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); const r = validateNewPassword(password, confirm); setErrors(r); if (!Object.keys(r).length) setDone(true); }}>
      <Field id="reset-password" label="New password" required error={errors.password} hint="At least 8 characters.">
        <Input id="reset-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={Boolean(errors.password)} />
      </Field>
      <Field id="reset-confirm" label="Confirm password" required error={errors.confirm}>
        <Input id="reset-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={Boolean(errors.confirm)} />
      </Field>
      <Button type="submit" className="w-full">Set new password</Button>
    </form>
  );
}
