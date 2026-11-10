"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Shown when this area fails to render. Details stay in the server log. */
export default function AccountError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg rounded-ui border border-line bg-surface p-6 text-center">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">This page couldn&apos;t load. Try again, or come back in a moment.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Link href="/account" className="inline-flex h-10 items-center rounded-ui border border-line px-4 text-sm font-medium hover:bg-surface-muted">Back to my account</Link>
      </div>
    </div>
  );
}
