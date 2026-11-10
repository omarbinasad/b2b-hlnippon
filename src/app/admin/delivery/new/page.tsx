import type { Metadata } from "next";
import Link from "next/link";
import { RouteForm } from "@/components/admin/notify/forms";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Add delivery schedule" };

export default function NewSchedulePage() {
  return (
    <>
      <Link href="/admin/delivery" className="text-sm text-muted hover:text-foreground">← All schedules</Link>
      <PageHeader title="Add delivery schedule" />
      <RouteForm />
    </>
  );
}
