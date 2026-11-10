"use client";

import { useCan } from "@/components/admin/capabilities-context";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { contentRowAction } from "@/app/admin/content-actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

const linkClass = "text-sm font-medium text-brand hover:underline";

export function ContentRowActions({ kind, id, title, trashed, viewHref, editHref }: { kind: "page" | "post"; id: string; title: string; trashed: boolean; viewHref?: string; editHref: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const canDelete = useCan()(kind === "page" ? "pages.delete" : "posts.delete");
  const run = (action: "trash" | "restore" | "delete") =>
    start(async () => {
      await contentRowAction(kind, id, action);
      setConfirming(false);
      router.refresh();
    });

  if (trashed) {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        {canDelete && <Button size="sm" variant="secondary" disabled={pending} onClick={() => run("restore")}>Restore</Button>}
        {canDelete && <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" disabled={pending} onClick={() => setConfirming(true)}>Delete forever</Button>}
        <Dialog open={confirming} onClose={() => setConfirming(false)} title={`Delete "${title}" forever?`} description="This can't be undone.">
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)}>Keep it</Button>
            <Button variant="danger" disabled={pending} onClick={() => run("delete")}>Delete forever</Button>
          </div>
        </Dialog>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <Link href={editHref as Route} className={linkClass}>Edit</Link>
      {viewHref && <Link href={viewHref as Route} target="_blank" className={linkClass}>View</Link>}
      {canDelete && <button type="button" disabled={pending} onClick={() => run("trash")} className="text-sm font-medium text-danger hover:underline">Trash</button>}
    </div>
  );
}
