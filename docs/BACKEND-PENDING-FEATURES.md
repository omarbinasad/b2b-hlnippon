# Backend-pending features

For the backend developer and the owner: what the frontend shows but can't make real without a server. Every item has a working demo screen unless it says otherwise.

Priority: **P0** is needed before any real customer uses it, **P1** soon after launch, **P2** when wanted.

## Security and identity

| Priority | Feature | Today | Backend must |
|---|---|---|---|
| P0 | Authentication | A cookie picks the viewer | Sign-in, sessions, password hashing, lockout, rate limits |
| P0 | Authorization | Screens and demo actions only | Check capabilities and ownership on every call |
| P0 | Customer data isolation | Always the demo customer | Scope every `/customer` call to the session |
| P0 | Password reset, staff invitations | Screens only | Single-use expiring tokens, sending |
| P0 | Rate limits and bot protection | None | Sign-in, registration, contact form, password reset |
| P0 | HTML sanitizing on save | Done by the mock, plus on display | Sanitize on the server with the same allowlist |
| P1 | Audit log | Order and stock history only | Who changed what, for every sensitive action |

## Orders and money

| Priority | Feature | Today | Backend must |
|---|---|---|---|
| P0 | Authoritative calculation | Mock repeats the engines in memory | Recalculate prices, coupons, shipping, tax and totals at cart, checkout and order creation |
| P0 | Stock reservation and deduction | **Not done:** placing an order doesn't change stock | Atomic reservation, no overselling, release on cancel, restock on refund |
| P0 | Stock checks on staff orders | **Not done** | Warn or refuse, as the owner decides |
| P0 | Delivery cut-offs at checkout | **Not enforced:** dates are shown only | Enforce route days and cut-off in the store's time zone |
| P0 | Atomic numbering | Max + 1 | Gap-free sequences under concurrency for orders and invoices |
| P0 | Idempotent checkout | Process memory | Durable idempotency keys |
| P0 | Atomic coupon limits | Not atomic | Enforce limits under concurrency |
| P1 | Real payments | None. Methods are labels | Gateway, webhooks, reconciliation. No secrets in the frontend |
| P1 | Real refunds | Recorded only | Move money, idempotently |
| P1 | Payment amounts | `recordPayment` marks the order paid and notes the amount. A paid order with a later positive balance can't record more | A payments table with partial payments and balances |
| P1 | Quote acceptance | The order always gets bank transfer, even if that method is off | Use an enabled method, or let the customer pick |
| P2 | Credit limits and terms | Not built | If wanted |

## Documents

| Priority | Feature | Today | Backend must |
|---|---|---|---|
| P1 | Invoice, quotation and packing slip PDFs | Browser print only. **This isn't a PDF** | Server-generated PDFs, private downloads |
| P1 | Sequential tax-compliant invoices | Clearly marked as a demo document | Numbering and legal content per country, checked by the company's accountant |
| P1 | Tax rates and rules | Fictional | Real rates, entered and checked by the company |
| P1 | Secure documents | Registration documents are in memory | Private storage, scanning, signed links |

## Email and reminders

| Priority | Feature | Today | Backend must |
|---|---|---|---|
| P1 | Sending email | Log rows marked "simulated" | Sending provider, queue, retries, bounces, unsubscribe |
| P1 | Reminder scheduler | Preview and simulate only | Scheduled job, dedupe per customer, campaign and date, respect opt-outs at send time |

## Content and files

| Priority | Feature | Today | Backend must |
|---|---|---|---|
| P0 | Permanent storage | Memory, lost on restart | A database: see [DATABASE-REQUIREMENTS.md](DATABASE-REQUIREMENTS.md) |
| P1 | Media storage | Memory | File storage or CDN, image processing, malware scanning |
| P1 | Scheduled publishing | Worked out when read | Same rule, or a job, plus cache refresh |
| P2 | Page revisions, autosave, reusable blocks | **Not built** in the frontend either | If wanted: needs frontend work too |

## Reports

| Priority | Feature | Today | Backend must |
|---|---|---|---|
| P1 | Reports | Calculated from memory | Compute in the database, with the definitions in `src/lib/reports/aggregate.ts` |
| P1 | Exports | CSV for reports only in the demo | Background exports, with logging. The contract includes orders, customers and products |

## Not started on either side

These aren't in the demo. Decide whether they're needed:

- Multi-company operation. It's one company per deployment by design.
- Languages other than English.
- Product import and export.
- Delivery driver or route-sheet tools.
- Customer credit accounts.

## Open questions for the owner

[BUSINESS-RULES.md §30](BUSINESS-RULES.md) lists places where the code's rules need a decision before they're copied into the backend.
