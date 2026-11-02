"use client";

import { Button } from "@/components/ui/button";

/** Opens the browser's print dialog (print or save as PDF). Only the `data-invoice` element prints. */
export function PrintButton({ label = "Print / save as PDF" }: { label?: string }) {
  return (
    <Button variant="secondary" size="sm" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
