import type { Metadata } from "next";
import { PlannedFeatures } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <>
      <PageHeader
        title="About us"
        description="Who we are, what we supply and the businesses we serve across Japan."
      />
      <PlannedFeatures items={["Company story and sourcing", "Certifications and quality standards", "Service areas and delivery coverage"]} />
    </>
  );
}
