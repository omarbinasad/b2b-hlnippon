import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlockForm } from "@/components/admin/content/block-form";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { blockKindLabel } from "@/lib/content/blocks";
import { repositories } from "@/lib/data";
import { humanize } from "@/lib/format";

export const metadata: Metadata = { title: "Edit block" };

export default async function EditBlockPage({ params }: PageProps<"/admin/blocks/[id]">) {
  const { id } = await params;
  const [block, usage] = await Promise.all([repositories.blocks.getById(id), repositories.blocks.usage(id)]);
  if (!block) notFound();
  return (
    <>
      <Link href="/admin/blocks" className="text-sm text-muted hover:text-foreground">← All blocks</Link>
      <PageHeader title={block.name} description={`${blockKindLabel(block.kind)} · by ${block.authorName}`} />
      <BlockForm block={block} usedBy={usage.length} />
      <div className="mt-6">
        <Card title="Where it's used" description="Pages and posts outside the trash that contain this block.">
          {usage.length ? (
            <ul className="divide-y divide-line text-sm">
              {usage.map((u) => (
                <li key={`${u.kind}-${u.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/admin/${u.kind}s/${u.id}` as Route} className="font-medium text-brand hover:underline">{u.title}</Link>
                  <span className="text-muted">{u.kind === "page" ? "Page" : "Post"} · {humanize(u.status)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Not used yet. Insert it from the editor of any page or post with the “Block” button.</p>
          )}
        </Card>
      </div>
      <div className="mt-6"><DemoEditingNotice /></div>
    </>
  );
}
