# Database requirements

For the backend developer. Framework-neutral: no Laravel or Django syntax, no migrations. It says what must be stored, not how to name your tables.

**Status.** No database exists. All data is in-memory mocks on the Next.js server (`src/lib/data/mock*`), behind the interfaces in `src/lib/data/repositories.ts`. The rules that act on this data are in `docs/BUSINESS-RULES.md`. The HTTP contract is in `docs/backend-api.md`, which is partly out of date (see §9).

**Source of truth.** The types in `src/lib/types/*.ts`, then the validators in `src/lib/validation/*.ts` and the pure engines. JSON field names must match the types exactly (camelCase). Column names are your choice. Paths are relative to `src/lib/` unless they start with `src/` or `docs/`.

**How to read the tables**

| Marker | Meaning |
| --- | --- |
| `money` | See §1. Amount in the store currency |
| `enum(a, b)` | Closed list. The frontend switches on these values |
| `json` | Nested value in the TypeScript type. You may normalise it, as long as the API returns the same shape |
| `opt` | Optional. The frontend treats a missing value and `null` the same (`docs/backend-api.md` §1) |
| **SNAP** | Snapshot: copied at a point in time and never re-read from its source |
| *Proposed* | Not in the code. A suggestion, so the code cannot confirm it |

---

## 1. Common types

| Type | Definition | Source |
| --- | --- | --- |
| ID | Opaque string in JSON. May be numeric in the database | `types/common.ts` |
| `money` | JSON number in **major units** of the store currency, with at most `currencyDigits` decimals (0 for JPY, so whole yen) | `types/common.ts`, `orders/calc.ts` |
| `percent` | 0 to 100, at most 2 decimals. The engines convert it to whole basis points | `isValidPercent` in `orders/calc.ts` |
| `datetime` | ISO-8601 with offset, e.g. `2026-09-30T09:00:00+09:00` | `types/common.ts` |
| `date` | `YYYY-MM-DD`, a calendar date in the store time zone | `DateBounds` in `data/repositories.ts` |
| `time` | `HH:mm`, 24 hour, store time | `saveRoute` in `data/mock-portal.ts` |
| `weight` | `{ value: number, unit: "g" \| "kg" }`. Calculations convert to whole grams | `types/common.ts`, `toGrams` in `orders/calc.ts` |
| `image` | `{ src, alt, width, height }`. URL or path, never base64 | `ProductImage` in `types/catalog.ts` |
| `actor` | `{ id, name, role: admin \| customer \| system }`. **SNAP**: the name is kept as it was | `Actor` in `types/order.ts` |
| `legacyWooId` | Optional int on most catalog and customer records. Maps migrated data; no logic uses it | `LegacyRef` in `types/catalog.ts` |

---

## 2. Financial precision

Reference: `src/lib/orders/calc.ts`, `src/config/currency.ts`, `locale.currencyDigits` in `src/lib/types/company.ts`.

| Rule | Detail |
| --- | --- |
| Storage | Never a binary float. *Proposed:* integer minor units or an exact decimal with enough scale for 3 digits. The API still sends major-unit numbers |
| Arithmetic | Integer minor units only. `calc.ts`: "Never add/multiply Money floats directly" |
| Precision source | `company.locale.currencyDigits`: `0`, `2` or `3`. 1 yen is the minor unit for JPY |
| Rounding | Half-up, once per calculated value, using exact integer division: `(n × 2 + d) / (d × 2)` |
| Rates | Basis points: `round(percent × 100)`, so 12.5 % and 7.5 % stay exact. Store at 2 decimals |
| Negative input | `toMinor` rounds the magnitude, then restores the sign. `toMinor(-19.99)` gives `-20` at 0 digits (`tests/order-calc.test.ts`) |
| Valid amount | `isValidAmount`: finite, ≥ 0, no more decimals than the currency allows |
| Currency change | Relabels amounts and changes rounding; it never converts. A live store needs a data migration (`currency.ts`). If you store integer minor units, a change of digits also changes what stored integers mean |

**Where rounding and allocation happen.** Reproduce each of these exactly, or totals will differ from what the screens preview.

| Value | Method | File |
| --- | --- | --- |
| Weight-priced line subtotal | `unitPrice × qty × fulfilledGrams / orderedGrams`, half-up | `lineAmounts`, `orders/calc.ts` |
| Percent price rule | `base × (10000 − bp) / 10000`, half-up per unit | `adjustedPrice`, `pricing/engine.ts` |
| Percent order discount | `itemsTotal × bp / 10000`, half-up | `orderDiscountAmount`, `orders/calc.ts` |
| Order discount per line | Largest remainder, ties to the earlier line, shares sum exactly | `allocateMinor`, `orders/calc.ts` |
| Percent coupon | `eligibleTotal × bp / 10000`, half-up, then largest remainder across lines | `evaluateCoupon`, `coupons/engine.ts` |
| Tax | Per rate, once on items and once on shipping, half-up | `calculateTax`, `tax/engine.ts` |
| Tax per line | Largest remainder across the rate's lines | `calculateTax`, `tax/engine.ts` |
| Refund shares | Order total split across lines and shipping by largest remainder | `grossShares`, `orders/refund.ts` |

**Stored order money fields are derived.** `lineSubtotal`, `lineTotal`, `lineNet`, `taxes` and `totals` are recalculated from inputs by `recalculate` in `orders/assemble.ts` on every change. Store them for listing and reporting. Never accept them from a client.

---

## 3. Invariants

The database design must make these hard to break.

| # | Invariant | Where it shows in the code |
| --- | --- | --- |
| 1 | **Agreed prices are preserved.** `OrderItem.unitPrice` is the agreed price. It never follows the catalog. Catalog and rule edits never rewrite an order | `snapshotItem` in `data/mock/orders.ts`, comments in `types/order.ts` |
| 2 | **Original item details are preserved.** Name, SKU, options, unit label, tax class, taxable flag, priced-by-weight flag, catalog price, ordered weight and the price rule outcome are copied at order time. `productId` and `variationId` are links only, "never re-read for display or totals" | `OrderItem`, `OrderItemPricing` |
| 3 | **Changes to an item are recorded.** Edits overwrite the item's current values and append before/after to `adjustments` (append-only). In the demo a removed line leaves `order.items`, and only the adjustment keeps its name and values. *Proposed:* keep removed and replaced rows flagged, so SKU and snapshot details survive | `applyEdit` in `data/mock-orders.ts` |
| 4 | **Payment status is separate from fulfilment status.** `status` and `paymentStatus` are two fields. No status change sets the other. An order can be delivered and unpaid, or paid and cancelled | `updateStatus`, `recordPayment` in `data/mock-orders.ts` |
| 5 | **Invoices are frozen once issued.** A deep copy of the order, append-only, never rewritten. Changes need a revision; cancellation needs a credit note. See the exception in §9 (seller details) | `invoiceSnapshot` in `orders/invoice.ts` |
| 6 | **Shipping on an order is a snapshot.** The saved amount never changes when zones or rules change. It changes only through an audited staff edit | `ShippingCharge`, `types/order.ts` |
| 7 | **Tax on an order is a snapshot.** Settings and matched rates are frozen; recalculation reads the snapshot, never current rates | `OrderTaxSnapshot`, `snapshotTax` in `orders/assemble.ts` |
| 8 | **Coupon discounts stay apart from staff discounts.** The coupon is recorded on the order as code + amount and spread into line discounts. The staff discount has its own record with a reason and actor | `Order.coupon`, `Order.discount` |
| 9 | **History is append-only:** status events, order adjustments, refunds, invoices, account status events, stock movements, quotation events | `types/order.ts`, `types/customer.ts`, `types/catalog.ts`, `types/portal.ts` |
| 10 | **Referenced records are not hard-deleted.** Customers are never deleted because orders reference them (`mock-customers.ts`). Products are archived, "keep history" (`data/repositories.ts`) | as cited |
| 11 | **Carts hold no prices.** Product, option and quantity only; prices are resolved on every read | `data/mock-cart.ts` |
| 12 | **No card data, no gateway secrets** in the frontend. Payment provider credentials stay on the backend, and the frontend sees only the connection state | `types/payment.ts` |

---

## 4. Relationships at a glance

```
role 1─* staff user            customer_group 1─* customer 1─* address
customer 1─* customer_user?    customer 1─* customer_document
category (tree) *─* product    brand *─* product    tag *─* product
product 1─* variation          product 1─* product_attribute *─? attribute 1─* attribute_value
shipping_class 1─* product, variation
product, variation 1─* stock_movement
customer 1─1 cart 1─* cart_line     customer 1─* saved_list 1─* saved_list_item
customer 0..1─* order 1─* order_item, status_event, note, adjustment, refund, invoice
order 1─1 tax snapshot    order 0..1─1 coupon snapshot    coupon 1─* coupon_usage
customer 1─* quotation 1─* quotation_item, quotation_event     quotation 0..1─1 order
shipping_zone 1─* zone_location, shipping_method 1─* rate_tier, class_adjustment
shipping_rule *─* shipping_zone     shipping_method ?─1 pickup_location
delivery_route 1─* reminder_campaign 1─* email_log
page, post, media, navigation_menu 1─* menu_item (tree)
company_settings, tax_settings, shipping_settings, email_sender, site_content: single rows
```

---

## 5. Entities

### 5.1 Identity and access

**Users.** No user type exists in the code. There is no login, session or password store (`src/lib/auth/session.ts`, labelled mock only). The shape below comes from the login response proposed in `docs/backend-api.md` §2.

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | |
| email | string | Login name. *Proposed:* unique, case-insensitive |
| passwordHash | string | *Proposed.* Form rule: 8 to 200 characters (`validation/password.ts`); "the backend owns real password policy" |
| name | string | |
| role | enum(customer, admin) | |
| customerId | ID, opt | Customers only |

Unclear in the code: whether one customer can have several logins. `docs/backend-api.md` shows one user per customer and `Customer` has a single contact.

**Staff** (`StaffMember`, `types/staff.ts`). May be the admin-side profile of a user.

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | |
| name | string | At least 2 characters |
| email | string | Valid; unique case-insensitive across staff |
| roleId | ID → role | Must exist |
| active | bool | |
| createdAt | datetime | |

Protection rules: last active administrator and role deletion, see `BUSINESS-RULES.md` §25.

**Roles** (`Role`, `types/staff.ts`)

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | The built-in administrator id is `role-administrator` |
| name | string | 2 to 60 characters; unique case-insensitive |
| description | string | |
| system | bool | Built-in roles can't be deleted |
| capabilities | list of permission strings | Deduplicated on save |
| updatedAt | datetime | |

Six built-in roles are seeded from `DEFAULT_ROLES` in `src/lib/auth/capabilities.ts`. **One-time migration:** when moving stored roles to the current capabilities, run `upgradeCapabilities` once per role (`ROLES-AND-CAPABILITIES.md`). `pricing.delete` no longer exists.

**Permissions.** Strings in the form `module.action`, generated from `MODULES` in `capabilities.ts`. Actions: `view, create, edit, delete, approve, export, refund, manage`. There is no permission entity in the code. A constant list is enough unless you need one; unknown strings must be refused on save (`validateRole`).

### 5.2 Customers

**Business customers** (`Customer`, `types/customer.ts`)

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | Deleted only if the customer has no orders |
| companyName | string | 2 to 120. The only required name |
| contactName | string, opt | Up to 200 |
| email | string, opt | At least one of email or phone is required. Up to 200 |
| phone | string, opt | Per store country (`customers/contact.ts`) |
| businessType | string, opt | Up to 200. Application form uses `BUSINESS_TYPES` in `validation/registration.ts` |
| tradeLicenseNumber | string, opt | Up to 200 here, up to 100 in the application form |
| vatRegistrationNumber | string, opt | Regex `^[\d-]{9,15}$`, see §9 |
| status | enum(pending, approved, rejected, suspended) | Flow in `customers/status.ts` |
| groupId | ID → group, opt | One group per customer |
| deliveryRouteId | ID → route, opt | |
| internalNote | string, opt | Up to 1000. Staff only; never returned to the customer |
| remindersOptOut | bool, opt | Set by the customer |
| createdAt, updatedAt | datetime | |
| approvedAt | datetime, opt | Set on first approval and kept after |

Uniqueness: email case-insensitive; phone by digits, with a leading `81` normalised to `0` (`duplicateOf` in `data/mock-customers.ts`). Applications get the same message for both, so the form doesn't reveal which accounts exist.

**Account status events** (`AccountStatusEvent`), append-only: `id`, `from` (opt), `to`, `reason` (required for reject and suspend, 5 to 300 characters), `at`, `by` (actor).

**Customer documents** (`CustomerDocument`): `id`, `customerId`, `kind` enum(residence_card_front, residence_card_back, business_license), `fileName`, `contentType` enum(image/jpeg, image/png, image/webp, application/pdf), `size` (bytes), `uploadedAt`. At most one per kind. File bytes are stored separately in private, encrypted storage with retention rules, not on the public media host (`data/mock-customers.ts`). Staff only.

**Customer groups** (`CustomerGroup`)

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | Stable: price rules, quantity rules and coupons point at it, so renaming must keep it |
| name | string | 2 to 60; unique case-insensitive |
| description | string, opt | Up to 300 |

No delete exists in `CustomerRepository`. Moving a customer into a group removes them from their previous group.

**Addresses** (`Address`). Used both as the customer's address book and, copied, as an order snapshot.

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | |
| customerId | ID → customer | Address book rows |
| type | enum(shipping, billing) | |
| label | string | Required, up to 200 |
| recipientName | string | Required, up to 200 |
| companyName | string, opt | Up to 200 |
| country | ISO 3166-1 alpha-2 | Mock forces `JP`, see §9 |
| prefecture | string | Top address level. Must be a known region for the country (`locations.ts`) |
| city | string | Required, up to 200 |
| area | string, opt | Town |
| postalCode | string | Per country. Japan: `NNN-NNNN`, dash optional on input |
| addressLine1 | string | Required, up to 200 |
| addressLine2 | string, opt | Up to 200 |
| phone | string | Required on address book rows; optional for walk-in order addresses |
| isDefault | bool | Exactly one default per type per customer, when any exist. The first of a type becomes the default |

Validation: `validateAddress` in `validation/customer.ts`. Deleting an address never changes an order.

**Customer notifications** (`CustomerNotification`): `id`, `customerId`, `kind` enum(order, delivery, account, reminder), `title`, `body`, `createdAt`, `readAt` (opt).

### 5.3 Catalog

**Products** (`Product`, `types/catalog.ts`). Validation: `validateProduct` in `validation/product.ts`.

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | |
| type | enum(simple, variable) | |
| slug | string | Required, `^[a-z0-9]+(-[a-z0-9]+)*$`, up to 120. **Unique** |
| sku | string | Required, `^[A-Za-z0-9][A-Za-z0-9._-]*$`, up to 64. **Unique, case-insensitive, across all product and variation SKUs** |
| gtin | string, opt | 8, 12, 13 or 14 digits |
| name | string | Required, up to 120 |
| shortDescription | text | Up to 300 |
| description | text | Up to 10,000. HTML, sanitized (`html/sanitize.ts`) |
| status | enum(draft, published, archived) | |
| visibility | enum(visible, catalog, search, hidden) | See `publicProducts` in `data/mock-catalog.ts` |
| featured | bool | |
| originCountry | ISO alpha-2, opt | Independent of the store location |
| unitLabel | string | Required, up to 30, e.g. "case" |
| basePrice | money, opt | Regular price. Required to publish a simple product. Never in public responses |
| salePrice | money, opt | Must be below `basePrice` |
| saleFrom, saleTo | date, opt | Inclusive. `saleTo` ≥ `saleFrom`. Dates need a sale price |
| taxStatus | enum(taxable, shipping, none) | |
| taxClass | enum(standard, reduced, exempt) | |
| isVariableWeight | bool | Priced per weight and adjusted after packing |
| weight | weight | Required, above 0 |
| dimensions | `{length, width, height, unit: cm\|mm\|m}`, opt | All above 0 |
| shippingClassId | ID, opt | Must exist |
| quantityRule | `{min, max?, step}` | `step` (pack multiple) is live. `min` and `max` are deprecated: limits come from quantity rules. The product form never edits this |
| defaultAttributes | json map, opt | Must be a valid value of a variation attribute |
| upsellIds, crossSellIds | ID lists | Up to 20 each; not self; must exist |
| purchaseNote | string, opt | Up to 1000. Shown after purchase |
| menuOrder | int | Lower first |
| reviewsEnabled | bool | No reviews module exists |
| initialStock | int, opt | Imported value, no logic |
| unitOfMeasure | string, opt | Imported value, meaning unconfirmed (`types/catalog.ts`) |
| updatedAt | datetime | |

To publish: at least one category, and a price on a simple product or on each active variation. Tags: up to 20, each up to 40 characters; unknown names create tags. `images` is an ordered `image` list (first is main; `alt` required).

**Categories** (`Category`)

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | |
| slug | string | Required, same format as products. **Unique** |
| name | string | Required, up to 80 |
| description | string, opt | Up to 1000 |
| parentId | ID → category, opt | Tree of any depth. A category can't sit inside itself or its descendants |
| status | enum(active, hidden) | Hidden categories don't show on the storefront |
| image | image, opt | `alt` required |

Rules on categories apply to subcategories, so the engines need each product's categories with ancestors. Product to category is many-to-many.

**Brands** (`Brand`): `id`, `slug`, `name` (unique case-insensitive). Many-to-many with products. **Tags** (`Tag`): `id`, `slug`, `name` (unique case-insensitive). Many-to-many with products.

**Attributes** (`Attribute`, `AttributeValue`): store-wide reusable attribute with `id`, `slug`, `name`; values with `id`, `slug`, `name`, unique case-insensitive within the attribute. The repository can add values but has no call to create or delete an attribute.

**Product attributes** (`ProductAttribute`): on one product: `attributeId` (opt, absent for product-specific), `name` (required, unique case-insensitive on the product), `values` (list of names, at least one, unique case-insensitive), `visible`, `variation`. These store value *names*, not ids.

**Variations** (`ProductVariation`)

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | |
| productId | ID → product | |
| sku | string | Required. Unique across the catalog, as above |
| gtin | string, opt | |
| attributes | json map | One value per variation attribute, e.g. `{ "Size": "5 kg" }`. The combination is unique within the product |
| status | enum(active, disabled) | |
| basePrice, salePrice, saleFrom, saleTo | as product | Variations carry their own sale. Active variations need a price when the product is published |
| image | image, opt | `alt` required |
| gallery | image list | |
| description | string, opt | Up to 500 |
| stockMode | enum(parent, track, status) | `parent` is invalid when the product doesn't track stock |
| stock | stock info | See inventory |
| backorders | enum, opt | Falls back to the product |
| weight, dimensions, shippingClassId, taxClass | opt | Overrides. Absent means same as parent |
| quantityRule | opt | Override; carries `step` |

Up to 100 variations per product. A variable product needs at least one attribute marked `variation`.

**Inventory.** There is no separate inventory entity. Stock sits on products and variations. A separate table is a reasonable design, as long as these values are returned.

| Field | Type | Notes |
| --- | --- | --- |
| manageStock | bool | Product level: count (true) or set a status by hand (false) |
| stock.status | enum(in_stock, low_stock, out_of_stock, backorder) | Derived when counted: `≤ 0` out, `≤ threshold` low, else in stock (`stockFrom` in `data/mock-catalog.ts`). No code derives `backorder` |
| stock.quantity | int, opt | Whole number ≥ 0 when counted |
| backorders | enum(no, notify, allow) | |
| lowStockThreshold | int, opt | Absent = store default. Mock default is 12 |
| soldIndividually | bool | "Limit to one unit per order". Not enforced anywhere today, see §9 |

For a variable product the product-level stock is an aggregate: best status across active variations, quantities summed only when all are counted (`aggregateStock`).

**Stock movements** (`StockMovement`), append-only.

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | |
| productId, variationId (opt) | ID | |
| variationLabel | string, opt | **SNAP** |
| sku | string | **SNAP** |
| source | enum(product_edit, order_page, refund_restock, inventory_adjust) | The backend also needs reservation and deduction sources, see `BUSINESS-RULES.md` §20 |
| before, after | stock info | |
| change | int, opt | Signed, when counted |
| orderId, orderNumber | opt | **SNAP** of number |
| note | string, opt | |
| at | datetime | |
| byName | string | **SNAP** |

**Shipping classes** (`ShippingClass`): `id`, `name` (at least 2 characters, unique case-insensitive), `description` (opt), `surcharge` (money, opt), `surchargePer` enum(order, unit, opt). Deleting is refused while a product or variation uses it.

### 5.4 Pricing

**Pricing rules** (`PriceRule`, `types/pricing.ts`). Validation: `validatePriceRule`, `negativePriceErrors` in `pricing/engine.ts`.

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | Used as the last tie-breaker |
| name | string | 3 to 120 |
| status | enum(active, disabled) | No delete in the repository |
| audience | `{type: all}` \| `{type: group, groupId}` \| `{type: customer, customerId}` | Referenced id must exist |
| target | `{type: all}` \| `{categories, categoryIds}` \| `{products, productIds}` \| `{variations, productId, variationIds}` | Non-empty ids; must exist |
| tiers | ordered list, 1 to 10 | See below |
| priority | int | −1000 to 1000. **Higher wins** |
| validFrom, validTo | datetime, opt | `validTo` ≥ `validFrom` |
| createdAt | datetime | Tie-breaker: older wins. Must not change on update |
| updatedAt | datetime | |

Tier (`PriceTier`): `minQuantity` int 1 to 100,000; `maxQuantity` (opt, only the last tier may be open-ended); `adjustment` is one of `fixed_price` (amount ≥ 0), `amount_off` (amount > 0), `percent_off` (0 < percent ≤ 100, 2 decimals). Tiers strictly increase and don't overlap. Gaps are allowed.

Target and audience are polymorphic. Normalise them or keep json; list screens must search and filter by them (`PriceRuleListQuery`).

**Quantity rules** (`QuantityLimitRule`): `id`, `name` (3 to 120), `status`, `target` (as above), `minQuantity` and `maxQuantity` (opt, at least one set, integers 1 to 100,000, min ≤ max), `priority` (−1000 to 1000, higher wins), `createdAt`, `updatedAt`.

**Coupons** (`Coupon`, `types/coupon.ts`). Validation: `validateCoupon` in `coupons/engine.ts`.

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | Hard delete allowed: past orders keep their own record |
| code | string | Stored in capitals, `^[A-Z0-9][A-Z0-9_-]{2,29}$`. **Unique** |
| description | string, opt | Up to 300 |
| type | enum(percent, fixed_cart, fixed_product) | |
| amount | number | Above 0. Percent ≤ 100; else store currency |
| minSpend | money, opt | ≥ 0. Compared with the whole cart subtotal |
| maxSpend | money, opt | Above 0, ≥ `minSpend` |
| productIds, excludedProductIds | ID lists | |
| categorySlugs | string list | Slugs, not ids. A category slug change would orphan them; see §9 |
| customerIds, groupIds | ID lists | Both empty = every approved customer |
| startsOn, expiresOn | date, opt | Store time, both inclusive |
| usageLimit, usageLimitPerCustomer | int ≥ 1, opt | |
| usedCount | int | Server-maintained. Must be incremented atomically with order placement |
| enabled | bool | |
| createdAt, updatedAt | datetime | |

**Coupon usage** (`CouponUsage`), one row per use: `id`, `couponId`, `orderId`, `orderNumber` (**SNAP**), `customerId`, `customerName` (**SNAP**), `discount` (money, **SNAP**), `at`. Source of the per-customer count.

### 5.5 Carts

**Cart**: one per approved customer (`customerId` unique), `couponCode` (opt), `updatedAt`. **Cart line** (`CartLineInput`, `types/cart.ts`): `productId`, `variationId` (opt), `quantity` (int 1 to 100,000). One line per product option: the key is `productId:variationId`; adding the same option sums quantities, capped. Up to 100 lines. **No prices are stored.**

**Checkout idempotency keys** (`checkout` in `data/mock-orders.ts`): unique on (`customerId`, key). Key: trimmed string of 8 to 100 characters. Value: order id or "pending". A repeated submission returns the order already placed; one in flight is refused. In the demo this is memory only; it must survive restarts and concurrent requests.

### 5.6 Orders

**Orders** (`Order`, `types/order.ts`)

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | |
| number | string | `ORD-<seq>`. **Unique.** The mock uses max + 1; a real sequence is needed under concurrency |
| customerId | ID, opt | Absent for walk-in orders. Must be approved when the order is created |
| walkIn | `{name, companyName?}`, opt | **SNAP**. Name 2 to 200. Exactly one of `customerId` or `walkIn` |
| customerName | string | **SNAP**: company name, else walk-in company, else walk-in name |
| customerEmail, customerPhone | string, opt | **SNAP** |
| status | enum(received, preparing, on_the_way, delivered, cancelled) | Fulfilment. Flow in `BUSINESS-RULES.md` §10 |
| paymentStatus | enum(unpaid, invoiced, paid, partially_refunded, refunded) | Payment. Independent of `status` |
| payment | `{method, reference?, paidAt?, amountPaid?}` | `method` enum(cash_on_delivery, bank_transfer, mobile_wallet, invoice). See payment records |
| billingAddress, shippingAddress | Address, opt | **SNAP**. Absent only for walk-in pickup. Editing them never changes the address book, and vice versa |
| fulfilment | enum(delivery, pickup), opt | Absent = delivery. Pickup is for walk-in orders only |
| shipping | `{label, amount, taxClass, deliveryRouteId?, decision?}` | **SNAP**, see below |
| taxes | list of tax lines | Derived from the snapshot |
| totals | see below | Derived |
| taxSnapshot | see below, opt | **SNAP**. Absent only on older demo orders |
| coupon | `{code, amount}`, opt | **SNAP** |
| discount | `{type, value, reason, at, by}`, opt | Staff order discount. Fixed amount, or percent above 0 and ≤ 100 |
| customerNote | string, opt | Up to 500 at checkout, up to 1000 on admin orders |
| requestedDeliveryDate | datetime, opt | Stored as midnight in the store offset; compared by its date part |
| createdVia | enum(storefront, admin) | |
| createdBy | actor, opt | |
| placedAt, updatedAt | datetime | Must carry the store offset, see §9 |

Shipping decision (`ShippingDecision`) **SNAP**: `mode` enum(suggested, manual), `suggestedAmount`, `zoneId`, `zoneName`, `methodId`, `methodName`, `reason` (required for manual, 5 to 300).

Totals (`OrderTotals`):

| Field | Meaning |
| --- | --- |
| itemsSubtotal | Sum of line subtotals, after weight scaling |
| discountTotal | Line discounts (including the coupon) + order discount |
| itemsTotal | `itemsSubtotal − discountTotal` |
| orderDiscount | Order discount amount, already inside `discountTotal`; absent when none |
| shippingTotal | |
| taxTotal | |
| total | Payable. Tax added: items + shipping + tax. Tax included: items + shipping |
| refundedTotal | Sum of `order` kind refunds only |
| netTotal | `total − refundedTotal`. **Includes tax; not "net of tax"**, see §9 |
| taxIncluded | True when prices included tax |
| itemsNet | Items after discounts excluding tax: net sales |
| itemsTax | Tax on items only |

**Order items** (`OrderItem`)

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | |
| orderId | ID | |
| productId, variationId (opt) | ID | Links only. Must not cascade. The catalog row may be archived |
| name, sku | string | **SNAP** |
| attributes | json map, opt | **SNAP** |
| unitLabel | string | **SNAP** |
| taxClass | enum | **SNAP**: the variation's class overrides the product's |
| taxable | bool, opt | **SNAP**: `product.taxStatus === "taxable"`. Absent = taxable |
| pricedByWeight | bool | **SNAP** of `isVariableWeight` |
| quantity | int | 1 to 10,000 |
| catalogUnitPrice | money | **SNAP**: regular price when ordered |
| unitPrice | money | Agreed price. Editable only through an audited edit |
| discount | money | Line discount, including the coupon share; capped at the line subtotal |
| orderedWeight | weight | **SNAP**: quantity × unit weight. Scales if the quantity is edited |
| fulfilledWeight | weight, opt | Packed weight; above 0 |
| lineSubtotal, lineTotal, lineNet | money | Derived. `lineTotal` excludes the order discount share |
| pricing | see below, opt | **SNAP** |

Item pricing (`OrderItemPricing`) **SNAP**: `basePrice`, `salePrice`, `rulePrice`, `ruleUnitPrice` (the suggested price), `source` enum(rule, sale, regular), `ruleId`, `ruleName`, `tier` `{minQuantity, maxQuantity?}`, `manualOverride` (agreed price differs from the suggested one).

**Order status events** (`StatusEvent`), append-only: `id`, `status`, `at`, `by`, `note` (the cancellation reason, 5 or more characters).

**Order notes** (`OrderNote`): `id`, `type` enum(admin, customer), `body` (up to 1000), `at`, `by`. `admin` notes are staff only; `customer` notes are visible to the customer.

**Order adjustments** (`OrderAdjustment`), append-only audit of every staff edit.

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | |
| kind | enum(adjust, add, remove, replace, discount, delivery_date, address, shipping) | |
| orderItemId | ID, opt | Replace: the new item. Absent for order-level changes |
| itemName | string, opt | **SNAP** |
| replacedItemName | string, opt | **SNAP**, replace only |
| addressType | enum(billing, shipping), opt | Address only |
| reason | string | 5 to 300. Optional only for `delivery_date` |
| at, by | datetime, actor | |
| before, after | change values | Only what changed, plus `orderTotal` |

Change values (`OrderChangeValues`): `quantity`, `unitPrice`, `fulfilledWeight`, `lineTotal`, `discount` (`{type, value}` or null), `deliveryDate` (date or null), `shipping`, `shippingLabel`, `address` (one-line text), `orderTotal` (required).

**Weight adjustments.** No separate entity. A weight change is an `adjust` adjustment with `fulfilledWeight` in `before` and `after`, plus `OrderItem.fulfilledWeight` as the current value. Needs its own query if you report on it: `fulfilledWeight` present in `after`. Calculation in `BUSINESS-RULES.md` §7.

**Payment records. No such entity exists in the code.** The order holds one `payment` object, and `recordPayment` flips the status with no amount. This is the current data:

| Field | Type | Notes |
| --- | --- | --- |
| method | enum | **SNAP**, on the order |
| reference | string, opt | Up to 100. Gateway or bank reference |
| paidAt | datetime, opt | |
| amountPaid | money, opt | Amount received and kept. Set the first time a paid order is edited; lowered by refunds. Absent = nothing was captured, and `netTotal` is what is kept (`refundSummary`) |

*Proposed:* a `payment_record` table (`id`, `orderId`, `method`, `amount`, `reference`, `status`, `receivedAt`, `recordedBy`, provider fields) with `amountPaid` derived from it. The current model can't represent partial payments or a top-up after an order grows; see §9. Never store card data.

**Payment method settings** (`PaymentMethodSettings`, `types/payment.ts`). Three fixed rows.

| Field | Type | Notes |
| --- | --- | --- |
| id | enum(pay_on_delivery, bank_transfer, online) | **Unique** |
| enabled | bool | |
| sortOrder | int | Reorder writes 10, 20, 30… |
| title | string | 2 to 60 |
| description | string | Up to 160 |
| instructions | string | Up to 1000 |
| bank | `{accountName, bankName, accountNumber, branchName?, routingNumber?}`, opt | Bank transfer only; text up to 100; required to enable |
| online | `{status: not_connected\|connected, providerName?}`, opt | **Never editable from the browser** |
| orderPaymentMethod | enum, opt | The order method it maps to |
| legacyWooGatewayId | string, opt | Migration only |
| updatedAt | datetime | |

**Refund records** (`Refund`), append-only. Rules in `orders/refund.ts`.

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | |
| orderId | ID | |
| kind | enum(order, overpayment) | Absent = order |
| method | enum(manual, gateway) | Absent = manual |
| amount | money | Above 0 |
| shipping | money, opt | Shipping part of `amount` |
| reason | string | 5 to 300 |
| at, by | datetime, actor | |
| status | enum(recorded, processed) | `recorded` = noted, no money moved. `processed` = confirmed by the provider (backend) |

Refund lines (`RefundLine`): `orderItemId`, `name` (**SNAP**), `quantity` (int ≥ 0; 0 = amount only), `amount`. Refund restocks (`RefundRestock`): `orderItemId`, `quantity`, `result` enum(restocked, skipped), `note`.

**Invoices** (`Invoice`), append-only, per order.

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | |
| orderId | ID | |
| number | string | **Unique.** `<prefix>-<year>-<NNNN>`; prefix from company settings, `^[A-Z0-9]{1,10}$`, default `INV`; year in store time |
| kind | enum(invoice, revision, credit_note) | |
| replaces | string, opt | Number of the previous document |
| reason | string, opt | Required for revision and credit note, 5 to 300 |
| issuedAt, issuedBy | datetime, actor | |
| snapshot | `InvoiceSnapshot` | **SNAP**, see below. Store as an immutable json document; never join live data |
| difference | money, opt | Signed. Change against the replaced document; negative = credit |

Snapshot contents: order number, placed date, customer name, walk-in, email, phone, billing and shipping addresses, fulfilment, requested delivery date, full `items`, `coupon`, discount `{type, value}`, shipping `{label, amount}`, `taxes`, `totals`, payment method, payment status, `amountPaid`.

**Invoice revisions.** Same entity with `kind: revision`, numbered `<base>-R<n>`. Credit notes: `kind: credit_note`, numbered `<base>-CN`. `<base>` is the order's first invoice number. Latest row wins; no row is ever updated.

### 5.7 Quotations and saved lists

**Quotations** (`Quotation`, `types/portal.ts`)

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | |
| number | string | `QUO-<counter>`. **Unique** |
| customerId | ID | Approved at request time |
| customerName | string | **SNAP** |
| status | enum(requested, quoted, accepted, rejected, declined, expired) | |
| customerNote | string, opt | Up to 1000 |
| staffNote | string, opt | Shown to the customer |
| validUntil | date, opt | Today or later when quoted |
| orderId, orderNumber | opt | Set when accepted |
| createdAt, updatedAt | datetime | |

Quotation items (`QuotationItem`): `id`, `productId`, `variationId` (opt), `name`, `sku`, `optionLabel` (opt) (all **SNAP**), `quantity` (int ≥ 1), `quotedUnitPrice` (money, opt). Quotation events (`QuotationEvent`), append-only: `id`, `status`, `at`, `byName`, `note`.

**Saved lists** (`SavedList`): `id`, `customerId`, `name` (2 to 60), `createdAt`, `updatedAt`. Items (`SavedListItem`): `id`, `productId`, `variationId` (opt), `quantity` (int ≥ 1). Same product and option adds to the existing line. No prices or snapshots: lines show live details and this customer's current price. Scoped to the owner. Name uniqueness is not checked.

### 5.8 Shipping

**Shipping zones** (`ShippingZone`, `types/shipping.ts`). Validation: `validateZone` in `shipping/engine.ts`.

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | |
| name | string | 2 to 80; unique ignoring case and extra spaces |
| isFallback | bool | Exactly one zone. No locations. Can't be deleted |
| createdAt, updatedAt | datetime | |

Zone locations (`ZoneLocation`), up to 200 per zone, at least 1 unless fallback: `{prefecture}`, `{prefecture, city}` or `{postalCode}`. **A location belongs to one zone only**, compared with normalised text and `postcodeKey`. A broader and a narrower location can coexist.

**Shipping methods** (`ShippingMethod`), children of a zone, ordered (listing order breaks cost ties), up to 10 per zone.

| Field | Applies to | Notes |
| --- | --- | --- |
| id, name, enabled | all | Name required, up to 80 |
| type | all | enum(flat_rate, weight_tiers, subtotal_tiers, free_shipping, local_pickup). At most one free and one pickup per zone |
| cost | flat_rate, local_pickup | money ≥ 0 |
| tiers | weight_tiers, subtotal_tiers | 1 to 20 `{from, cost}`. First `from` = 0, strictly increasing. Weight in whole grams (up to 10,000,000); subtotal in currency (up to 100,000,000) |
| classAdjustments | flat, weight and subtotal | `{shippingClassId, amount > 0, per: order\|unit}`. One per class per method |
| minSubtotal | free_shipping | money above 0 |
| instructions, locationId | local_pickup | opt |

**Shipping rules** (`ShippingRule`, `shipping/rules.ts`; the type is not in `types/`)

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | |
| name | string | At least 2 characters |
| enabled | bool | |
| priority | int 0 to 9999 | **Lower runs first** (the opposite of price rules) |
| match | enum(all, any) | |
| conditions | list of `{field, op, value}` | Fields: subtotal, weight (kg), quantity, region, city, postcode, category, shipping_class, product, customer_group, coupon. Numeric fields use lt, lte, gt, gte; list fields use in, not_in with a non-empty list |
| action | one of | `set_charge {amount}`, `free`, `surcharge {amount, label?}`, `tiers {basis: weight\|subtotal, tiers}`, `hide_method {methodType}` |
| zoneIds | ID list | Empty = every zone |

**Shipping general settings** (`ShippingGeneralSettings`), single row: `hidePaidWhenFree` (bool), `unavailableMessage` (string).

**Pickup locations** (`PickupLocation`): `id`, `name` (2+), `address` (5+), `hours` (opt), `instructions` (opt), `fee` (money ≥ 0), `enabled`. Referenced by a pickup method's `locationId`; deleting doesn't check references. `fee` is display only, see §9.

### 5.9 Tax configuration

**Tax settings** (`TaxSettings`, `types/tax.ts`), single row. **Off by default.**

| Field | Type | Notes |
| --- | --- | --- |
| enabled | bool | Off = no tax anywhere |
| pricesIncludeTax | bool | True = tax extracted; false = tax added |
| shippingTaxable | bool | Not assumed; demo default false |
| shippingTaxClass | enum | Not `exempt` when shipping is taxable |
| updatedAt | datetime | |

**Tax rates** (`TaxRate`). Validation: `validateTaxRate` in `tax/engine.ts`. All rates in the demo are fictional. Enter real rates through the admin; never seed or hard-code a rate as the legal one.

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | Copied into order snapshots; deleting a rate doesn't change orders |
| name | string | 2 to 80 |
| percent | percent | 0 allowed (zero-rated) |
| taxClass | enum(standard, reduced) | `exempt` is refused: it is never taxed |
| location | `{country: "JP"}`, `{prefecture}`, `{prefecture, city}` or `{postalCode}` | |
| enabled | bool | |
| createdAt, updatedAt | datetime | |

Uniqueness: **one enabled rate per class + location** (normalised). Disabled duplicates are allowed. A partial unique index fits.

**Tax classes.** Fixed keys `standard, reduced, exempt`, with display names (`TaxClassOption`). No create call exists.

**Order tax snapshot** (`OrderTaxSnapshot`) **SNAP**: `enabled`, `pricesIncludeTax`, `shippingTaxable`, `ratesByClass` (map of class to applied rate; missing = untaxed), `shippingRate` (opt), `capturedAt`. Applied rate (`AppliedTaxRate`): `rateId`, `name`, `percent`, `taxClass`, `matchedBy` enum(postcode, city, prefecture, country).

**Order tax line** (`TaxLine`): `taxClass`, `rate`, `taxableAmount` (excluding tax), `taxAmount`, `rateId`, `rateName`.

### 5.10 Delivery schedules and reminders

**Delivery schedules** (`DeliveryRoute`, `types/delivery.ts`). "Schedule" on screen, "route" in code. Validation: `saveRoute` in `data/mock-portal.ts`.

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | Delete is refused while a reminder campaign uses it |
| name | string | At least 2 characters |
| areas | string list | At least 1. Prefectures or cities, matched by normalised text. Not foreign keys |
| deliveryDays | list of enum(mon…sun) | Required unless `extraDates` has a value |
| cutoffTime | time | On the day before delivery, store time |
| excludedDates | date list, opt | Holidays. Wins over regular and extra days |
| extraDates | date list, opt | |
| active | bool | Inactive has no dates |
| shippingFee | money | **Legacy.** Not used for quotes. New routes get 0 |
| freeShippingThreshold | money, opt | **Legacy.** Not used |

**Reminder campaigns** (`ReminderCampaign`, `types/notify.ts`)

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | |
| name | string | At least 2 characters |
| deliveryRouteId | ID → route | Must exist |
| leadDays | int 0 to 14 | Days before the delivery date |
| sendTime | time | Store time |
| enabled | bool | |
| templateWithOrder, templateWithoutOrder | template key | |
| createdAt, updatedAt | datetime | |

**Reminder send marks.** Required: **unique (campaignId, deliveryDate, customerId)** so one customer gets one reminder per campaign and date, however often the job runs (`simulate` in `data/mock-notify.ts`; memory only there).

**Legacy reminders** (`Reminder`, `types/delivery.ts`): `id`, `type` enum(reorder, order_cutoff, payment_due), `channel` enum(email, sms, whatsapp), `customerId` (opt), `deliveryRouteId` (opt), `schedule` (free text), `message`, `active`, `lastSentAt`. Exposed as `delivery.listReminders`, but no page under `src/app` calls it (`/admin/reminders` shows campaigns). Unclear whether it should be built; confirm with the product owner.

### 5.11 Email

**Email templates** (`EmailTemplate`). Fixed set of 11, seeded in `data/mock-notify.ts`.

| Field | Type | Notes |
| --- | --- | --- |
| key | enum, **unique** | customer_registered, customer_approved, password_reset, order_confirmation, order_processing, order_status, delivery_notification, invoice, refund, reminder_with_order, reminder_without_order |
| name, trigger | string | Fixed text |
| audience | enum(customer, staff) | |
| enabled | bool | Disabled = nothing sent |
| subject | string | 2 to 200. Only allowed placeholders |
| bodyHtml | text | At least 2 characters. Only allowed placeholders |
| placeholders | string list | Fixed per template |
| supportsAttachment | bool | Fixed |
| attachInvoice | bool | Only true when `supportsAttachment` |
| updatedAt | datetime | |

Keep the original seed text: `resetTemplate` restores it.

**Email sender settings** (`EmailSenderSettings`), single row: `senderName` (2+), `senderEmail` (valid), `replyTo` (opt, valid), `footer` (opt). Fallback: sender name, then company `documents.emailSenderName`, then store name.

**Email logs** (`EmailLog`), append-mostly: `id`, `templateKey`, `to`, `subject` (rendered, **SNAP**), `status`, `error` (opt), `attempts` (int), `campaignId` (opt), `at`. The demo has `simulated` and `failed`; the type comment says the backend adds `queued`, `sent` and `bounced`. Only `failed` rows can be retried.

### 5.12 Content

**Pages** (`ContentPage`, `types/content.ts`) and **posts** (`BlogPost`). Shared fields (`ContentBase`), validation in `content/rules.ts`.

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | |
| slug | string | `^[a-z0-9]+(-[a-z0-9]+)*$`. **Unique within pages; unique within posts.** Pages also can't use `RESERVED_SLUGS` |
| title | string | 2 to 160 |
| excerpt | string | Up to 300 |
| bodyHtml | text | **Sanitized on save by the backend**. Needs content to publish |
| status | enum(draft, published, scheduled, trash) | |
| publishedAt | datetime, opt | Required and in the future when scheduled |
| image | image, opt | |
| seo | `{title? ≤ 70, description? ≤ 200, canonicalUrl?, ogImage?}` | json |
| authorName | string | **SNAP** at creation |
| trashedFrom | enum, opt | Status to restore to |
| createdAt, updatedAt | datetime | |

Pages add `visibility` enum(public, customers). Posts add `categories` and `tags` (string lists, 12 each after dedupe; at least one category to publish), `tag` (first category), `readingMinutes` (derived).

**Blog terms.** Categories and tags are plain strings on posts, not entities. `saveTerm` also keeps terms with no posts (`extraTerms`), renames across every post, and compares case-insensitively (2 to 40 characters). A normalised term table is reasonable if the API stays string-based.

**Media** (`MediaItem`, `types/media.ts`)

| Field | Type | Notes |
| --- | --- | --- |
| id | ID | |
| url | string | Public address |
| kind | enum(image, document) | From the detected type |
| fileName | string | Sanitized by `safeFileName`, up to 100 |
| title | string | 1 to 120 |
| alt | string | Up to 200 |
| contentType | string | JPEG, PNG, WebP or PDF, detected from the bytes |
| size | int | Bytes, up to 4 MB in the demo |
| width, height | int, opt | Images |
| uploadedAt, uploadedBy | datetime, string | **SNAP** of the name |

`sample` is demo-only. Image fields elsewhere store a copy of `src/alt/width/height`, not a media id, so deleting media leaves them pointing at a missing file.

**Navigation menus** (`NavigationMenu`): `id`, `name` (2+), `location` enum(header, footer, none), `updatedAt`. **One menu per header or footer location**; taking a location moves the other menu to `none`. Items (`MenuItem`), a tree up to 3 levels, ordered: `id`, `label` (1 to 60), `kind` enum(page, category, custom), `ref` (page id or category slug), `url` (custom only; `http(s)`, `mailto`, `tel`, site-relative or `#`). Storing the tree as json in the menu is acceptable.

**Site content** (`SiteContent`), single json document: `topBar` (up to 120), `sections` (ordered typed `HomeSection` list; ids unique), `about`, `updatedAt`. `docs/CMS-AND-CONTENT-MANAGEMENT.md` says one json column works. Validation: `validation/site-content.ts`.

**Contact messages** (`ContactMessage`): `id`, `name` (2 to 120), `company` (opt, up to 200), `email` (required, up to 200), `phone` (opt), `topic` enum(general, products, account, orders, other), `message` (10 to 2000), `receivedAt`.

### 5.13 Company settings

**Company settings** (`CompanySettings`, `types/company.ts`). **One row per deployment.** It is not multi-tenant (`docs/WHITE-LABEL-ARCHITECTURE.md`). Public data only: it reaches the browser, so no secrets. Validation: `validation/company.ts`.

| Group | Fields |
| --- | --- |
| Identity | `companyName` (2 to 120), `legalName`, `storeName` (2 to 80), `tagline` (≤ 160), `description` (≤ 400), `registrationNumber`, `taxNumber` |
| `branding` | `logoMain`, `logoLight`, `logoDark`, `logoMobile` (`{url, width, height}` or null), `favicon`, `primaryColor`, `secondaryColor`, `accentColor` (`#rrggbb`; these reach a style tag), `headingFont`, `bodyFont` (from `FONT_OPTIONS`), `buttonStyle` enum(rounded, pill, square) |
| `contact` | `email`, `phone` (per the saved country), `whatsapp`, `hours`, `address` (per the saved country), `map` `{lat ±90, lng ±180, label}`, `social` (list of `{network, url}`, `https://` only) |
| `documents` | `invoiceTitle`, `invoicePrefix`, `invoiceHeaderNote`, `showLogoOnInvoice`, `showRegistrationOnInvoice`, `showTaxNumberOnInvoice`, `attachInvoicePdf`, `emailInvoiceOnIssue`, `invoiceFooter`, `emailSenderName`, `emailFooter` |
| `locale` | `country` (`^[A-Z]{2}$`), `currencyCode` (`^[A-Z]{3}$`), `currencySymbol` (≤ 4), `currencyDigits` enum(0, 2, 3), `symbolPosition` enum(before, after), `numberLocale`, `dateLocale`, `language`, `timeZone` (IANA), `weekStartsOn` (0 to 6), `weightUnit`, `dimensionUnit` |
| `setup` | `completedAt` (opt). Set by the wizard; not client-editable through `update` |
| | `updatedAt` |

`StoreSettings` (`types/shipping.ts`) is a read-only view of this row, not a separate entity.

**Admin notifications** (`AdminNotification`, `types/notifications.ts`). Derived from orders, applications, stock and contact messages, not stored. The only state to store is **read marks per staff user** (`data/mock-admin-notifications.ts`).

### 5.14 Audit history

**No generic audit entity exists.** What the code records today:

| Record | Covers |
| --- | --- |
| `Order.statusHistory`, `notes`, `adjustments` | Order status, notes, every staff edit |
| `Refund.by`, `Invoice.issuedBy`, `OrderDiscount.by` | Refunds, invoices, discounts |
| `Customer.statusHistory` | Approval decisions |
| `StockMovement` | Stock changes |
| `Quotation.history` | Quotation steps |
| `CouponUsage`, `EmailLog` | Coupon use, emails |

Many repository calls take an `actor` (pricing and quantity rules, tax, shipping, payment settings, company settings, content, coupons, reminders, emails), but the mocks don't record it, so those changes leave no history today.

*Proposed:* an append-only `audit_log`: `id`, `at`, `actorId`, `actorName`, `actorRole`, `entityType`, `entityId`, `action`, `before` (json), `after` (json), `reason` (opt). Immutable. It adds to the order history above and doesn't replace it, because screens read those structures directly.

---

## 6. Snapshot summary

| On | Value | Copied from | Changes later? |
| --- | --- | --- | --- |
| Order | `customerName`, email, phone, walk-in | Customer or staff input | No |
| Order | Billing and shipping address | Address book or staff input | Audited staff edit only; book not touched |
| Order | `shipping` amount, label, decision | Shipping quote or staff | Audited staff edit only |
| Order | `taxSnapshot` | Tax settings and rates | No |
| Order | `coupon` | Coupon evaluation at checkout | Not recalculated by edits, see §9 |
| Order item | Name, SKU, options, unit, tax class, taxable, by-weight, catalog price, `pricing` | Catalog and rules | No |
| Order item | `unitPrice`, `quantity`, `discount`, `fulfilledWeight` | Agreed values | Audited staff edit only |
| Refund line, adjustment | Item names | Order item | No |
| Invoice | `snapshot` | The order, deep copy | Never |
| Quotation item | Name, SKU, option label | Catalog | No |
| Coupon usage | Order number, customer name, discount | Order | No |
| Stock movement | SKU, label, order number, name | Catalog, actor | No |
| Actor | `name`, `role` | User | No |
| Email log | Rendered subject, recipient | Template, order | No |

**Not snapshots (read live):** carts, saved lists, quote requests before quoting, product stock on an order line (`orders/stock.ts`).

---

## 7. Uniqueness summary

| Entity | Unique on | Comparison |
| --- | --- | --- |
| Product | `slug` | Exact |
| Product + variation | `sku`, across both tables | Case-insensitive |
| Variation | Attribute combination within the product | Exact |
| Category | `slug` | Exact |
| Brand, tag | `name` | Case-insensitive |
| Attribute value | `name` within attribute | Case-insensitive |
| Product attribute | `name` within product | Case-insensitive |
| Customer | `email`; `phone` digits | Case-insensitive; digits with `81` → `0` |
| Customer group | `name` | Case-insensitive |
| Customer document | `kind` within customer | Exact |
| Staff | `email` | Case-insensitive |
| Role | `name` | Case-insensitive |
| Coupon | `code` | Stored upper case |
| Coupon | `usedCount` ≤ `usageLimit` | Must hold under concurrency |
| Cart | `customerId`; line on product + variation | |
| Checkout key | `customerId` + key | |
| Order | `number` | |
| Invoice | `number` | |
| Quotation | `number` | |
| Shipping zone | `name`; each location across zones | Normalised text; postcode by `postcodeKey` |
| Shipping zone | `isFallback = true`, one row | |
| Shipping method | Within a zone: one free, one pickup | |
| Shipping class | `name` | Case-insensitive |
| Tax rate | Class + location among enabled rates | Normalised |
| Payment method | `id` | |
| Page, post | `slug`, each in its own table | Exact |
| Menu | `location` when not `none` | |
| Template | `key` | |
| Reminder mark | Campaign + date + customer | |
| Single rows | Company, tax settings, shipping settings, email sender, site content | One row |

---

## 8. Indexes the listings imply

From the `*ListQuery` types in `src/lib/data/repositories.ts`. All filtering, sorting and paging is server-side (`perPage` max 48).

| Table | Filter and sort on |
| --- | --- |
| Orders | `customerId`, `status`, `paymentStatus`, `shipping.deliveryRouteId`, `placedAt`, `number`, `customerName`, `totals.total`. Order type (first, repeat, walk-in) is derived and filterable |
| Customers | `status`, `groupId`, address prefecture, `createdAt`, name, email, phone, order aggregates |
| Products | Status, type, category (with descendants), brand, stock status, featured, name, SKU, GTIN, including variation SKU and GTIN |
| Price and quantity rules | Audience type, target type, status, priority |
| Coupons | Code, status (active, disabled, expired) |
| Invoices | Number, order number, customer, `issuedAt` |
| Stock movements | Product, `at`, text search |
| Email logs | Status, template, recipient, subject, campaign |
| Pages, posts | Status, `updatedAt`, `publishedAt`, title, slug, category |

---

## 9. Gaps and unclear points that affect the schema

| Point | Detail | File |
| --- | --- | --- |
| Invoice seller details are not frozen | The snapshot has no seller name, tax number, logo or footer. The document renders them from current company settings, so an issued invoice changes when settings change. *Proposed:* add them to the snapshot | `src/components/order/invoice-document.tsx`, `orders/invoice.ts` |
| Balance due can't be settled | `recordPayment` refuses once paid, and no call raises `amountPaid`. If an edit raises a paid order's total, the balance stays due for good | `data/mock-orders.ts` |
| Partial payments | Not modelled. `paid` has no amount | `types/order.ts` |
| `netTotal` means two things | On an order: total − refunds, tax included. On `TaxCalculation`: total excluding tax | `types/order.ts`, `tax/engine.ts` |
| Coupon snapshot goes stale | Removing a line keeps `order.coupon.amount`, although that line's share of the discount has left | `applyEdit` in `data/mock-orders.ts` |
| Timestamps | New orders store `new Date().toISOString()` (UTC), but types and `withinDates` assume the store offset and slice the first 10 characters. Early-morning Tokyo orders fall on the previous day in reports. Compute dates in store time | `data/mock-orders.ts`, `data/mock-utils.ts`, `reports/aggregate.ts` |
| Coupons store category slugs | Everything else references ids | `types/coupon.ts` |
| Japan is hard-coded in places | Mock forces `country: "JP"`; tax country location only allows `JP`; phone dedupe assumes `81`. Company settings allow other countries | `data/mock-customers.ts`, `tax/engine.ts` |
| `vatRegistrationNumber` | Validation message mentions a BIN and the regex is unrelated to Japan. Field meaning needs confirming | `validation/customer.ts` |
| `soldIndividually` | Stored, never checked | `types/catalog.ts`, `orders/cart.ts` |
| `PickupLocation.fee` | Editable and shown, but the charge comes from the method's `cost` | `data/mock-shipping.ts`, `shipping/engine.ts` |
| Older orders | Some demo orders have no `taxSnapshot` and use placeholder class rates. New orders always have one, so a real system needs only the snapshot path, unless you migrate such orders | `orders/assemble.ts` |
| `docs/backend-api.md` | Still says BDT and `Asia/Dhaka`, "prices are excluding VAT", and calls money "paisa". The code says JPY by default, configurable digits, and inclusive or exclusive tax | `docs/backend-api.md` §1, §6 |
