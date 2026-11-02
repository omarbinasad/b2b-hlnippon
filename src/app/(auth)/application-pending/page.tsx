import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Application pending", robots: { index: false } };

export default function ApplicationPendingPage() {
  return (
    <div className="text-center">
      <h1 className="text-xl font-semibold">Your application is under review</h1>
      <p className="mt-2 text-sm text-muted">
        Thank you for applying. We will email you once your account has been approved. Until then you can browse the
        catalog, but wholesale prices and ordering stay hidden.
      </p>
      <p className="mt-4 text-sm text-muted">
        Questions? Contact {siteConfig.contact.email}.
      </p>
      <ButtonLink href="/shop" variant="secondary" className="mt-6">
        Browse the catalog
      </ButtonLink>
    </div>
  );
}
