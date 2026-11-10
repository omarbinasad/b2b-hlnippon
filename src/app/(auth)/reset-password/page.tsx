import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { param } from "@/lib/list-params";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const token = param(await searchParams, "token") || undefined;
  return (
    <>
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      <ResetPasswordForm token={token} />
    </>
  );
}
