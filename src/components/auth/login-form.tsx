"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { demoLoginAction } from "@/app/demo-view-actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      noValidate
      className="mt-5 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await demoLoginAction(email, password);
          if (r) setError(r.message);
        });
      }}
    >
      <Field id="email" label="Email" required>
        <Input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field id="password" label="Password" required>
        <Input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end"><Link href="/forgot-password" className="text-sm font-medium text-brand hover:underline">Forgot your password?</Link></div>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Logging in…" : "Log in"}</Button>
    </form>
  );
}
