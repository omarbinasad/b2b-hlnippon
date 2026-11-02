"use client";

import { useState, useTransition } from "react";
import { setCustomerStatusAction } from "@/app/admin/customers/actions";
import { AccountStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { accountStatusHelp, accountStatusLabels, STATUS_REASON, statusActions, type StatusAction } from "@/lib/customers/status";
import type { AccountStatus } from "@/lib/types";

/** Current approval status, what it means, and the allowed decisions (each recorded with a reason). */
export function CustomerStatusPanel({ customerId, companyName, status }: { customerId: string; companyName: string; status: AccountStatus }) {
  const [action, setAction] = useState<StatusAction | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [pending, startTransition] = useTransition();

  const close = () => {
    setAction(null);
    setReason("");
    setError("");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <AccountStatusBadge status={status} />
      </div>
      <p className="text-sm text-muted">{accountStatusHelp[status]}</p>
      <div className="flex flex-wrap gap-2">
        {statusActions(status).map((a) => (
          <Button key={a.to} variant={a.tone} size="sm" onClick={() => { setDone(""); setAction(a); }}>
            {a.label}
          </Button>
        ))}
      </div>
      <p role="status" className="text-sm text-muted">{done}</p>

      <Dialog
        open={action !== null}
        onClose={close}
        title={action ? `${action.label}: ${companyName}?` : ""}
        description={action && (
          <>
            {accountStatusLabels[status]} → <strong>{accountStatusLabels[action.to]}</strong>. {accountStatusHelp[action.to]} No email or SMS is sent.
          </>
        )}
      >
        {action && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const result = await setCustomerStatusAction(customerId, action.to, reason);
                if (result.ok) {
                  setDone(`Status changed to “${accountStatusLabels[action.to]}”. Recorded in the approval history.`);
                  close();
                } else setError(result.errors.reason ?? result.message);
              });
            }}
            className="space-y-4"
          >
            <Field
              id="status-reason"
              label={action.reasonRequired ? "Reason" : "Note (optional)"}
              required={action.reasonRequired}
              hint="Kept in the approval history with your name and the time."
              error={error || undefined}
            >
              <Textarea
                id="status-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={STATUS_REASON.max}
                className="min-h-20"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "status-reason-error" : "status-reason-hint"}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>Cancel</Button>
              <Button type="submit" variant={action.tone === "danger" ? "danger" : "primary"} disabled={pending}>
                {pending ? "Saving…" : action.label}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
