import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Log in</h1>
      <p className="mt-1 text-sm text-muted">Access wholesale prices, ordering and your order history.</p>

      <div className="mt-5">
        <Notice tone="warning">Sign-in is not connected yet. This form is a layout preview and does not log you in.</Notice>
      </div>

      <form className="mt-5">
        <fieldset disabled className="space-y-4">
          <legend className="sr-only">Login details</legend>
          <Field id="email" label="Email">
            <Input id="email" name="email" type="email" autoComplete="email" />
          </Field>
          <Field id="password" label="Password">
            <Input id="password" name="password" type="password" autoComplete="current-password" />
          </Field>
          <Button type="submit" className="w-full">Log in (not available yet)</Button>
        </fieldset>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        No account?{" "}
        <Link href="/register" className="font-medium text-brand hover:underline">Apply for a wholesale account</Link>
      </p>
    </>
  );
}
