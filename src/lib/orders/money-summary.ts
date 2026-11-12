import type { Money, Order } from "../types/index.ts";
import { fromMinor, toMinor } from "./calc.ts";
import { isCollected } from "./refund.ts";

/**
 * Every money figure of an order, kept apart so nobody reads one as another. Pure, in minor units, rounded once.
 * Rules (also in docs/BUSINESS-RULES.md, "Money summary"):
 *  - original: the total when the order was placed; current: after staff changes (weights, prices, items), before refunds.
 *  - received: money taken in. Only once the payment is recorded (paid or partly refunded); never from choosing a method.
 *  - outstanding: still to collect. overpaid: received above what the order now costs; refundDue: the part of that not yet returned.
 *  - refunds: "recorded" are noted only (this demo, or a manual refund to confirm); "processed" were confirmed by the payment provider.
 *  - invoiceTotal: the latest invoice or revision. creditNotes: credit issued on paper. A credit note lowers what is owed; it
 *    never means money was returned. A refund is the only record of money going back.
 */
export interface MoneySummary {
  original: Money;
  current: Money;
  /** current − original (negative = the order got cheaper). */
  change: Money;
  received: Money;
  refundedRecorded: Money;
  refundedProcessed: Money;
  /** What the customer owes now: current total less refunds. */
  owed: Money;
  outstanding: Money;
  overpaid: Money;
  refundDue: Money;
  invoiceTotal?: Money;
  /** Positive amount of credit issued by credit notes. */
  creditNotes: Money;
  /** The payment is recorded as collected. */
  collected: boolean;
}

type SummaryOrder = Pick<Order, "totals" | "adjustments" | "paymentStatus" | "payment" | "refunds" | "invoices">;

export function moneySummary(order: SummaryOrder): MoneySummary {
  const m = toMinor;
  const current = m(order.totals.total);
  const original = order.adjustments.length ? m(order.adjustments[0].before.orderTotal) : current;
  const refunded = (status: "recorded" | "processed") => order.refunds.filter((r) => r.status === status).reduce((s, r) => s + m(r.amount), 0);
  const refundedRecorded = refunded("recorded");
  const refundedProcessed = refunded("processed");
  const owed = m(order.totals.netTotal);
  const collected = isCollected(order.paymentStatus) || order.paymentStatus === "refunded";
  // Kept = received and not refunded. Received = kept + everything refunded.
  const kept = collected ? m(order.payment.amountPaid ?? order.totals.netTotal) : 0;
  const received = collected ? kept + refundedRecorded + refundedProcessed : 0;
  const overpaid = Math.max(0, kept - owed);
  const invoices = (order.invoices ?? []).filter((i) => i.kind !== "credit_note");
  const latest = invoices.at(-1);
  const creditNotes = (order.invoices ?? []).filter((i) => i.kind === "credit_note").reduce((s, i) => s + Math.abs(m(i.difference ?? -i.snapshot.totals.total)), 0);
  return {
    original: fromMinor(original),
    current: fromMinor(current),
    change: fromMinor(current - original),
    received: fromMinor(received),
    refundedRecorded: fromMinor(refundedRecorded),
    refundedProcessed: fromMinor(refundedProcessed),
    owed: fromMinor(owed),
    outstanding: fromMinor(collected ? Math.max(0, owed - kept) : owed),
    overpaid: fromMinor(overpaid),
    refundDue: fromMinor(overpaid),
    invoiceTotal: latest ? latest.snapshot.totals.total : undefined,
    creditNotes: fromMinor(creditNotes),
    collected,
  };
}
