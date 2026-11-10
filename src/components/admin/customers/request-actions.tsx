"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setCustomerStatusAction } from "@/app/admin/customers/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { STATUS_REASON } from "@/lib/customers/status";
import type { AccountStatus } from "@/lib/types";

/**
 * Approve / Decline buttons for one registration request (Decline = reject, with a reason kept in the approval
 * history). A declined request can be reopened; an approved or suspended account has no decision left to make here.
 * Same workflow and rules as the customer page's status panel.
 */
export function RequestActions({ customerId, companyName, status }: { customerId: string; companyName: string; status: AccountStatus }) {
  const router = useRouter();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const p = `req-${customerId}`;

  const decide = (to: AccountStatus, why?: string) =>
    startTransition(async () => {
      setError("");
      const r = await setCustomerStatusAction(customerId, to, why);
      if (r.ok) {
        setDeclining(false);
        setReason("");
        router.refresh();
      } else setError(r.errors.reason ?? r.message);
    });

  if (status === "approved" || status === "suspended") return null;

  if (status === "rejected") {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => decide("pending")}>Reopen</Button>
        <Button size="sm" disabled={pending} onClick={() => decide("approved")}>
          <Icon name="check" className="size-4" /> Approve
        </Button>
        {error && !declining && <p role="alert" className="w-full text-right text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button size="sm" disabled={pending} onClick={() => decide("approved")} aria-label={`Approve ${companyName}`}>
        <Icon name="check" className="size-4" /> {pending && !declining ? "Approving…" : "Approve"}
      </Button>
      <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" disabled={pending} onClick={() => setDeclining(true)} aria-label={`Decline ${companyName}`}>
        <Icon name="close" className="size-4" /> Decline
      </Button>
      {error && !declining && <p role="alert" className="w-full text-right text-xs text-danger">{error}</p>}
      <Dialog
        open={declining}
        onClose={() => { setDeclining(false); setError(""); }}
        title={`Decline ${companyName}?`}
        description="The application is marked as rejected and no wholesale account is opened. You can reopen or approve it later."
      >
        <form onSubmit={(e) => { e.preventDefault(); decide("rejected", reason); }} className="space-y-4" noValidate>
          <Field id={`${p}-reason`} label="Reason" required hint="Required. Kept in the approval history." error={error}>
            <Textarea
              id={`${p}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={STATUS_REASON.max}
              placeholder="e.g. Business license could not be verified"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${p}-reason-error` : `${p}-reason-hint`}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setDeclining(false); setError(""); }}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={pending}>{pending ? "Declining…" : "Decline application"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
