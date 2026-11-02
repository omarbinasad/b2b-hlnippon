import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { Notice } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Apply for a wholesale account" };

export default function RegisterPage() {
  return (
    // data-wide: the auth layout widens its card for this longer form.
    <div data-wide>
      <h1 className="text-xl font-semibold">Apply for a wholesale account</h1>
      <p className="mt-1 text-sm text-muted">
        Tell us about your business. We review each application before enabling wholesale prices and ordering.
      </p>

      <div className="mt-5">
        <Notice tone="warning">
          Demo: your application is saved on this demo server only (it appears under Admin → Customers as pending and
          is lost when the server restarts). No login or password is created yet. Don&apos;t upload real ID documents
          to this demo — the admin area has no login yet.
        </Notice>
      </div>

      <RegisterForm />

      <p className="mt-6 text-center text-sm text-muted">
        Already approved?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">Log in</Link>
      </p>
    </div>
  );
}
