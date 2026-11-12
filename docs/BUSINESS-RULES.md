# Business rules

For the backend developer. These are the rules the backend must enforce, each with the file that implements it today. Schema is in `docs/DATABASE-REQUIREMENTS.md`; HTTP contract is in `docs/backend-api.md` (partly out of date, see §30).

**Nothing here is secure today.** There is no login. Every check runs on the demo's Next.js server, behind a cookie anyone can change. Treat each rule as a specification.

**Enforcement labels used below**

| Label | Meaning | What you must do |
| --- | --- | --- |
| **Engine** | Pure function with tests, called by the mock | Port it and reuse the tests as cases |
| **Mock** | Check exists only in a `src/lib/data/mock-*.ts` file | Reimplement; no test covers it unless cited |
| **Screen** | The UI hides or blocks something; no real protection | Enforce server-side. The screen rule is only a hint |
| **Not enforced** | Stated intent, or a field exists, but nothing checks it | Implement, or confirm with the product owner |

**Paths** are relative to `src/lib/` unless they start with `src/`, `tests/` or `docs/`. `npm test` runs the suite in `tests/`. Port those tests: their values are the conformance cases.

---

## 1. Money

Implemented in `orders/calc.ts`; tested in `tests/order-calc.test.ts`, `tests/company-settings.test.ts`.

| Rule | Detail |
| --- | --- |
| Unit | Integer minor units. Digits come from `company.locale.currencyDigits` (0, 2 or 3; 0 for JPY) |
| Rounding | Half-up, exact integer division, once per calculated value |
| Sums | Add integers, then convert. `sumMoney([1200, 1300, 999])` = 3499 |
| Valid amount | ≥ 0, finite, no extra decimals (`isValidAmount`). `10.5` is refused at 0 digits |
| Valid percent | 0 to 100, at most 2 decimals (`isValidPercent`) |
| Allocation | Largest remainder; ties go to the earlier line; shares sum exactly (`allocateMinor`) |
| Currency change | Relabels, never converts (`src/config/currency.ts`) |

Details: `DATABASE-REQUIREMENTS.md` §2.

---

## 2. Price resolution

**Who sees which price in the store.** Approved customers see their own price. Staff see the **standard wholesale price**: what an approved customer with no group and no customer-specific rule pays, so rules for all approved customers and sale prices apply, group and customer rules don't. Guests and applicants see none, and the price filter is ignored for them. Staff have no cart: the store sends them to Create order in the admin. Implemented with `STANDARD_PRICING_ID` (`src/lib/pricing/standard.ts`) in the mock; the backend decides from the session.

Implemented in `pricing/engine.ts` (`resolvePrice`, `activeSalePrice`, `adjustedPrice`). Adapter: `data/mock/pricing-rules.ts`. Tested in `tests/pricing-engine.test.ts`. **Engine.**

**Eligibility.** A rule is eligible when all hold:

1. Status is `active`.
2. Now is inside `validFrom`/`validTo` (either may be absent).
3. The customer is **approved**, and the audience matches: all, the customer's group, or the customer.
4. The target matches: all, a category (the item's categories **with ancestors**), a product, or a variation of that product.
5. A tier covers the line quantity.
6. The resulting price is not negative. If it is, the rule is skipped and the next one can win.

**Winner.** Exactly one rule. Discounts never stack. First by:

| Order | Comparison |
| --- | --- |
| 1 | Audience: customer > group > all |
| 2 | Target: variation > product > category > all |
| 3 | `priority`: **higher** first |
| 4 | `createdAt`: older first |
| 5 | `id`: ascending |

Audience outranks target: a customer-wide category rule beats a group's variation rule, even if the group price is lower (test: "customer-specific beats group…"). A stronger rule with no tier for the quantity is passed over, and a weaker one can apply.

**Base price.** Percent and amount-off rules are calculated from the **regular** price, never the sale price. A fixed-price rule uses its entered amount.

| Adjustment | Result |
| --- | --- |
| `fixed_price` | The amount |
| `amount_off` | Regular − amount; negative = rule skipped |
| `percent_off` | `regular × (10000 − bp) / 10000`, half-up, per unit |

**Sale price.** `activeSalePrice`: valid only if below the regular price, and today (store date) is inside `saleFrom`/`saleTo`, both inclusive. Variations carry their own sale fields. A "sale" at or above regular is ignored.

**Comparison.**

| Situation | Customer pays | `priceSource` |
| --- | --- | --- |
| Rule wins, no active sale | Rule price | `rule` |
| Rule wins, sale is lower | Sale price | `sale` |
| Rule wins, rule ≤ sale | Rule price (equal reports the rule) | `rule` |
| No eligible rule, active sale | Sale price | `sale` |
| Neither | Regular price | `regular` |
| Not approved | Rule ignored; sale or regular | `sale` / `regular` |

Compared, never combined. No B2B discount is ever applied to a sale price.

Line total = unit price × quantity, integer arithmetic. Each line resolves at its own real quantity, so tiers apply per line. No price (no `basePrice`) means the option can't be ordered online.

**Conflict reporting.** `findPriceConflicts`: active rules with the same audience, the same target level sharing an id, overlapping dates and overlapping tiers. Same priority = `conflict` (decided by age); different = `overlap`. Limit stated in the code: two different categories that share a product aren't detected.

**Saving a rule** (`validatePriceRule`, `validateTiers`, `negativePriceErrors`): name 3 to 120; priority −1000 to 1000; 1 to 10 tiers; tiers increasing, not overlapping; only the last open-ended; quantities 1 to 100,000. The save is refused if a tier would make any targeted base price negative (`mock-pricing.ts`). Referenced ids must exist.

**Trap:** the comment on `ResolvedPrice.salePrice` (`types/pricing.ts`) and on `resolvePrice`'s input says the sale price is "used only when no rule applies". That is out of date. The engine header and code use the lower of the two.

---

## 3. Quantity rules

Implemented in `pricing/engine.ts` (`resolveQuantityLimits`, `checkQuantity`, `validateQuantityRule`), product limits checked by `checkOrderQuantity` in `validation/product.ts`. **Engine**, tested in `tests/pricing-engine.test.ts` and `tests/product-quantity.test.ts`.

**Quantity means packages** (bags, cases, cartons: the product's selling unit), never weight. Three 5 kg bags is a quantity of 3. Package weight is a separate field used for shipping (§14) and, for products priced by weight, the delivered-weight adjustment (§7). Nothing forces "sold individually".

**The product's own limits** (`Product.quantityRule`, edited under Inventory → Order quantity):

| Field | Rule |
| --- | --- |
| `min` | Whole number ≥ 1. Default 1 |
| `max` | Empty = no limit. Whole number ≥ 1, not below `min` |
| `step` | "Order in multiples of". Default 1 (any whole number). `min` and `max` must be multiples of it |
| Sold individually | Forces min 1, max 1, step 1. Refused together with other limits above 1 |

**Precedence** (`resolveQuantityLimits`):

1. A quantity rule for the **variation**, then for the **product**, overrides the product's own limits. A field the rule leaves empty comes from the product.
2. The **product's own limits** beat a **category** or **store-wide** rule. A product minimum of 1 counts as "not set", so a category minimum still applies to it; a product maximum, when set, always wins over those rules.
3. Otherwise the most specific active rule: category > all, then higher priority, then older, then id. Two rules are never merged.
4. Defaults: at least 1, no maximum.
5. The step always comes from the product (or 1). Sold individually overrides everything.

| Rule | Detail |
| --- | --- |
| Scope | Per order line. A category rule never sums quantities across products |
| Messages (`checkQuantity`) | "Order at least N.", "Order at most N.", "Order in multiples of N." |
| Saving a rule | At least one of min or max; integers 1 to 100,000; min ≤ max; name 3 to 120; priority −1000 to 1000 |

Where limits apply: cart lines, checkout, the product page (minimum, multiple and maximum shown; the quantity input follows them), admin order creation, adding an order line, changing a line's quantity on an order (`data/mock-orders.ts`), and the rule tester. The quantity is never derived from weight, and a fixed-price package's price is never changed by weight; only products marked "priced by weight" are recalculated from the delivered weight (§7).

---

## 4. Cart and checkout

Implemented in `orders/cart.ts` (**Engine**, `tests/cart-checkout.test.ts`), `data/mock-cart.ts` and `prepareCheckout` in `data/mock-orders.ts` (**Mock**).

**Cart**

| Rule | Detail |
| --- | --- |
| Who | Approved customers only |
| Stored | Product, option, quantity, coupon code. Never a price. **The browser can't send a price** |
| Re-pricing | Every read re-prices and re-checks every line |
| Limits | 100 lines; quantity 1 to 100,000; same option sums, capped |
| Adding | Unknown, unpublished or unpriced products are skipped with a reason; variable products need an active option |
| Quantity 0 | Removes the line |

**Line check order** (`checkCartLine`, first failure wins): unavailable (archived, removed or disabled option, or not published) → no price → whole number ≥ 1 → min → max → pack multiple → out of stock unless backorders → over the counted stock unless backorders. Backorder policy `notify` behaves like `allow` here.

**Checkout steps** (`prepareCheckout`, then `buildOrder`)

1. Customer must be approved. Cart must not be empty.
2. Re-price every line. Any line error blocks the order.
3. Delivery address must be a `shipping` address **from the customer's own book**. Billing is the given `billing` address, else the default billing address, else the delivery address.
4. Payment method must be in the enabled, available list and map to an order method (`orderPaymentMethod`). `online` has no mapping, so it can't be chosen.
5. Requested delivery date (optional, `checkDeliveryDate`): valid date, today or later in store time, within 92 days. **Route cut-off is not checked**, see §17.
6. Customer note up to 500.
7. **Coupon re-check.** A coupon that stopped applying **blocks** the order with a message, rather than silently changing the price.
8. Coupon allocations become line discounts.
9. Quote shipping for the delivery address and discounted lines. Use the chosen method if it is available, else the suggested one, else the first available. None available: blocked, with `unavailableMessage`.
10. `buildOrder` validates, snapshots tax, and creates the order. `paymentStatus` starts as `unpaid`.
11. Record coupon use, empty the cart, queue the confirmation email.

**Idempotency** (`checkout`): one key per checkout page view, scoped to the customer, 8 to 100 characters. Repeat = the order already placed. In flight = refused. A failed attempt releases the key. The demo's concurrency handling is single-process memory; the backend needs a database constraint.

**The preview** (`checkoutPreview`) runs the same path without saving. It must not record coupon use or change stock.

---

## 5. Creating an order (staff and walk-in)

Implemented in `buildOrder` in `data/mock-orders.ts` (**Mock**) and `validateCreateOrder` in `validation/order.ts` (**Engine**, `tests/invoices.test.ts`).

| Rule | Detail |
| --- | --- |
| Buyer | Exactly one of an **approved** customer or a walk-in buyer. Walk-in: name 2 to 200, company ≤ 200, email and phone checked only if given. No account is created |
| Fulfilment | `delivery` needs both addresses. `pickup` is walk-in only, has no addresses, shipping is forced to "Collected in store" at 0, and tax uses the **store's** location |
| Address phone | Required for registered customers, optional for walk-in |
| Lines | 1 to 100; quantity 1 to 10,000; `unitPrice` and `discount` valid amounts; discount ≤ line amount; product not archived; active option on variable products; quantity limits apply |
| Pricing | Staff may agree a different unit price. `pricing.manualOverride` records it. The rule outcome is still snapshotted |
| Walk-in price | Catalog price (sale if active). Rules need an approved account |
| Shipping | `suggested`: the amount must equal the server's fresh quote, or it is refused. `manual`: reason 5 to 300 required. The decision is stored either way |
| Payment | `invoice` → `paymentStatus: invoiced`; anything else → `unpaid`. Never paid at creation |
| Created by | `createdVia`, `createdBy`, first status event |
| Not checked | **Stock and pack multiples are not checked** on staff-created orders. Stock is not deducted anywhere. See §20 |

---

## 6. Order calculation order

Implemented in `orders/calc.ts`, `orders/assemble.ts` (`recalculate`), `tax/engine.ts`. Tested in `tests/order-calc.test.ts`, `tests/order-editing.test.ts`, `tests/tax-engine.test.ts`. **Engine.**

| Step | Calculation |
| --- | --- |
| 1. Line subtotal | `unitPrice × quantity`; weight-priced lines with a fulfilled weight are scaled, §7 |
| 2. Line discount | Capped at the subtotal, never negative. Includes any coupon share |
| 3. Line total | Subtotal − discount. **Excludes** the order discount |
| 4. Order discount | Fixed (capped at the items) or percent of the sum of line totals, half-up |
| 5. Discount shares | Largest remainder across lines, so tax is on what the customer pays. Lines keep their `lineTotal`; shares feed tax and refund shares only |
| 6. Items total | `itemsSubtotal − discountTotal` |
| 7. Shipping | The amount saved on the order |
| 8. Tax | Per rate, from the order's snapshot, §15 |
| 9. Total | Tax added: items + shipping + tax. Tax included: items + shipping |
| 10. Net | `netTotal = total − refundedTotal`, where only `order` kind refunds count |

Tested example (fictional rates, older-order path): items 1000 in one class and 500 in another, shipping 100 in the first, 10 % order discount. Discount 150, split 100 and 50. Items total 1350. Total = 1350 + 100 + 173 tax (`tests/order-editing.test.ts`).

---

## 7. Delivered-weight recalculation

Implemented in `lineAmounts`, `applyLineChange`, `scaleOrderedWeight` in `orders/calc.ts`. Tested in `tests/order-calc.test.ts`, `tests/order-editing.test.ts`. **Engine.**

**Formula** for a line with `pricedByWeight = true` and a `fulfilledWeight`:

```
subtotal = unitPrice × quantity × fulfilledGrams / orderedGrams    (half-up, once)
```

`pricedByWeight` is a snapshot of the product's `isVariableWeight`. `orderedWeight` = quantity × unit weight at order time. Weights convert to whole grams, so `g` and `kg` mix safely.

**Worked example** (fictional, no tax, no shipping): 5 kg ordered at 1000 per kg, so `quantity 5`, `unitPrice 1000`, `orderedWeight 5 kg`.

| Delivered | Calculation | Line total | Change |
| --- | --- | --- | --- |
| Not weighed yet | 1000 × 5 | **5000** | |
| 4 kg | 5000 × 4000 / 5000 | **4000** | −1000 |
| 6 kg | 5000 × 6000 / 5000 | **6000** | +1000 |

More cases from the tests: 5 packs × 1120, ordered 10 kg, packed 10.4 kg = 5824. 1000 for 2 kg, packed 1850 g = 925. Half-up: 100 × 2/3 = 66.67 → 67.

| Rule | Detail |
| --- | --- |
| `unitPrice` is per selling unit | Not per kg. It equals a per-kg price only when one unit is 1 kg. The ratio does the scaling |
| Not weight-priced | A different fulfilled weight changes nothing in the amount; it is shipping data only |
| Not yet weighed | The ordered weight applies; no scaling |
| Quantity change | Ordered weight scales with quantity, to the gram, in its original unit. An existing fulfilled weight stays. Example: 5 × 1 kg at 1000, packed 5.2 kg = 5200; quantity 6 with 5.2 kg packed is still 5200 |
| Fulfilled weight | Must be above 0 |
| When allowed | Any status except cancelled, including after delivery (`canAdjust`) |
| Recording | An `adjust` adjustment with a reason (5 to 300) and before/after weight, line total and order total |
| Effect on shipping and tax | Tax recalculates from the snapshot. **Shipping does not re-quote**: it stays the saved amount. An issued invoice becomes out of date, §16 |
| Discount | A line discount is capped at the new subtotal. The explicit "discount above new amount" error only fires for price or quantity changes, not weight-only ones (`validateAdjustment`) |

---

## 8. Editing an order

Implemented in `applyEdit` in `data/mock-orders.ts` (**Mock**), `orders/status.ts`, `validation/order.ts`. Every edit: validates, recalculates with the order's own tax basis, appends an adjustment, never changes the catalog.

| Edit | Allowed in status | Other rules |
| --- | --- | --- |
| `adjust`: price, weight | All except cancelled | Reason 5 to 300. Something must change |
| `adjust`: quantity | received, preparing, on_the_way | 1 to 10,000; quantity limits |
| `add` | received, preparing, on_the_way | Same product and option can't be added twice; change the quantity instead. Price rule snapshotted |
| `replace` (`add` with `replaceItemId`) | received, preparing, on_the_way | One step; audit shows both names |
| `remove` | received, preparing, on_the_way | Can't remove the last item; cancel instead |
| `discount` | All except cancelled | Fixed above 0 and ≤ items total; percent above 0, ≤ 100, 2 decimals; must differ from current. `null` removes it |
| `delivery_date` | received, preparing, on_the_way | Real date or null; must differ. **Reason optional** (up to 300) |
| `address`: shipping | received, preparing, on_the_way | Not on pickup orders. Must change something. Book not touched |
| `address`: billing | All except cancelled | Same |
| `shipping` | All except cancelled | Label 1 to 120; valid amount; must change; decision becomes `manual` but keeps what was suggested |

**Global guard:** an edit is refused if the new `netTotal` would be negative (the total can't fall below what was already refunded).

**Previews** (`previewEdit`) use the same validation and calculation without saving, and report before, after, difference, line total, order discount and balance.

**Behaviour to confirm**

| Behaviour | Detail |
| --- | --- |
| Address edit doesn't re-freeze | Changing the delivery address keeps the old tax snapshot and shipping charge. Unclear if intended |
| Removing a refunded line | Not blocked. `refundSummary` only lists current items, though the refund itself stays |
| Coupon on edited orders | `order.coupon.amount` isn't recalculated when a line is removed or changed; the line discount stays on surviving lines only |
| Edit after an invoice | Allowed. The invoice is flagged out of date, §16 |

---

## 9. Balance due and overpayment

Implemented in `paymentBalance` in `orders/assemble.ts`, `refundSummary` in `orders/refund.ts`, `applyEdit` in `data/mock-orders.ts`. Tested in `tests/order-editing.test.ts`, `tests/refunds.test.ts`.

| Concept | Rule |
| --- | --- |
| `amountPaid` | Amount received and kept. **Captured once**: the first time an order with status `paid` or `partially_refunded` is edited, set to the `netTotal` before the edit |
| Balance | `netTotal − amountPaid`. Positive = collect more. Negative = overpaid. Undefined when `amountPaid` is absent |
| Kept | If collected: `amountPaid`, else `netTotal`. If not collected: 0 |
| Overpaid | `max(0, kept − netTotal)` |

**Extending the §7 example, paid in full before weighing** (`amountPaid` becomes 5000 on the first edit):

| Delivered | `netTotal` | Balance | Next step |
| --- | --- | --- | --- |
| 4 kg | 4000 | **−1000** (overpaid) | Overpayment refund of 1000 → `amountPaid` 4000, order value unchanged, balance 0, status stays `paid` |
| 6 kg | 6000 | **+1000** (due) | **No call can record this.** See below |

**Gap.** `recordPayment` refuses once an order is `paid`, and nothing raises `amountPaid`. A positive balance stays on the order, and its `paymentStatus` still reads `paid`. The backend needs a way to record extra payments. Partial payments aren't modelled either. This is a design decision for you and the product owner.

Tested example: paid 4400, a line removed → total 3850, balance −550; overpayment refund 550 → `refundedTotal` 0, `netTotal` 3850, balance 0.

### Money summary (what the order screens show)

`moneySummary(order)` in `src/lib/orders/money-summary.ts` (**Engine**, `tests/money-summary.test.ts`) turns an order into the figures both order screens show (`src/components/order/money-summary.tsx`). Every amount is integer minor units.

| Figure | Meaning |
| --- | --- |
| Original total | The total when placed: `adjustments[0].before.orderTotal`, or the current total if never adjusted. Shown only when it differs |
| Current total | `totals.total`: after staff changes (weights, prices, items), before refunds |
| Change | Current − original (negative = the order got cheaper) |
| Collected | `paymentStatus` is `paid`, `partially_refunded` or `refunded`. Choosing a payment method never counts |
| Kept | If collected: `payment.amountPaid`, else `netTotal`. If not collected: 0 |
| Received | Kept + every refund (recorded and processed): all money that came in |
| Refunds recorded | Refunds with status `recorded`: noted on the order (the demo, or a manual refund still to confirm) |
| Refunds processed | Refunds with status `processed`: confirmed by the payment provider |
| Owed | `netTotal` = current total − refunds |
| Outstanding | Collected: max(0, owed − kept). Not collected: owed |
| Overpaid / Refund due | max(0, kept − owed): received above what the order now costs and not yet returned |
| Invoice total | The latest invoice or revision total (credit notes excluded). Staff only |
| Credit notes | Sum of credit notes. **A credit note is paper**: it lowers what's owed but moves no money. Only a refund records money going back. Never treat one as the other |

The customer screen hides the staff-only rows (invoice total, provider notes).

---

## 10. Order status flow

Implemented in `orders/status.ts`, `updateStatus` in `data/mock-orders.ts`. **Engine** (no dedicated test file; `isOpenOrder` in `tests/cms.test.ts`).

```
received → preparing → on_the_way → delivered
    └──────────┴────────────┴──→ cancelled
```

| Rule | Detail |
| --- | --- |
| Forward | One step only. No skipping, no going back |
| Cancel | From any status except delivered or cancelled. Reason of at least 5 characters, stored on the status event |
| Final | `delivered` and `cancelled` |
| History | Every change appends a status event with actor |
| Open order | received, preparing or on_the_way, **and** `paymentStatus` is not `refunded` (`isOpenOrder`). Used by the badge, filter, reminders and schedule page |
| Independence | A status change never changes `paymentStatus`, **and vice versa**. Delivery doesn't require payment |

**Deleting** (`orderDeleteError`): only a cancelled order with status `unpaid`, no recorded payment, no refund and no invoice. Needs `orders.delete`. It's removed for good.

**Cancelling does not:** refund, change payment status, restock, restore coupon use, or issue a credit note automatically. Each is a separate action or isn't built. Restock and coupon restore on cancel: unclear whether they should exist.

**Order type** (`orders/order-type.ts`, `tests/order-type.test.ts`): `walk_in` with no customer; `repeat` when the customer has an earlier non-cancelled order by `placedAt`; else `first`. A cancelled order can still be classified (first or repeat), but never counts as the earlier one. Derived, not stored.

---

## 11. Payment status and payment methods

**Status transitions**

| From | To | Trigger | File |
| --- | --- | --- | --- |
| (new) | `invoiced` | Created with method `invoice` | `buildOrder` |
| (new) | `unpaid` | Any other method | `buildOrder` |
| `unpaid`, `invoiced` | `paid` | Staff `recordPayment`. Not on cancelled orders. Reference up to 100 | `recordPayment` |
| `paid`, `partially_refunded` | `refunded` | Refund leaves kept ≤ 0 | `paymentStatusAfterRefund` |
| `paid`, `partially_refunded` | `partially_refunded` | Any `order` refund exists and something is kept | same |
| `paid` | `paid` | Only overpayment refunds so far, something kept | same |

Issuing an invoice doesn't change `paymentStatus`. **Selecting a method never marks an order paid.** `recordPayment` never charges anyone and takes no amount.

**Method availability** (`payments/methods.ts`, `tests/payment-methods.test.ts`, **Engine**)

| Method | Available at checkout when |
| --- | --- |
| `pay_on_delivery` | Enabled |
| `bank_transfer` | Enabled, and account name, bank name and account number are set |
| `online` | Enabled **and** a provider is connected. Never in the demo; the connection state can't be set from the browser |

Checkout receives customer-facing fields only, in `sortOrder`; bank details only for bank transfer. Reorder must list every method once. Saving (`validatePaymentMethod`): title 2 to 60, description ≤ 160, instructions ≤ 1000. Bank details required only to enable. `bank` on any other method is refused.

Order methods `mobile_wallet` and `invoice` are staff-only: they have no checkout option. `docs/backend-api.md` §8 leaves open whether they become checkout methods.

---

## 12. Refunds

Implemented in `orders/refund.ts` (**Engine**, `tests/refunds.test.ts`), `refund` in `data/mock-orders.ts` (**Mock**). **The demo moves no money.** It stores `status: "recorded"`; the backend sets `processed` after the provider confirms.

**Two kinds**

| | `order` | `overpayment` |
| --- | --- | --- |
| For | Items, shipping or another amount | Money paid above the current total |
| `refundedTotal`, `netTotal` | Lowered | **Unchanged** |
| `amountPaid` | Lowered too, so balance doesn't move | Lowered |
| Input | Lines, shipping, other | `other` only; lines and shipping must be empty |
| Restock | Allowed | Refused |
| Limit | See below | At most `overpaid`; refused if not overpaid |

**Preconditions.** Status `paid` or `partially_refunded`, else "Record the payment first". Reason 5 to 300. Amount above 0. Cancelled orders can be refunded if payment was collected.

**Caps for `order` refunds**

| Cap | Value |
| --- | --- |
| Line amount | Line's share of the order total minus earlier refunds on it |
| Line quantity | Whole number, 0 to `quantity − refundedQuantity`. 0 = amount only, e.g. a price correction |
| Shipping | Shipping's share minus earlier shipping refunds |
| `other` | Valid amount, no own cap |
| Total of lines + shipping + other | `refundable = max(0, min(kept, netTotal))` |

Each line may appear once. Unknown item is refused.

**Shares** (`grossShares`): the order `total` is split across lines and shipping by largest remainder, weighted by each one's amount **after line and order discounts, tax included**. They sum exactly to `total`. Example (fictional 10 % added): lines 3000 and 500, shipping 500, total 4400 → shares 3300, 550, 550.

**Suggested amount** (`suggestedLineAmount`): `gross × quantity / lineQuantity`, half-up, capped at what's left; refunding all remaining units suggests the full remainder.

**Restock** (optional, `order` kind): units with quantity > 0 go back through `setStock` with `delta`. Only counted stock; status-managed, archived or removed items are recorded as `skipped` with a note. Each restock writes a stock movement.

**Not recalculated by a refund:** tax lines and line amounts. `taxTotal` and net sales stay as they were; refunds are reported separately, §26. Whether tax should be reversed on refund is unclear.

---

## 13. Coupons

Implemented in `coupons/engine.ts` (**Engine**, `tests/coupons.test.ts`), `data/mock-coupons.ts`, `data/mock-cart.ts`.

**Evaluation order** (`evaluateCoupon`, first failure wins): enabled → started → not expired (dates inclusive, store time) → `usageLimit` → `usageLimitPerCustomer` → customer or group eligibility → min spend → max spend → at least one eligible line.

| Rule | Detail |
| --- | --- |
| Spend limits | Use the **whole cart** subtotal, not just eligible lines |
| Eligible lines | Not excluded; and if products or categories are set, in the list. Category match includes parents |
| Customer limits | Both lists empty = every approved customer. Otherwise listed customer **or** listed group |
| `percent` | `eligibleTotal × bp / 10000`, half-up on the total, then largest remainder across lines |
| `fixed_cart` | Capped at the eligible total, shared by largest remainder |
| `fixed_product` | `amount × quantity` per eligible line, capped per line |
| Number per cart | One code |
| Basis | Line totals after rule or sale pricing. Nothing excludes sale items |
| Unknown code | Same style of refusal as any other (`evaluateCode`) |
| When checked | On apply, on every cart read, and at checkout. At checkout a failure blocks the order |
| Recording | At order placement: `usedCount + 1` and a usage row. **The limit check and the increment must be atomic**; the mock isn't |
| Saving | Code 3 to 30 of `A-Z 0-9 _ -`, stored upper case, unique; amount above 0; percent ≤ 100; max spend ≥ min spend; expiry ≥ start; limits ≥ 1; description ≤ 300. Amount decimals aren't checked (`10.5` passes, then rounds) |
| List status | disabled if not enabled; else expired if past `expiresOn`; else active |

**Effects on later steps.** Allocations become line discounts, so the coupon lowers the shipping subtotal (§14) and the taxable amount (§15). A shipping rule can also test the coupon code directly (`coupon` condition).

**Why coupons stay separate from staff order discounts**

| | Coupon | Staff order discount |
| --- | --- | --- |
| Who applies it | Customer, at the cart | Staff, on an existing order |
| Stored as | `order.coupon {code, amount}`, spread into `items[].discount` | `order.discount {type, value, reason, at, by}`, shown as `totals.orderDiscount` |
| Control | Rules, dates, usage limits, eligibility | Permission and a required reason (5 to 300), audited |
| When calculated | Before shipping, at checkout | After line discounts, before tax; can change later |
| Effect on the shipping charge | Lowers the subtotal the quote sees | None: shipping is already saved |
| Reports | `couponDiscounts`, and inside `discounts` | Inside `discounts` |
| Available on staff orders | No: the input is "checkout only" | Yes |

The stated reason, from the engine header: coupon discounts are promotional and customer-entered, and are recorded apart from the discount staff can add. The practical consequence, as the table shows: merging them would lose usage tracking on one side and the reason and actor on the other. Both can apply to one order: the staff discount applies on top of line totals that already include the coupon.

**Unclear:** whether cancelling an order should give back its coupon use. Today it doesn't.

---

## 14. Shipping

Implemented in `shipping/engine.ts` (`tests/shipping-engine.test.ts`), `shipping/rules.ts` (`tests/shipping-rules.test.ts`), `data/mock-shipping.ts`. **Engine.** All rates in the demo are samples. **Repeat this at cart, checkout and order creation.**

**Calculation order**

| Step | What happens |
| --- | --- |
| 1. Zone | One zone: exact postcode → city (with its prefecture) → prefecture → fallback. Text ignores case and extra spaces; postcodes compare without punctuation |
| 2. Metrics | `grams = Σ unitGrams × qty` (variation weight overrides product). `subtotal = Σ unitPrice × qty − line discount`: **after line discounts including the coupon, before tax and shipping**. Class units counted per class (variation class overrides) |
| 3. Method quotes | Each of the zone's methods, see below |
| 4. Rules | Enabled rules for this zone, whose conditions match, sorted by priority **ascending** (lowest number first), then name |
| 5. Base override | The first matching `free`, `set_charge` or `tiers` (with a tier found) fixes the base. Later ones are skipped |
| 6. Surcharges | Every matching `surcharge` adds |
| 7. Class fees | Each store-wide shipping class with a `surcharge` in the cart adds, per order or per unit |
| 8. Hide | `hide_method` removes that method type |
| 9. Apply to each delivery method | Pickup keeps its own charge, unaffected by rules except hide |
| 10. Free handling | `hidePaidWhenFree`: if any delivery method costs 0, paid delivery methods are hidden. Pickup stays |
| 11. Suggest | Cheapest available delivery method; ties go to the one listed first. **Pickup is never chosen automatically** |

**Method costs** (`quoteMethod`)

| Type | Cost | Available when |
| --- | --- | --- |
| `flat_rate` | `cost` + class adjustments | Enabled, cart not empty |
| `weight_tiers` | Tier by grams + class adjustments | Same, a tier covers it |
| `subtotal_tiers` | Tier by subtotal + class adjustments | Same |
| `free_shipping` | 0 | Subtotal ≥ `minSubtotal` |
| `local_pickup` | `cost` | Enabled, cart not empty |

A tier applies from its `from` (inclusive) to the next tier's `from` (exclusive).

**Final charge per delivery method** (`costOf` in `shipping/rules.ts`)

| Situation | Charge |
| --- | --- |
| A `free` rule matched | 0. **Free means free**: surcharges and class fees don't apply |
| `free_shipping` method, no base override | 0 |
| `free_shipping` method, a `set_charge` or `tiers` rule matched | The rule's charge + surcharges. The override beats the free method |
| Otherwise | `(rule base, or method cost) + surcharges + class fees` |

**Trap: two class charges.** A method's `classAdjustments` are inside its cost, and the class's own `surcharge` is added in step 7. If both are set, the customer pays both. A `set_charge` or `tiers` rule replaces the method cost, dropping its adjustments but not the class fee. Confirm this is intended.

**Units.** Rule condition `weight` is in **kg**. Rule tiers with `basis: weight`, and method weight tiers, are in **grams**.

**List conditions** (`conditionMatches`): case-insensitive; postcodes by digits and letters. `in` = any cart value is in the list; `not_in` = none is. A rule with no conditions always matches. `match: any` = OR; `all` = AND.

**Saving** (`validateZone`, `validateMethod`, `validateRule`): see `DATABASE-REQUIREMENTS.md` §5.8. Rule amounts are checked ≥ 0, but not for decimals.

**On orders**: the amount is a snapshot, §5. Later rule or zone changes and order edits don't re-quote. Staff can change it through an audited `shipping` edit.

**Behaviour to confirm.** A customer can choose a `local_pickup` method at checkout, since it's in `available`. The resulting order still has `fulfilment` absent (delivery), and a delivery address and tax based on it, because `fulfilment: pickup` is walk-in only. `PickupLocation.fee` is never charged; the method's `cost` is.

---

## 15. Tax

Implemented in `tax/engine.ts` (`tests/tax-engine.test.ts`, `tests/net-sales.test.ts`), `orders/assemble.ts`. **Engine.** The backend performs the authoritative calculation. **Tax is off by default.** Every rate in code, seeds and tests is fictional. Never present one as a legal rate; never seed a real one without the owner's instruction.

**Rate matching** (`matchTaxRate`, per class, rates never stack)

| Order | Level |
| --- | --- |
| 1 | Exact postcode |
| 2 | City within its prefecture |
| 3 | Prefecture |
| 4 | Country (fallback) |

Only enabled rates of that class. `exempt` is never taxed. No match = untaxed, shown as "no rate", not an error.

**Which line is taxed**

| Case | Result |
| --- | --- |
| `snapshot.enabled` false | No tax anywhere |
| Product `taxStatus` is not `taxable` (`none` or `shipping`) | Line not taxed. Snapshotted as `taxable: false` |
| Class `exempt` | Not taxed |
| No rate for the class at the address | Not taxed |
| Variation has a tax class | It overrides the product's |

**Calculation** (`calculateTax`). Discounts always come before tax.

1. Line amount = subtotal − discount (line + order discount share), capped at 0.
2. Group lines and shipping by the rate that applied.
3. Per rate, tax once on the items and once on the shipping, each half-up:

| Setting | Tax | Total |
| --- | --- | --- |
| Prices exclude tax | `amount × p / 100` | amounts + tax |
| Prices include tax | `amount × p / (100 + p)` | amounts (tax already inside) |

4. Order tax = sum of rate taxes.
5. Each rate's item tax is shared across its lines by largest remainder, giving `lineNet`.
6. Shipping uses the same inclusive or exclusive setting as prices.

Rounding once per rate is deliberate. Fictional example: three lines of 5 at 10 % is 15 × 10 % = 1.5 → 2, not 3.

**Shipping tax.** Only when `shippingTaxable`, at the rate matched for `shippingTaxClass`. A taxable shipping class can't be `exempt`.

**Snapshot.** Built once at order creation by `buildTaxSnapshot`, for the delivery address, or the store's location for pickup. Holds settings and one applied rate per class. All later recalculation uses it. Editing or deleting a rate never changes an order.

**Net sales.** `itemsNet` = items after discounts, excluding tax. Same figure whether prices include or exclude tax (`tests/net-sales.test.ts`). Excludes shipping and shipping tax.

**Saving a rate** (`validateTaxRate`): name 2 to 80; percent 0 to 100, 2 decimals, 0 allowed; class must exist and not be `exempt`; location valid; **one enabled rate per class + location**. Country location only accepts `JP`, see §30.

**Older orders.** Without a snapshot, `recalculate` uses per-class placeholder rates, rounded per class. Only demo data needs this path.

---

## 16. Invoices

Implemented in `orders/invoice.ts` (**Engine**, `tests/invoices.test.ts`), `issueInvoice` in `data/mock-orders.ts`, `src/components/order/invoice-document.tsx`. **Frozen once issued; append-only.**

**Which document next** (`nextInvoiceKind`). The server rejects any other kind.

| Order state | Next |
| --- | --- |
| No documents, not cancelled | `invoice` |
| No documents, cancelled | Nothing |
| Latest is a credit note | Nothing, ever |
| Has a document, order cancelled | `credit_note` |
| Has a document, order changed in a billable way | `revision` |
| Has a document, nothing billable changed | Nothing |

**"Out of date"** (`invoiceOutdated`) compares only: customer name, billing address, each item's product, variation, name, quantity, unit price, discount, fulfilled weight and line total, the order discount, shipping amount, tax class/rate/amount, and `totals.total`.

Not billable: payment status, delivery date, shipping address, shipping label, notes, refunds. **A refund does not make an invoice out of date**, because `totals.total` doesn't change.

| Rule | Detail |
| --- | --- |
| Snapshot | Deep copy of the order, §5.6 in the schema doc. Later edits never change it |
| Reason | Required for revision and credit note, 5 to 300 |
| First number | `<prefix>-<year>-<NNNN>`: highest for that prefix and year + 1. Year in store time, so it restarts each year. Prefix from company settings, default `INV` |
| Revision number | `<first number>-R<n>` |
| Credit note number | `<first number>-CN` |
| `replaces` | The previous document's number |
| `difference` | Revision: new total − previous total. Credit note: 0 − previous total, so negative |
| Listing | Customers see their own documents; `total` is `snapshot.totals.total` |
| Payment | Issuing never changes `paymentStatus` |
| Email | Only if `documents.emailInvoiceOnIssue` |

**The backend must:** generate numbers atomically (the mock scans all numbers); generate the PDF (not built); return documents to their owner only. `nextInvoiceNumber` reads only 4 digits after the prefix, so it breaks past 9999 in a year.

**Known gap.** Seller details (legal name, registration number, tax number, logo, footer, title) are read from **current** company settings when the document is rendered, not from the snapshot. So an issued invoice can change. Freeze them. Whether this document meets any legal invoice format is not established by the code; `docs/backend-api.md` §8 lists it as open.

---

## 17. Delivery schedules and cut-offs

Implemented in `delivery/schedule.ts` (**Engine**, `tests/delivery-schedule.test.ts`), `data/mock-portal.ts`.

**Next delivery dates** (`nextDeliveryDates`), in store time:

| Rule | Detail |
| --- | --- |
| Inactive schedule | No dates |
| Candidates | Regular `deliveryDays` and `extraDates`, looking ahead up to 120 days |
| Excluded | `excludedDates` always win, even over extra dates |
| **Cut-off** | The day **before** delivery at `cutoffTime`. A date is offered only if `orderByDate > today`, or `orderByDate = today` and `nowTime ≤ cutoffTime` |
| At exactly the cut-off | Still allowed: 16:00 with a 16:00 cut-off passes; 16:01 doesn't |
| Same day | Never offered: the cut-off was yesterday |

Example: Tuesday and Friday route, cut-off 16:00, today Monday 2026-11-02. At 10:00 the next date is Tuesday 11-03, order by Monday 16:00. At 16:01 it becomes Friday 11-06.

**Route for an address** (`matchRoute`): active routes only; a route listing the city beats one listing the prefecture. First match in list order.

**Saving** (`saveRoute`): name 2+; at least one area; a delivery day or extra date; `cutoffTime` `HH:mm`; dates `YYYY-MM-DD`. Delete is refused while a campaign uses it.

**Screen rule, must be enforced.** Checkout and order creation **don't use any of this**. `checkDeliveryDate` only requires today or later, within 92 days; staff orders only check the date format. `nextDeliveryDates` feeds the customer portal, the schedule page and reminders only. A customer can request a day with no delivery or past the cut-off. `docs/backend-api.md` §6 says the backend must reject orders after the cut-off with `409`. Implement it. Also decide whether a non-delivery date should be refused, and how walk-in and staff orders are treated; the code doesn't say.

`shippingFee` and `freeShippingThreshold` are legacy. Shipping comes from zones.

**Two links between customers and routes.** `Customer.deliveryRouteId` is set by staff and copied to `order.shipping.deliveryRouteId`. Separately, schedules, the portal and reminders match by address text (`matchRoute`, `inArea`). They can disagree. `inArea` matches either city or prefecture and has no city-over-prefecture preference.

---

## 18. Reminder segmentation

Implemented in `reminders/segment.ts` (**Engine**, `tests/notifications.test.ts`), `buildPreview` and `simulate` in `data/mock-notify.ts`. **Nothing is ever sent in the demo.** The backend runs this in a scheduled job.

**Per customer** (`segmentRecipients`), in order:

| Check | Result |
| --- | --- |
| Status not `approved` | Left out silently |
| No **shipping** address in the route's areas | Left out silently. Billing addresses don't count |
| `remindersOptOut` | Excluded, reason "Turned off reminders" |
| No email | Excluded, reason "No email address" |
| Has a qualifying order | **Group A** (`withOrder`) |
| Otherwise | **Group B** (`withoutOrder`) |

**Qualifying order:** that customer's, open (`isOpenOrder`), shipping address in the area, and its requested delivery date equals the date **or it has no date**. An undated order counts, "so nobody gets 'you have no order' by mistake".

One reminder per customer, however many addresses they have in the area.

**Campaign timing.** `sendOn = delivery date − leadDays` at `sendTime`, using the route's **next** deliverable date. Lead days 0 to 14.

**The backend must also:**

| Requirement | Detail |
| --- | --- |
| Prevent duplicates | One per customer, campaign and date (`db.simulated` is memory only) |
| Honour consent | Re-check opt-out **at the moment of sending** (`segment.ts` header) |
| Honour `enabled` | The demo's `simulate` doesn't check `campaign.enabled` or `sendOn`; it's an admin preview. The real job must |
| Respect templates | Disabled templates send nothing (`logEmail`) |
| Log | Each send as an email log with `campaignId` |

`order_number` in a Group A email is the customer's first qualifying order.

The legacy `Reminder` entity (`types/delivery.ts`) with its free-text `schedule` isn't part of this flow.

---

## 19. Email templates

Implemented in `email/render.ts` (**Engine**, `tests/notifications.test.ts`), `data/mock-notify.ts`, `data/mock-repositories.ts`. **Mock: records a log row, sends nothing.**

| Rule | Detail |
| --- | --- |
| Placeholders | `{{name}}`, optional spaces, `[a-z_]+`. Unknown or missing values stay visible |
| Escaping | **Values are HTML-escaped in bodies**, so customer data can't add markup. Subjects are plain text |
| Saving | Subject 2 to 200; body 2+; only the template's allowed placeholders in either |
| `attachInvoice` | Only effective if the template supports attachments (invoice only) |
| Reset | Restores the seed text |
| Disabled, or no recipient | No log, no send |
| Retry | Only `failed` rows; adds an attempt |

**Triggers today**

| Event | Template |
| --- | --- |
| Application submitted | `customer_registered` |
| Status set to approved | `customer_approved` |
| Checkout placed | `order_confirmation` (not for staff-created orders) |
| Status → preparing | `order_processing` |
| Status → delivered | `delivery_notification` |
| Other status change | `order_status` |
| Refund recorded | `refund` |
| Invoice issued, if `emailInvoiceOnIssue` | `invoice` |
| Reminder run | `reminder_with_order`, `reminder_without_order` |

`password_reset` has a template but no trigger, since no auth exists.

---

## 20. Inventory

Implemented in `orders/stock.ts`, `setStock` and `stockFrom` in `data/mock-catalog.ts`. Tested partly in `tests/order-editing.test.ts`.

| Rule | Detail |
| --- | --- |
| Counted stock | `stock.status` follows the quantity: ≤ 0 out; ≤ threshold low; else in stock. Threshold = product's, else store default (12 in the mock) |
| Status-managed | Set by hand: in or out of stock |
| Variation modes | `parent` shares product stock, and a change affects every option sharing it. `track` own count. `status` own manual status |
| `parent` | Refused when the product doesn't track stock |
| Variable product | Aggregate: best status across active options; quantity only if all are counted |
| Change kinds | Counted accepts a quantity (0 to 1,000,000) or a delta; status-managed accepts a status. The wrong kind is refused |
| Delta floor | `max(0, current + delta)` |
| Unavailable | Archived product, or removed or disabled option: no stock change |
| History | Every change writes a `StockMovement` with source and name |
| Orders | Changing stock from an order page updates the catalog only, never the order |

**Backend must do what the demo doesn't.** The demo **does not reserve or deduct stock when an order is placed** (`types/catalog.ts`, `docs/backend-api.md` §6.7). The cart checks stock at read and checkout; staff orders don't check at all. Required: reserve or deduct atomically at placement, handle races, add movement sources for it, and decide restock on cancellation. The code is silent on when deduction happens (placement or dispatch) and on restocking cancelled orders.

Backorder: `no` blocks out-of-stock and over-stock. `notify` and `allow` both let the order through; no notification exists for `notify`.

---

## 21. Catalog

Implemented in `validation/product.ts` (`validateProduct`, `validateCategory`), `uniquenessErrors` and `publicProducts` in `data/mock-catalog.ts`. Field limits are in the schema doc.

| Rule | Detail |
| --- | --- |
| SKU | Optional on a draft, required to publish. When given, unique across products and variations, case-insensitive. Variations also unique within the product, including the parent SKU |
| Draft | May be incomplete: SKU, price, weight, selling unit and stock may be empty (empty weight and stock count as 0). Name, slug and type are always required, and anything filled in must be valid |
| Publish | Name, type, SKU, selling unit, category, package weight above 0, a valid price on a simple product, stock as a whole number when tracked (a variable product needs its own quantity only when an option shares it), valid order limits (§3). A variable product needs at least one active variation, each with a SKU and price. The same checks run in the editor, on bulk publish and on CSV import (`publishProblems`) |
| Sale | Below regular. Sale dates need a sale price. End ≥ start |
| Variable | At least one variation attribute; at least one variation; up to 100; each with a value per attribute; unique combinations |
| Links | Not self; must exist; up to 20 |
| Category tree | No cycles |
| Duplicate | New draft; unique slug and SKUs (`-copy`, `-COPY`); GTIN cleared; legacy id cleared |
| Archive | Hidden from the store, history kept. Not deleted |

**Public catalog** (`publicProducts`): `published` only; `visible` or `catalog` when browsing, `visible` or `search` when searching; not when **all** its categories are hidden. Direct links work for `hidden` visibility.

**Prices.** Guests and unapproved customers never get prices. Public lists omit them. **Screen rule:** `getBySlug` in the mock returns the whole product including `basePrice` to the server page, and the UI decides what to show. The API must not return it.

**Sanitizing product HTML:** `sanitizeHtml` (no attributes at all), §24.

### Bulk product changes

`planBulkChange` in `src/lib/catalog/bulk.ts` (**Engine**, `tests/product-bulk.test.ts`); `products.bulkChange`. Always previewed first (`apply: false`), then applied.

| Rule | Detail |
| --- | --- |
| Size | At most 200 products per request (`BULK_LIMIT`) |
| Operations | Publish, unpublish (draft), stock status, categories (add, remove, replace), regular price and sale price (set, raise or lower by amount or percent), order limits, archive, delete |
| Per row | Each product is planned on its own: it changes, or it is skipped with a reason. One bad row never blocks the others |
| Publish | Runs the publishing checks; a product that can't be published is skipped with its problems |
| Stock status | Skipped for products that track a quantity ("change the quantity in Inventory instead") |
| Prices | Set, raise or lower (amount or percent), rounded to the currency's minor unit, half-up; never below 0; a sale price must stay below the regular price (a sale price can also be cleared). A variable product changes on each active option that has the price |
| Delete | Only for products never used in an order, quotation or cart; others are skipped ("archive it instead") |
| Capability | `products.edit`; archive and delete need `products.delete` |

### Product CSV import and export

Schema and examples: `docs/PRODUCT-CSV.md`. Rules: `src/lib/catalog/csv.ts`, `csv-import.ts` (**Engine**, `tests/product-csv.test.ts`).

| Rule | Detail |
| --- | --- |
| Limits | 1,000 rows, 2 MB per file |
| Matching | A row with an `ID` updates that product; else a `SKU` that exists updates it; else it creates a new product |
| Updates | Only cells with a value change. Empty cells keep what's saved |
| New products | Created as drafts unless the row says `published` and passes the publishing checks |
| Variations | `Type` = `variation` with a `Parent SKU` (a variable product in the file or the store) |
| Duplicates | The same SKU or ID twice in one file: the later row is skipped |
| Problems | A product with any problem is skipped with its variation rows, and the row says why. Other rows still import |
| Two steps | Check (`apply: false`) shows every row's result; import repeats the checks |
| Export | The list's filters or the selected ids; chosen columns; product rows followed by their variation rows; a template with example rows. Cells starting with `= + - @` are prefixed with `'` (spreadsheet formula guard) |
| Capability | Import needs `products.create` and `products.edit`; export needs `products.export` |

---

## 22. Customers and approval

Implemented in `customers/status.ts` and `customers/contact.ts` (**Engine**, `tests/customer-rules.test.ts`), `data/mock-customers.ts`, `validation/registration.ts`, `validation/customer.ts`, `validation/documents.ts`.

**Deleting:** needs `customers.delete`. Refused once the customer has an order: suspend them instead. Otherwise it removes the account for good. The demo also protects its own two sample sign-in accounts.

**Status flow**

| From | To | Reason |
| --- | --- | --- |
| `pending` | `approved` | Optional |
| `pending` | `rejected` | **Required**, 5 to 300 |
| `approved` | `suspended` | **Required**, 5 to 300 |
| `suspended` | `approved` | Optional |
| `rejected` | `approved` | Optional |
| `rejected` | `pending` | Optional |

Any other change is refused. Each appends a status event. `approvedAt` is set once.

**What status means** (`accountStatusHelp`)

| Status | Effect |
| --- | --- |
| `pending` | No wholesale prices, no ordering |
| `approved` | Prices and ordering |
| `rejected` | Can't sign in to order; can be reopened or approved |
| `suspended` | Blocked from ordering. **Existing orders are unaffected** |

Only `approved` passes: price rules, cart, checkout, staff order creation, order customer search, quotation requests.

**Application** (`validateRegistration`): company 2 to 120; business type from a fixed list; contact 2 to 200; valid email and phone; address fields; message ≤ 1000; `acceptTerms` true. Creates a `pending` customer with the business address as default delivery and billing, and the message stored in `internalNote`. **No login exists yet**; the backend must create the account, verify email and rate-limit.

**Uploaded documents** (`validateDocuments`): optional; one per kind; up to 4 MB; **type detected from the file's first bytes**, never the browser's type or extension; JPEG, PNG, WebP or PDF. File names sanitized. Private storage, staff-only access, never cached. The backend adds virus scanning and retention rules.

**Staff quick add:** company + phone or email; status `pending` or `approved`; approving at add needs the approve permission.

**Formats** (`customers/contact.ts`): JP phone is domestic `0…` with 10 or 11 digits, or `+81` without the 0. Postcode `NNN-NNNN`, dash optional on input, normalised for storage (`normalizePostcode`). Rules are per store country, with a generic fallback. Every postcode input takes its length limit, keyboard and allowed characters from `postcodeInput()` (JP: 8 characters, digits and dash), so no field cuts off a valid postcode.

**Scoping.** Every customer-facing read must be limited to the signed-in customer, and return 404 for others' records (`docs/backend-api.md` §1). In the demo, `getPortalCustomerId` always returns a demo customer.

Customers can edit their profile (`updateProfile`, validated in `src/app/account/actions.ts`) and addresses, including `remindersOptOut`. Staff-only: group, route, notes, status.

---

## 23. Quotations and saved lists

Implemented in `data/mock-portal.ts`. **Mock, no tests.**

**Quotation flow**

| Step | Rule |
| --- | --- |
| Request | Approved customers. At least one line with quantity > 0; each must be orderable; note ≤ 1000. Status `requested`; names and SKUs snapshotted |
| Quote | Staff, from `requested` or `quoted` (re-quote allowed). Price every line; valid-until today or later |
| Decline | Staff, from `requested` or `quoted`. Reason of 3+ characters → `declined` |
| Reject | Customer, from `quoted` → `rejected` |
| Accept | Customer, from `quoted`, not expired. Needs a delivery address and a payment method (below). Creates an order |
| Expire | A `quoted` quote past `validUntil` becomes `expired` when next read. **No job does this**; the backend can run one or compute it |

**Accepted order:** created through normal order creation, so quantity limits and approval apply. Unit prices are the quoted ones (never re-priced). Shipping is `manual`, amount 0, label "To be confirmed". Addresses are the customer's defaults. If order creation fails, the quote stays `quoted`.

**Payment method on accept:** the customer chooses from the methods checkout offers right now (`payments.checkoutMethods()`: enabled and fully set up). No method is pre-selected or forced. With exactly one method it is used; with several the customer must choose; with none the quote can't be accepted online and the screen says so. A method that isn't available (disabled, not set up, or unknown) is refused. The order is created **unpaid** (waiting for payment): choosing a method never marks it paid.

Quoted prices are checked only as finite and ≥ 0, not with `isValidAmount`. Use `isValidAmount`.

**Saved lists:** owned by one customer; name 2 to 60; quantity ≥ 1; same product and option merges. Lines show live details and the customer's current price; unavailable ones say why. Add to cart goes through normal cart rules and reports skipped lines.

---

## 24. Publishing and website content

Implemented in `content/rules.ts`, `content/menu.ts`, `html/sanitize.ts` (**Engine**, `tests/cms.test.ts`, `tests/sanitize-html.test.ts`), `data/mock-content.ts`, `validation/site-content.ts`. More in `docs/CMS-AND-CONTENT-MANAGEMENT.md`.

**Live** (`isLive`): `published`, or `scheduled` with `publishedAt` ≤ now. Drafts and trash are never live. **Public endpoints must return nothing else.** There's no job; compute at read or run one.

| Rule | Detail |
| --- | --- |
| Publish | Body must have text after sanitizing. Posts also need a category |
| Schedule | `publishedAt` required and in the future |
| Publish date | Publishing keeps an existing past `publishedAt`, else stamps now |
| Trash | Remembers the previous status. Restore returns to it, else draft |
| Delete | Only from the trash |
| Slug | Lowercase letters, digits and hyphens |
| Page slugs | Unique among pages; not reserved: `about, account, admin, api, application-pending, blog, cart, checkout, contact, forgot-password, login, reset-password, media, preview, register, shop` |
| Post slugs | Unique among posts; may use reserved words since they live under `/blog` |
| Title, excerpt | 2 to 160; ≤ 300 |
| SEO | Title ≤ 70; description ≤ 200; canonical `http(s)://`; OG image `https://` or site-relative |
| Reading time | Words ÷ 200, rounded, minimum 1 |

**Page visibility: screen rule.** A `customers` page is hidden by the page component (`src/app/(store)/(pages)/[slug]/page.tsx`). The backend must return 403 or 404 to anyone but an approved customer.

**Sanitize on save: the backend must.** The frontend also sanitizes at render, as a second layer.

| Function | Allowed |
| --- | --- |
| `sanitizeHtml` (product text) | `p br strong em u s small sub sup ul ol li h2–h6 blockquote hr table thead tbody tr th td`. **All attributes dropped** |
| `sanitizeRichHtml` (pages, posts) | The same plus `a` and `img` |
| `a href` | `http(s):`, `mailto:`, `tel:`, site-relative, `#`. Checked after decoding entities and stripping whitespace and control characters. `http(s)` links get `rel="noopener noreferrer"` |
| `img src` | `http(s):` or site-relative; otherwise the image is removed. `alt` kept, escaped |
| `style` | Only `text-align` left, center, right or justify, on `p h2–h6 td th` |
| Removed with content | `script style iframe object embed noscript template svg math textarea select button form head title` |
| Other | Unknown tags dropped, text kept. `h1` → `h2`, `b` → `strong`, `i` → `em`. Comments removed. Output balanced and idempotent |

`tests/cms.test.ts` and `tests/sanitize-html.test.ts` hold attack strings to reuse.

| Reusable block marker | `div` kept only as `<div data-block="blk-…" data-name="…"></div>` (id matching `^blk-[a-z0-9-]{1,40}$`, name escaped, content dropped) or as the render wrapper `<div data-block-kind="announcement|banner|cta|contact|productPromo">`. Any other `div` is dropped, text kept |

### Revisions, autosave and reusable blocks

Rules in `src/lib/content/revisions.ts` and `src/lib/content/blocks.ts` (**Engine**, `tests/cms-revisions-blocks.test.ts`); store in `data/mock-content.ts`. More in `docs/CMS-AND-CONTENT-MANAGEMENT.md`.

| Rule | Detail |
| --- | --- |
| Revision kept | On every save of a page or post whose content changed (title, address, body, excerpt, images, SEO, visibility, categories, tags). A status-only change adds none |
| First history | The first save of an item with no history also keeps the version it replaced ("Original version") |
| Limit | The newest 25 per item; older ones are deleted. Deleting the item for good deletes its history |
| Restore | Puts a revision's content back, keeps the item's status and publish date, validates like a save (the address may be taken now), and is recorded as a new revision. Refused for an item in the trash. On a live item the screen asks first |
| Compare | Field by field, word diff of the text (markers shown as "[Reusable block: name]"); a change in formatting or links only is still reported |
| Autosave | While editing, at most every 8 seconds when there are unsaved changes. Kept apart from the item: **never changes what visitors see**. Offered back when newer than the last save; saving or discarding removes it. One per user per item (the demo keeps one per item). A new, never-saved item autosaves in the browser only |
| Live content | Updating a published item, switching it to draft, or restoring a revision on it asks for confirmation first |
| Block | Name 2 to 80, unique case-insensitive; type one of announcement, banner, call to action, contact, product promotion; content required, at most 50,000 characters, sanitized like page content; block markers removed (no nesting) |
| Using a block | Pages and posts store only the marker. When shown, each marker becomes the block's current content, so editing a block updates every page using it. A missing block shows nothing |
| Deleting a block | Refused while any page or post outside the trash uses it; the message names them |

**Terms:** 2 to 40 characters, unique case-insensitive. Renaming updates every post. A category can't be deleted while a live post has only that category.

**Media:** JPEG, PNG, WebP or PDF, 4 MB, detected from content. SVG refused. Served with `nosniff`, PDFs as attachments (`docs/CMS-AND-CONTENT-MANAGEMENT.md`). Deleting a file in use only warns; the backend decides. Scanning and image sizes are the backend's.

**Menus** (`validateMenu`): name 2+; up to 3 levels; label 1 to 60; custom URLs `http(s)`, `mailto`, `tel`, site-relative or `#`; page and category items need a target; no nesting inside itself. One menu per location; taking one moves the other to `none`. **Resolved form** (`resolveItems`): links to non-live pages disappear; a parent with live children stays as a heading.

**Homepage** (`validateSiteContent`): top bar ≤ 120; section ids unique; titles required on most section types; counts 1 to 24; links `http(s)`, site-relative or `#`; an enabled hero needs a slide; About needs a title.

---

## 25. Roles and lockout protection

Implemented in `auth/capabilities.ts` (**Engine**, `tests/roles-reports.test.ts`), `data/mock-staff.ts`, `src/app/admin/staff-actions.ts`. The file header says it plainly: "on the frontend these only decide what the screen shows and what the demo's server actions accept. They are not security. **The backend must check the signed-in user's capabilities on every protected operation.**"

**Built-in roles** (`DEFAULT_ROLES`, also the role templates)

| Role | Scope |
| --- | --- |
| Administrator | Everything |
| Shop Manager | Everything except `staff.*`, `roles.*`, `company.*` |
| Order Manager | Every order permission except `order_stock.edit`; view customers, products, inventory; invoices view and create; quotations |
| Warehouse Staff | View orders, products, invoices, quotations; delivered weight; inventory; stock from an order |
| Content Editor | Pages, posts, media, menus, homepage |
| Customer Support | View orders; edit orders including status, products, quantities, addresses; see refunds; view invoices; quotations; view and edit customers; approval; view emails |

All six have `dashboard.view`. **B2B Customer** isn't a staff role and has no admin access.

**Lockout and escalation rules**

| Rule | Function | Detail |
| --- | --- | --- |
| Administrator is protected | `roleEditError`, `saveRole` | Removing a capability, renaming it or changing its description is refused |
| No locking yourself out | `selfLockoutError` | Removing `roles.manage` from the role you're using is refused |
| Built-in roles can't be deleted | `roleDeleteError` | Duplicate one instead. They can be edited, except Administrator |
| Roles in use can't be deleted | `roleDeleteError` | Reassign staff first |
| Last administrator | `staffChangeError` | Refused if the change would leave no **active** administrator: removing, demoting or deactivating |
| No escalation | `escalatedCapabilities` | Can't grant a capability you don't have, in a role or by assigning a role. Only what the role **gains** counts, so keeping one you lack is fine |
| Nobody above you | `staffTargetError` | Can't change or remove someone whose role has permissions you lack |
| Unknown capability | `validateRole` | Refused |

**Each action checks its own capability.** The older coarse permissions and the `LEGACY` map are gone. The full list, and which capability each order change needs, is in `ROLES-AND-CAPABILITIES.md`.

| Action | Capability |
| --- | --- |
| Order changes | One per field; see `ROLES-AND-CAPABILITIES.md` |
| Create an order with a changed price or a discount | Also `order_prices.edit` or `order_discounts.edit` |
| Issue invoice | `invoices.create` |
| Invoice settings | `invoices.manage`. Changes only the document settings |
| Quotations | `quotations.edit` |
| Media | `media.view`, `.create`, `.edit`, `.delete` |
| Shipping, including rules, classes, pickup, settings | `shipping.manage` |
| Delivery, reminders, email | `delivery.manage`, `reminders.manage`, `emails.manage` |
| Pages, posts, terms | `pages.*`, `posts.*`. Trash, restore and delete need `.delete` |
| Menus, homepage | `menus.edit`, `homepage.edit` |
| Coupons | `coupons.*` |
| Products, categories | `products.*`. Archive needs `.delete`; duplicate needs `.create` |
| Customer groups | `customers.edit` |

**Warnings in the Role Editor** (`permissionWarnings`) don't stop a save. A permission without what it depends on is flagged with a one-click fix; a role with no permissions, no dashboard, or `order_stock.edit` without `inventory.edit` is flagged too.

**Route map** (`capabilityForPath`): the most specific match wins, and `*` stands for one path segment. Screen rule only.

**Staff saving:** name 2+; valid email, unique case-insensitive; role must exist. Role name 2 to 60, unique case-insensitive.

---

## 26. Reports

Implemented in `reports/aggregate.ts` (**Engine**, `tests/roles-reports.test.ts`), `orders/net-sales.ts`, `data/mock-analytics.ts`. "The backend should compute the same definitions in the database."

| Figure | Definition |
| --- | --- |
| Base set | Non-cancelled orders with `placedAt` in the inclusive range. Cancelled orders count only in status counts |
| Total sales | Sum of `totals.total`. **Not reduced by refunds** |
| Net sales | Sum of `itemsNet`, else `itemsTotal`. Excludes tax and shipping. **Not reduced by refunds** |
| Orders | Count |
| Average order value | Net sales ÷ orders, rounded |
| Customers | Distinct customers with an order in range. Walk-ins not counted |
| New customers | Their first non-cancelled order ever falls on or after `from` |
| Returning | Customers − new |
| Repeat orders | Orders in range from a customer with an earlier non-cancelled order |
| Discounts | Sum of `discountTotal`, coupon included |
| Coupon discounts | Sum of `coupon.amount` |
| Refunds | Sum of `refundedTotal`. Overpayment refunds excluded |
| Shipping, tax | Sum of totals |

Breakdowns by product, category (top-level parent of the first category), customer, group ("Walk-in", "No group"), location (prefecture, else "Store pickup"), month. Each adds up to net sales.

**CSV export** (`toCsv`): quotes where needed; text starting with `=`, `+`, `-`, `@`, tab or CR gets a leading `'` to neutralise spreadsheet formulas. Numbers untouched. Keep this, since values come from customers.

Customer list `totalSpend`: sum of `netTotal`, non-cancelled. Dashboard revenue: net sales, same basis.

---

## 27. Company settings

Implemented in `validation/company.ts` (`tests/company-settings.test.ts`), `data/mock-company.ts`, `docs/WHITE-LABEL-ARCHITECTURE.md`. **One company per deployment.**

| Rule | Detail |
| --- | --- |
| Validate against the saved country | Phone, postcode and region follow the country being saved, not the active one |
| Colours | `#rrggbb` only: they reach a style tag |
| Fonts | From `FONT_OPTIONS` only |
| Social links | `https://` only |
| Time zone, locales | Must be valid IANA and BCP 47 values |
| Digits | 0, 2 or 3 |
| Invoice prefix | `^[A-Z0-9]{1,10}$` |
| Public data | The response reaches the browser. No secrets. Revalidate caches after an update |
| Setup | `completedAt` set only by the wizard |

---

## 28. Contact form and rate limits

`validation/contact.ts` (`tests/contact-form.test.ts`): name 2 to 120; company ≤ 200; email required; phone checked if given; topic from the list; message 10 to 2000.

**Backend must add**, as the code comments require: rate limiting and bot protection on the contact form and applications, and on login (`docs/backend-api.md` §1). Emailing the team is also the backend's.

---

## 29. What the frontend check does not protect

Every item below appears to work in the demo. **None is real protection until the backend enforces it.**

| Rule | Today | File |
| --- | --- | --- |
| Authentication | None. A cookie picks the viewer | `auth/session.ts` |
| Every admin permission | Screen and demo action only | `auth/capabilities.ts` |
| Customer sees only own data | Optional parameter; always the demo customer | `data/repositories.ts`, `auth/session.ts` |
| Wholesale price visibility | UI hint (`canSeeWholesalePrices`) | `auth/session.ts` |
| Account status on cart and checkout | Mock checks; session not real | `auth/session.ts` |
| `customers` pages | Page component | `src/app/(store)/(pages)/[slug]/page.tsx` |
| Route cut-off and delivery days | **Not enforced anywhere** at checkout | `orders/cart.ts`, §17 |
| Stock reservation and deduction | **Not done** | §20 |
| Stock check on staff orders | **Not done** | `data/mock-orders.ts` |
| Coupon limits under concurrency | Not atomic | `data/mock-coupons.ts` |
| Number sequences | Max + 1 | `data/mock-orders.ts`, `orders/invoice.ts` |
| Idempotency | Process memory | `data/mock-orders.ts` |
| Reminder duplicates and consent at send | Memory; no job | `reminders/segment.ts` |
| Scheduled publishing, quote expiry | Computed at read | `content/rules.ts`, `data/mock-portal.ts` |
| HTML sanitizing on save | Mock runs it; render is a second layer | `html/sanitize.ts` |
| Upload scanning, private document storage | Memory only | `data/mock-customers.ts`, `data/mock-media.ts` |
| Rate limits, bot protection | None | `validation/contact.ts`, `validation/registration.ts` |
| Password policy | Form check; nothing stored | `validation/password.ts` |
| Payment processing, payment confirmation | None. "This site collected no money" | `data/mock-orders.ts` |
| Refund processing | Recorded only | `orders/refund.ts` |
| Email sending | Log rows only | `data/mock-notify.ts` |
| Client previews of totals | For display only; the server must recalculate | `orders/assemble.ts` |

**Never accept from a client:** prices at checkout, totals, tax, shipping amounts on a customer order, `paymentStatus`, `amountPaid`, the online connection state, `usedCount`, order and invoice numbers.

---

## 30. Inconsistencies found in the code

Decide these with the product owner; don't copy them blindly.

| # | Finding | Files |
| --- | --- | --- |
| 1 | Credit note number. Code and tests: `<number>-CN`. Type comment: `CN-2026-0007` | `orders/invoice.ts`, `types/order.ts` |
| 2 | Order item quantity limit is 10,000, but carts and rules allow 100,000. A cart line above 10,000 fails only at order creation | `validation/order.ts`, `orders/cart.ts`, `pricing/engine.ts` |
| 3 | Sale price comments say "only when no rule applies"; the engine uses the lower of the two | `types/pricing.ts`, `pricing/engine.ts` |
| 4 | Bank routing number must be 9 digits, but the type comment describes a 7-digit Japanese bank + branch code | `payments/methods.ts`, `types/payment.ts` |
| 5 | Seed account number `Ordinary 1234567` fails the validator's digits-only regex, so the seeded bank details can't be re-saved unchanged | `data/mock/payments.ts`, `payments/methods.ts` |
| 6 | Leftovers from another country: `vatRegistrationNumber` message mentions BIN; Bangladesh rules in contact checks | `validation/customer.ts`, `customers/contact.ts` |
| 7 | `soldIndividually` is stored but never enforced | `types/catalog.ts`, `orders/cart.ts` |
| 8 | `step` is checked in the cart, not on staff order creation or edits, and the product form can't edit it | `orders/cart.ts`, `data/mock-orders.ts`, `data/mock-catalog.ts` |
| 9 | `setStatus` and its action accept `published` without running publish validation. Screens only send `draft` and `archived` | `data/mock-catalog.ts`, `src/app/admin/products/actions.ts` |
| 10 | Timestamps: `new Date().toISOString()` is UTC, yet `withinDates` and reports slice the first 10 characters as a store-local date | `data/mock-orders.ts`, `data/mock-utils.ts`, `reports/aggregate.ts` |
| 11 | Price rule `priority`: higher wins. Shipping rule `priority`: lower wins | `pricing/engine.ts`, `shipping/rules.ts` |
| 12 | `netTotal` on an order includes tax; on `TaxCalculation` it excludes tax | `types/order.ts`, `tax/engine.ts` |
| 13 | `order.shipping.taxClass` is hard-coded `standard`, while tax uses `settings.shippingTaxClass`. Only the older calculation path reads the former | `data/mock-orders.ts` |
| 14 | Tax country location and the mock's address country are `JP` only, while company settings allow other countries | `tax/engine.ts`, `data/mock-customers.ts`, `src/app/admin/orders/actions.ts` |
| 15 | Quoted prices and coupon, shipping class, pickup and shipping rule amounts skip `isValidAmount`, so decimals pass for JPY | `data/mock-portal.ts`, `coupons/engine.ts`, `data/mock-shipping.ts`, `shipping/rules.ts` |
| 16 | A quote's accepted order always uses `bank_transfer`, even if that method is disabled | `data/mock-portal.ts` |
| 17 | `recordPayment` writes the amount only into a note; nothing records a payment amount | `data/mock-orders.ts` |
| 18 | A credit note's snapshot holds the order's totals, and the invoice list row's `total` is `snapshot.totals.total`, a positive figure; only `difference` is negative | `data/mock-orders.ts`, `data/mock-portal.ts` |
| 19 | `net-sales.ts` says net sales exclude "refunds of shipping", but no refund is subtracted at all | `orders/net-sales.ts`, `reports/aggregate.ts` |
| 20 | `tests/order-stock.test.ts` is cited in `orders/stock.ts` but doesn't exist; those cases are in `tests/order-editing.test.ts` | `orders/stock.ts` |
| 21 | `docs/backend-api.md` still has older values: BDT, `Asia/Dhaka`, "prices are excluding VAT", integer paisa, placeholder VAT percentages, and a contact form "not built". The code wins. §6's business rules are otherwise close | `docs/backend-api.md` |

### Status of these findings

Reviewed on 2026-11-05, after the table above was written.

**Fixed in the frontend, so the table's description no longer applies:**

| # | Change |
|---|---|
| 1, 3, 4, 19, 20 | Comments now match the code |
| 2 | Carts now stop at 10,000 per line, the same as orders |
| 4, 5 | Bank codes accept 5 to 20 digits for any country, and the seed passes its own validator |
| 6 | The registration number message no longer names one country. Bangladesh stays as one entry in the per-country phone table, which is deliberate, as the white-label check uses it |
| 10 | Date filters and reports now use the store's calendar day for UTC stamps |
| 14 | Addresses and country-wide tax rates now use the store's country, and the tax engine has no country of its own. Browser-tested by switching the store to Bangladesh |
| 15 | Coupons, quoted prices, class surcharges, pickup fees and rule amounts follow the currency's decimals |
| 21 | `backend-api.md` is marked as superseded. Its text still has the older values |

Also fixed, from the wider review:

- Order changes now need the capability matching the change, so Warehouse can record a weight and can't change a price, and Support can edit an order. See `ROLES-AND-CAPABILITIES.md`.
- You can't assign a role with more permissions than your own.
- Issued invoices keep the seller's details from the day of issue.
- The product and category forms now offer every category, not the first 48. Found in browser QA.

**Still open, for a decision or for the backend:** 7 (sold individually isn't enforced), 8 (`step` on staff orders and in the product form), 9 (publish validation on the status call), 11 (priority direction differs, documented), 12 (`netTotal` naming), 13 (shipping tax class field), 16 (quote acceptance payment method), 17 (payment amounts), 18 (credit note totals sign). See also `BACKEND-PENDING-FEATURES.md`.
