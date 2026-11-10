import type { Metadata } from "next";
import { HomepageBuilder } from "@/components/admin/content/homepage-builder";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Homepage builder" };

export default async function HomepageBuilderPage() {
  const content = await repositories.siteContent.get();
  return (
    <>
      <PageHeader title="Homepage builder" description="What the homepage and About page show, and in what order." />
      <HomepageBuilder content={content} />
      <div className="mt-6"><DemoEditingNotice images /></div>
    </>
  );
}
