import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { Notice } from "@/components/ui/feedback";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/auth/demo-accounts";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Log in</h1>
      <p className="mt-1 text-sm text-muted">Access wholesale prices, ordering and your order history.</p>
      <div className="mt-5">
        <Notice tone="warning" title="Demo sign-in">
          This is not real authentication; it only switches the preview. Use one of these accounts with the password <code className="rounded bg-surface-muted px-1">{DEMO_PASSWORD}</code>:
          <ul className="mt-2 space-y-0.5">
            {DEMO_ACCOUNTS.map((a) => <li key={a.email}><code className="break-all">{a.email}</code>: {a.label}</li>)}
          </ul>
        </Notice>
      </div>
      <LoginForm />
      <p className="mt-6 text-center text-sm text-muted">
        No account? <Link href="/register" className="font-medium text-brand hover:underline">Apply for a wholesale account</Link>
      </p>
    </>
  );
}
