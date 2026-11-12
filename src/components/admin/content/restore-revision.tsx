"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { restoreRevisionAction } from "@/app/admin/content-actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { ContentKind } from "@/lib/types";

/** Restores a revision after asking. A live page or post changes straight away, so the question says so. */
export function RestoreRevisionButton({ kind, id, revisionId, when, live }: { kind: ContentKind; id: string; revisionId: string; when: string; live: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const noun = kind === "page" ? "page" : "post";

  const restore = () =>
    startTransition(async () => {
      const r = await restoreRevisionAction(kind, id, revisionId);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setOpen(false);
      router.push(`/admin/${kind}s/${id}?restored=1` as Route);
    });

  return (
    <>
      <Button variant="secondary" onClick={() => { setError(""); setOpen(true); }}>Restore the older version</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Restore this version?"
        description={live
          ? `This ${noun} is live. Visitors will see the version from ${when} straight away. The current content stays in the history, so you can switch back.`
          : `The ${noun}'s content goes back to the version from ${when}. Its status doesn't change, and the current content stays in the history.`}
      >
        {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={pending} onClick={restore}>{pending ? "Restoring…" : live ? "Restore and update live" : "Restore"}</Button>
        </div>
      </Dialog>
    </>
  );
}
