import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Forgot your password?</h1>
      <p className="mt-1 text-sm text-muted">Enter your email and we&apos;ll send a link to reset it.</p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm"><Link href="/login" className="font-medium text-brand hover:underline">Back to log in</Link></p>
    </>
  );
}
