import type { AccountStatus, FieldErrors } from "@/lib/types";

/** B2B approval workflow. Pure and client-safe; the backend enforces the same rules. */

export const accountStatusLabels: Record<AccountStatus, string> = {
  pending: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
};

/** What each status means for the customer, shown next to the badge. */
export const accountStatusHelp: Record<AccountStatus, string> = {
  pending: "Applied, waiting for review. Can't see wholesale prices or order yet.",
  approved: "Active trade account. Sees wholesale prices and can order.",
  rejected: "Application declined. Can't sign in to order; can be reopened or approved later.",
  suspended: "Temporarily blocked from ordering (e.g. overdue invoices). Existing orders are unaffected.",
};

export interface StatusAction {
  to: AccountStatus;
  label: string;
  /** Rejections and suspensions need a reason for the audit trail. */
  reasonRequired: boolean;
  tone: "primary" | "secondary" | "danger";
}

const actions: Record<AccountStatus, StatusAction[]> = {
  pending: [
    { to: "approved", label: "Approve", reasonRequired: false, tone: "primary" },
    { to: "rejected", label: "Reject", reasonRequired: true, tone: "danger" },
  ],
  approved: [{ to: "suspended", label: "Suspend", reasonRequired: true, tone: "danger" }],
  suspended: [{ to: "approved", label: "Reactivate", reasonRequired: false, tone: "primary" }],
  rejected: [
    { to: "approved", label: "Approve", reasonRequired: false, tone: "primary" },
    { to: "pending", label: "Reopen application", reasonRequired: false, tone: "secondary" },
  ],
};

export const statusActions = (from: AccountStatus) => actions[from];

export const findStatusAction = (from: AccountStatus, to: AccountStatus) => actions[from].find((a) => a.to === to);

export const STATUS_REASON = { min: 5, max: 300 } as const;

/** Field errors for a status change; empty when allowed. */
export function checkStatusChange(from: AccountStatus, to: AccountStatus, reason?: string): FieldErrors {
  const action = findStatusAction(from, to);
  if (!action) return { status: `Can't change from ${accountStatusLabels[from]} to ${accountStatusLabels[to]}.` };
  const r = reason?.trim() ?? "";
  if (action.reasonRequired && r.length < STATUS_REASON.min)
    return { reason: `Give a reason (at least ${STATUS_REASON.min} characters) — it is kept in the approval history.` };
  if (r.length > STATUS_REASON.max) return { reason: `Keep the reason under ${STATUS_REASON.max} characters.` };
  return {};
}
