# Backend API handoff

> **Superseded by `API-CONTRACTS.md`** for routes and types. Keep this file for its longer notes on orders, pricing, tax and shipping. Where it mentions a currency or time zone, read that as the store's settings: they come from company settings, not from any fixed value.

Contract between the Next.js frontend (`b2b-commerce`) and the future backend. It is framework-neutral: any
stack that serves this HTTP/JSON API will work without changes to the page UI.

- **Source of truth for shapes:** TypeScript types in [`src/lib/types`](../src/lib/types). JSON field names match them exactly.
- **Frontend integration point:** the interfaces in [`src/lib/data/repositories.ts`](../src/lib/data/repositories.ts). An
  API implementation of those interfaces replaces the mock one in [`src/lib/data/index.ts`](../src/lib/data/index.ts).
- **Status:** the frontend runs entirely on mock data today. Nothing below exists yet.

---

## 1. Conventions

| Topic | Rule |
| --- | --- |
| Base URL | `/api/v1` (configured in the frontend via env var) |
| Format | JSON, UTF-8. `camelCase` field names. File uploads use `multipart/form-data`. |
| IDs | Strings in JSON, even if numeric in the database. |
| Money | `Money` = number in the store currency (BDT by default), major units (taka). No currency objects. Prices are **excluding** VAT. Whole taka vs. 2-decimal paisa is still to be agreed (§8). |
| Dates | ISO-8601 with offset, e.g. `2026-09-30T09:00:00+06:00`. Business time zone is `Asia/Dhaka` (configurable). Calendar-only values (date filters) are `YYYY-MM-DD` in the store time zone. |
| Locations | Addresses use `country` (ISO code), `prefecture`, `city`, optional `area` (upazila/thana/locality), `postalCode`. Product `originCountry` is separate from the store location. |
| Weight | `{ "value": 2.5, "unit": "kg" }` — unit is `g` or `kg`. |
| Optional fields | Omit them or send `null`; the frontend treats both as absent. |
| Pagination | Query `?page=1&perPage=20` (1-based, `perPage` max 48). Response is `Paginated<T>`, shown below. |
| Listings | Every list endpoint accepts `search`, `sort`, `dir` (`asc`/`desc`), `page`, `perPage`, plus its own filters; date filters use `from`/`to` (inclusive `YYYY-MM-DD`, store time zone). Unknown values are ignored. Filtering, search and sorting happen on the server — see "Listing parameters" below. |
| Caching | Every response that depends on the caller (prices, cart, orders, account, admin) must send `Cache-Control: private, no-store`. Public catalog responses may be cached publicly and must not vary by caller. |

```json
{ "items": [], "page": 1, "perPage": 20, "total": 0, "totalPages": 1 }
```

### Errors

All non-2xx responses use one shape:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Some fields are invalid.",
    "fields": { "quantity": ["Must be a multiple of 2."] }
  }
}
```

| HTTP | `code` | When |
| --- | --- | --- |
| 400 | `bad_request` | Malformed request |
| 401 | `unauthenticated` | Missing/expired token |
| 403 | `forbidden` | Wrong role |
| 403 | `account_not_approved` | Customer is `pending`, `rejected` or `suspended` |
| 404 | `not_found` | Missing — **also** used when a record belongs to another customer (do not reveal it exists) |
| 409 | `conflict` | Stock, quantity-rule or cutoff conflict at order time; stale cart |
| 422 | `validation_failed` | Field errors in `fields` |
| 429 | `rate_limited` | Login, registration, contact form |

### Listing parameters

| Endpoint | `search` matches | `sort` fields (default) | Filters |
| --- | --- | --- | --- |
| `GET /products` | name, SKU | `name` (default), `updated` | `category` (slug), `categories` (comma-separated slugs: any of them, subcategories included; ANDed with `category` — used by the Home quick order to stay within featured categories), `stockStatus` |
| `GET /admin/products` | name, SKU, variation SKUs | `name` (default), `sku`, `price` (lowest active price), `stock`, `updated` | `category` (slug, includes subcategories), `type` (`simple`/`variable`), `stockStatus`, `status` (omitted = published + draft; archived only when asked for), `pricing` (`missing` = no store-currency price on the product or an enabled variation, so not purchasable; `set` = fully priced) |
| `GET /admin/categories` | name, slug, description | `path` (default, tree order), `name`, `products` | `status` (`active`/`hidden`) |
| `GET /admin/orders` · `GET /customer/orders` | order number, customer name | `placed` (default, desc), `number`, `customer`, `total`, `status` | `status`, `paymentStatus`, `customerId` (admin), `deliveryRouteId`, `orderType` (`first` / `repeat` / `walk_in`, admin), `from`/`to` (placement date). Admin rows carry the derived `orderType`: `repeat` when the customer has an earlier non-cancelled order, else `first`; `walk_in` without an account |
| `GET /admin/customers` | company, contact, email, phone, legacy ID | `company` (default), `registered`, `status`, `group`, `orders`, `spend` | `status`, `groupId`, `prefecture`, `hasOrders`, `pendingFirst` (pending customers first, then the requested sort; All Requests page), `from`/`to` (registration date) — items are `CustomerListItem` (adds `groupName`, `orderCount`, `totalSpend`, `lastOrderAt`) |
| `GET /admin/customer-groups` | name, description, id | `name` (default), `customers` | — (items include `customerCount`) |
| `GET /admin/price-rules` | rule name, customer/group name, product/category name, id | `audience` (default, precedence order), `name`, `target`, `priority`, `updated` | `audienceType`, `targetType`, `status`, `withConflicts` (items include `audienceName`, `targetName`, `conflicts`) |
| `GET /admin/quantity-rules` | rule name, product/category name, id | `target` (default), `name`, `priority`, `updated` | `targetType`, `status` (items include `targetName`, `conflicts`) |
| `GET /admin/delivery-routes` | name, areas | `name` (default), `fee`, `cutoff` | `active` |
| `GET /admin/shipping/zones` | zone name, location, method name | `match` (default: postcode zones, then city, then prefecture, fallback last), `name` | — (items include `locationSummary`) |
| `GET /admin/reminders` | message, schedule | `type` (default), `lastSent` | `type`, `channel`, `active` |
| `GET /customer/notifications` | title, body | `date` (default, desc) | `kind`, `unreadOnly` |

All return `Paginated<T>`. When `dir` is omitted, dates and totals default to descending and text to ascending.

---

## 2. Authentication and roles

**Mechanism (proposed).** Token-based. `POST /auth/login` returns an opaque bearer token. The Next.js server
stores it in an `httpOnly`, `Secure`, `SameSite=Lax` cookie and sends it as `Authorization: Bearer <token>` on
server-to-server calls. The browser never calls the API directly and never sees the token. Tokens must be
revocable (logout, suspension).

**Roles**

| Role | Who | Can |
| --- | --- | --- |
| `guest` | No token | Browse catalog (no prices), apply for an account, read store info |
| `customer` (any status) | Logged-in business user | Everything a guest can, plus read own profile and application status |
| `customer` (`approved`) | Approved business user | Prices, cart, orders, addresses, notifications |
| `admin` | Staff | All `/admin/*` endpoints. Finer staff roles can be added later without changing this contract |

`accountStatus` values: `pending` → `approved` | `rejected`; `approved` → `suspended` → `approved`.

**The backend must enforce all access rules.** The frontend hides prices and links by role only as a UX hint.

### Endpoints

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/login` | guest | Exchange email + password for a token |
| POST | `/auth/logout` | any token | Revoke the token |
| GET | `/auth/me` | any token | Current user and role |
| POST | `/auth/password/forgot` | guest | Send reset email (always 204) |
| POST | `/auth/password/reset` | guest | Set new password with emailed token |
| POST | `/applications` | guest | Apply for a wholesale account (creates `pending` customer + user) |

```http
POST /api/v1/auth/login
{ "email": "orders@kitchen.example.com", "password": "••••••••" }
```

```json
{
  "token": "opaque-token",
  "expiresAt": "2026-10-31T09:00:00+06:00",
  "user": {
    "id": "usr-001",
    "email": "orders@kitchen.example.com",
    "name": "Rahim Uddin",
    "role": "customer",
    "customerId": "cus-001",
    "accountStatus": "approved"
  }
}
```

`GET /auth/me` returns the `user` object above. Admin users have `"role": "admin"` and no `customerId` / `accountStatus`.

```http
POST /api/v1/applications
{
  "companyName": "Demo Kebab Corner",
  "businessType": "Restaurant",
  "contactName": "Kamal Hossain",
  "email": "hello@kebab.example.com",
  "phone": "+880 1700-000005",
  "prefecture": "Sylhet",
  "city": "Sylhet",
  "postalCode": "3100",
  "password": "••••••••"
}
```

```json
201 Created
{ "customerId": "cus-003", "status": "pending" }
```

---

## 3. Catalog (public)

Public responses **never include `basePrice`** or any other price. Customers get prices from §4.

| Method | Path | Access | Frontend method |
| --- | --- | --- | --- |
| GET | `/categories` | public | `products.listCategories()` |
| GET | `/brands` | public | `products.listBrands()` — brands used by publicly listed products, with `productCount` (`BrandFacet`) |
| GET | `/products?search=&category=&brand=&stockStatus=&sort=&dir=&page=&perPage=` | public | `products.list()` |
| GET | `/products/{slug}` | public | `products.getBySlug()` |

- `brand` is a comma-separated list of brand slugs (any of them).
- **Price filter (customer only):** the shop's min/max price filter uses the approved customer's own unit price at
  quantity 1 (rules applied; variable products match when any active variation does; unpriced products never match).
  Frontend: `pricing.productIdsInPriceRange(customerId, { min, max })` then `products.list({ productIds })`. Backend:
  a customer endpoint such as `GET /customer/products?minPrice=&maxPrice=&…` (same params as `/products`), never on
  the public endpoint — a public price filter would reveal prices to guests.
- `search` matches name and SKU. `category` is a category **slug**. `sort` is `name` (default) or `updated`; there is no public price sort because prices are not public.
- Only `published` products are returned, respecting `visibility` (`visible` = everywhere, `catalog` = browsing only,
  `search` = search results only, `hidden` = direct link only) and excluding products whose categories are all `hidden`.
  A category filter includes its subcategories. Filtering, search and pagination happen on the server.
- Images: absolute URLs on the media host (`NEXT_PUBLIC_MEDIA_HOST`), with `width`/`height`. No base64.

`GET /products?category=frozen-meat&perPage=2` → `Paginated<ProductSummary>`

```json
{
  "items": [
    {
      "id": "p-005",
      "slug": "frozen-chicken-thigh",
      "sku": "MEAT-CHK-005",
      "name": "Frozen Boneless Chicken Thigh",
      "shortDescription": "Boneless thigh, approx. 2 kg pack, priced by weight.",
      "unitLabel": "pack",
      "stock": { "status": "in_stock", "quantity": 60 },
      "weight": { "value": 2, "unit": "kg" },
      "isVariableWeight": true,
      "categoryIds": ["cat-meat"],
      "image": { "src": "https://media.example.com/p/chicken-thigh.jpg", "alt": "Chicken thigh pack", "width": 1200, "height": 1200 },
      "hasVariations": false
    }
  ],
  "page": 1, "perPage": 2, "total": 2, "totalPages": 1
}
```

`GET /products/basmati-rice-premium` → `Product`

```json
{
  "id": "p-001",
  "slug": "basmati-rice-premium",
  "sku": "RICE-BAS-001",
  "name": "Premium Basmati Rice",
  "shortDescription": "Long-grain aged basmati rice.",
  "description": "Aged long-grain basmati rice suitable for biryani and polao.",
  "status": "published",
  "categoryIds": ["cat-rice"],
  "originCountry": "IN",
  "images": [],
  "unitLabel": "bag",
  "taxClass": "reduced",
  "stock": { "status": "in_stock", "quantity": 240 },
  "weight": { "value": 5, "unit": "kg" },
  "quantityRule": { "min": 1, "step": 1 },
  "isVariableWeight": false,
  "variations": [
    { "id": "p-001-5", "sku": "RICE-BAS-001-5", "attributes": { "Size": "5 kg" }, "stock": { "status": "in_stock", "quantity": 180 }, "weight": { "value": 5, "unit": "kg" } },
    { "id": "p-001-20", "sku": "RICE-BAS-001-20", "attributes": { "Size": "20 kg" }, "stock": { "status": "in_stock", "quantity": 60 }, "weight": { "value": 20, "unit": "kg" }, "quantityRule": { "min": 1, "max": 20, "step": 1 } }
  ],
  "updatedAt": "2026-09-01T09:00:00+06:00"
}
```

`stock.quantity` may be omitted if exact counts should not be public.

---

### Admin notifications

`GET /admin/notifications?limit=` → `AdminNotificationFeed` (`src/lib/types/notifications.ts`): `items` (newest first: new orders, registration requests, low or out-of-stock products, contact messages), `total`, `unread` (bell), `openOrders` (orders not yet `delivered` or `cancelled`, Orders badge), `pendingRegistrations` (customers at `pending`, All Requests badge). The badges count work waiting and only drop when it is handled; reading a notification does not change them. `POST /admin/notifications/{id}/read` · `POST /admin/notifications/read-all`: store read marks per staff user (the demo shares one set in memory). The frontend refreshes about once a minute; push updates can replace that.

### Contact form (public)

`POST /contact` with `ContactMessageInput` (`src/lib/types/content.ts`): `name` (2–120), `company?`, `email`, `phone?` (Japanese number), `topic` (`general` / `products` / `account` / `orders` / `other`), `message` (10–2000). `422` with field errors, same rules as `src/lib/validation/contact.ts`. The backend stores the message, emails the team (with a queue and retries), and must add rate limiting and bot protection; the frontend also has a hidden spam-trap field. The demo keeps messages in server memory and sends nothing; staff see them in the notification bell, and there is no inbox screen yet.

### Journal (public)

`GET /posts?excludeSlug=&limit=` → published `BlogPostSummary[]`, newest first (`posts.list()`) · `GET /posts/{slug}` → `BlogPost` or 404 for missing or unpublished posts (`posts.getBySlug()`). Types in [`src/lib/types/content.ts`](../src/lib/types/content.ts). `bodyHtml` is sanitized again by the frontend (allowlist, no attributes or links). The demo has three sample articles and no editor; admin writing and publishing come with the CMS.

---

## 4. Customer portal (role `customer`)

All endpoints act on the caller's own customer record, derived from the token. They never take a `customerId` parameter.
Unless marked *any status*, the account must be `approved` (otherwise `403 account_not_approved`).

| Method | Path | Purpose | Frontend method |
| --- | --- | --- | --- |
| GET | `/customer/prices?productIds=p-001,p-005` | Resolved unit prices (max 48 ids) | `pricing.getCustomerPrices()` |
| GET | `/customer/profile` | Own customer record — *any status* | `customers.getById()` |
| PATCH | `/customer/profile` | Update contact name, phone | — |
| GET | `/customer/addresses` | List addresses | (from profile today) |
| POST | `/customer/addresses` | Add address | — |
| PATCH | `/customer/addresses/{id}` | Edit / set default | — |
| DELETE | `/customer/addresses/{id}` | Remove | — |
| GET | `/customer/notifications?search=&kind=&unreadOnly=&page=` | Paginated, newest first | `customers.listNotifications()` |
| POST | `/customer/notifications/{id}/read` | Mark read | — |
| GET | `/customer/orders?search=&status=&paymentStatus=&from=&to=&sort=&dir=&page=` | Own orders, newest first | `orders.list()` |
| GET | `/customer/orders/{id}` | Own order (404 if not theirs) | `orders.getById()` |
| GET | `/customer/cart` | Current cart, re-priced | `cart.get()` |
| POST | `/customer/cart/items` | Add lines (`{ lines: CartLineInput[] }`; also used by reorder) | `cart.add()` |
| GET | `/customer/price-bounds` | Lowest and highest price this approved customer can buy publicly listed products at (quantity 1), `{ min, max }` or `null`, for the shop's price slider. Never for guests or applicants | `pricing.priceBounds()` |
| GET | `/customer/quick-order?q=&category=&productIds=&page=` | Quick order sheet: published products sorted by name, 20 products per page, one `QuickOrderLine` per orderable option (simple product or active variation) priced for the customer at its minimum quantity, with stock, min/max/step and `error` when it can't be ordered; `QuickOrderPage` = `{ lines, page, totalPages, totalProducts }`. Prices only for approved customers. Adding uses `POST /customer/cart/items` | `cart.quickOrder()` |
| PATCH | `/customer/cart/items/{lineId}` | Change quantity (0 removes) | `cart.setQuantity()` |
| DELETE | `/customer/cart/items/{lineId}` | Remove line | `cart.remove()` |
| POST | `/customer/checkout/preview` | Totals for the checkout page | `orders.checkoutPreview()` |
| POST | `/customer/orders` | Place order from cart (checkout) | `orders.checkout()` |
| POST | `/applications` | Online wholesale application (public, rate limited). `multipart/form-data`: the fields plus optional files `residence_card_front`, `residence_card_back`, `business_license` (JPG/PNG/WebP/PDF by content, ≤ 4 MB each; rules in `src/lib/validation/documents.ts`) → `Customer.documents` metadata | `customers.register()` |
| GET | `/admin/customers/{id}/documents/{documentId}` | Staff only: the uploaded file (`Cache-Control: private, no-store`, `nosniff`; PDFs as attachment). Files live in private storage, never the public media host; views are logged | `customers.getDocument()` |

`GET /customer/prices?productIds=p-001,p-005` → `ResolvedPrice[]`

```json
[
  { "productId": "p-001", "basePrice": 1150, "unitPrice": 1092.5, "appliedRuleId": "rule-001", "appliedRuleName": "Restaurants — rice & grains 5% off", "appliedTier": { "minQuantity": 1 } },
  { "productId": "p-005", "basePrice": 1180, "unitPrice": 1120, "appliedRuleId": "rule-003" }
]
```

Prices are for quantity 1. Each entry also carries `salePrice` (active sale, if any) and `priceSource`
(`rule` | `sale` | `regular`). Support `variationId` entries and `&quantity=` so the cart can show bulk-tier prices; the
cart and checkout must always re-resolve with the line's real quantity (see §6.1).

`POST /customer/cart/items` — `{ "lines": [{ "productId": "p-003", "quantity": 10 }] }` → `{ cart: Cart, added, skipped[] }`

```json
{
  "customerId": "cus-001",
  "lines": [
    { "id": "p-003:", "productId": "p-003", "quantity": 10, "slug": "wheat-flour-atta-10kg", "name": "Wheat Flour (Atta)", "sku": "…",
      "unitLabel": "bag", "pricedByWeight": false, "stockStatus": "in_stock", "unitPrice": 620, "lineTotal": 6200,
      "minQuantity": 1, "step": 1 }
  ],
  "itemsSubtotal": 6200,
  "valid": true,
  "updatedAt": "2026-10-28T10:00:00+06:00"
}
```

The cart stores only product, option and quantity; every response re-prices each line for the customer at its
quantity (rules, active sale price, bulk tiers — [`priceCartLine`](../src/lib/data/mock-cart.ts)). A line that can't be
ordered as it is carries `error` (rules in [`checkCartLine`](../src/lib/orders/cart.ts), tested in
`tests/cart-checkout.test.ts`: archived/disabled option, no price, quantity below min / above max / not a multiple of
the pack `step`, out of stock or above counted stock unless backorders are allowed) and `valid` is false. Adding
skips unknown, unpublished, unpriced products and missing options with a reason; the same option is merged.
Only approved customers have a cart. Imported products have no BDT price yet, so they can't be added.

`POST /customer/cart/items/bulk` — `{ "lines": [{ "sku": "SPC-CUM-011", "quantity": 2 }, { "sku": "NOPE", "quantity": 1 }] }`
→ `{ "cart": Cart, "errors": [{ "sku": "NOPE", "code": "not_found", "message": "Unknown SKU." }] }`. Valid lines
are added and invalid ones reported. The request does not fail as a whole.

`POST /customer/orders` (requires header `Idempotency-Key: <uuid>`; the mock takes `idempotencyKey` in the body)

```json
{ "shippingAddressId": "addr-002", "billingAddressId": "addr-003", "paymentMethod": "pay_on_delivery", "requestedDeliveryDate": "2026-10-30", "customerNote": "Back entrance" }
```

`CheckoutInput`: addresses must be the customer's own (`shipping` / `billing` type; billing defaults to the default
billing address, else the delivery address); `paymentMethod` must be an enabled checkout method (`pay_on_delivery` →
order `cash_on_delivery`, `bank_transfer`; `online` is never accepted without a provider); `requestedDeliveryDate` today
or later (store time zone) and within ~3 months; note ≤ 500 chars. Shipping is the zone's suggested method for the
address and cart (none → `422` on `shippingAddressId`); tax is snapshotted for the delivery address. The order gets
`createdVia: "storefront"`, status `received` ("Placed online by the customer"), payment status `unpaid` — never paid.
`POST /customer/checkout/preview` takes the same body without the key and returns `CheckoutPreview` (items, shipping,
taxes, totals) without saving. A second request with the same key while the first runs → `409`; after it → the same order.

→ `201 Order`. The server recomputes everything from the cart: prices, tax, shipping and stock. It ignores any
client-side totals and empties the cart. If a price changed since the cart was loaded, return `409 conflict`
so the customer can review. Retrying with the same key returns the same order.

`GET /customer/orders/ord-10042` → `Order` (shortened; the customer endpoint omits `notes` of type `admin`)

```json
{
  "id": "ord-10042",
  "number": "ORD-10042",
  "customerId": "cus-001",
  "customerName": "Sample Kitchen Gulshan",
  "customerEmail": "orders@kitchen.example.com",
  "status": "on_the_way",
  "statusHistory": [
    { "id": "e1", "status": "received", "at": "2026-09-28T13:40:00+06:00", "by": { "id": "cus-001", "name": "Sample Kitchen Gulshan", "role": "customer" } },
    { "id": "e2", "status": "preparing", "at": "2026-09-28T15:40:00+06:00", "by": { "id": "staff-2", "name": "Warehouse (demo)", "role": "admin" } },
    { "id": "e3", "status": "on_the_way", "at": "2026-09-29T13:40:00+06:00", "by": { "id": "staff-2", "name": "Warehouse (demo)", "role": "admin" } }
  ],
  "paymentStatus": "invoiced",
  "payment": { "method": "invoice" },
  "items": [
    { "id": "oi-1", "productId": "p-001", "variationId": "p-001-20", "name": "Premium Basmati Rice", "sku": "RICE-BAS-001-20", "attributes": { "Size": "20 kg" }, "unitLabel": "bag", "taxClass": "reduced", "pricedByWeight": false, "quantity": 2, "catalogUnitPrice": 4400, "unitPrice": 4200, "discount": 0, "orderedWeight": { "value": 40, "unit": "kg" }, "lineSubtotal": 8400, "lineTotal": 8400 },
    { "id": "oi-2", "productId": "p-005", "name": "Frozen Boneless Chicken Thigh", "sku": "MEAT-CHK-005", "unitLabel": "pack", "taxClass": "reduced", "pricedByWeight": true, "quantity": 5, "catalogUnitPrice": 1180, "unitPrice": 1120, "discount": 0, "orderedWeight": { "value": 10, "unit": "kg" }, "fulfilledWeight": { "value": 10.4, "unit": "kg" }, "lineSubtotal": 5824, "lineTotal": 5824 }
  ],
  "billingAddress": { "…": "Address snapshot" },
  "shippingAddress": { "id": "addr-001", "type": "shipping", "label": "Restaurant", "recipientName": "Rahim Uddin", "companyName": "Sample Kitchen Gulshan", "country": "BD", "prefecture": "Dhaka", "city": "Dhaka", "area": "Gulshan", "postalCode": "1212", "addressLine1": "House 00, Road 00 (sample)", "phone": "+880 1700-000001", "isDefault": true },
  "shipping": { "label": "Dhaka Metro route", "amount": 0, "taxClass": "standard", "deliveryRouteId": "route-dhaka" },
  "taxes": [{ "taxClass": "reduced", "rate": 5, "taxableAmount": 15784, "taxAmount": 789.2 }],
  "totals": { "itemsSubtotal": 15784, "discountTotal": 0, "itemsTotal": 15784, "shippingTotal": 0, "taxTotal": 789.2, "total": 16573.2, "refundedTotal": 0, "netTotal": 16573.2 },
  "refunds": [],
  "notes": [{ "id": "n1", "type": "customer", "body": "Your chicken order was packed at 10.4 kg (10 kg ordered); the total was adjusted.", "at": "2026-09-28T18:40:00+06:00", "by": { "id": "staff-2", "name": "Warehouse (demo)", "role": "admin" } }],
  "adjustments": [
    {
      "id": "adj-1", "kind": "adjust", "orderItemId": "oi-2", "itemName": "Frozen Boneless Chicken Thigh", "reason": "Packed weight 10.4 kg vs 10 kg ordered",
      "at": "2026-09-28T18:40:00+06:00", "by": { "id": "staff-2", "name": "Warehouse (demo)", "role": "admin" },
      "before": { "unitPrice": 1120, "lineTotal": 5600, "orderTotal": 16338 },
      "after": { "unitPrice": 1120, "fulfilledWeight": { "value": 10.4, "unit": "kg" }, "lineTotal": 5824, "orderTotal": 16573.2 }
    }
  ],
  "customerNote": "Please use the back entrance.",
  "requestedDeliveryDate": "2026-10-01T00:00:00+06:00",
  "createdVia": "storefront",
  "placedAt": "2026-09-28T13:40:00+06:00",
  "updatedAt": "2026-09-28T18:40:00+06:00"
}
```

The VAT rate in this example is a mock placeholder, not a real rate. Field-by-field types are in
[`src/lib/types/order.ts`](../src/lib/types/order.ts). Migrated orders and items may carry `legacyWooId`
(the old store's numeric ID) next to the stable `id`.

**Money:** amounts are JSON numbers in taka with at most 2 decimals (paisa). Store them as integer paisa or
`DECIMAL(12,2)` — never floating point. The frontend calculates previews in integer paisa
([`src/lib/orders/calc.ts`](../src/lib/orders/calc.ts), tested in `tests/order-calc.test.ts`) and the
backend must produce the same results: half-up rounding, VAT per tax class on (line totals + shipping in that
class), rounded once per class.

`shippingAddress` is a **snapshot** taken at order time, so later address edits do not change past orders.

---

## 5. Admin (role `admin`)

Admin product responses include `basePrice` (product and variations). List endpoints accept `page`/`perPage`
and the filters shown below.

| Area | Endpoints | Frontend method today |
| --- | --- | --- |
| Products | `GET /admin/products` (listing params) → `Paginated<AdminProductRow>` · `GET /admin/products/{id}` → `Product` · `POST /admin/products` · `PUT /admin/products/{id}` (body `ProductInput`) · `POST /admin/products/{id}/duplicate` · `POST /admin/products/{id}/status` (`{ "status": "archived" }` / `"draft"` / `"published"`) · `GET /admin/products/search?q=&exclude=` → `ProductPick[]` (max 10) · `GET /admin/products/picks?ids=` → `ProductPick[]` · `POST /admin/products/{id}/stock` (`{ variationId?, status: "in_stock" | "out_of_stock" }` for status-managed stock, `{ variationId?, quantity }` for counted stock — see *Order editing* below) · `POST /admin/media` (multipart upload → `ProductImage`) | `products.adminList()`, `getById()`, `create()`, `update()`, `duplicate()`, `setStatus()`, `setStock()`, `search()`, `getPicks()` |
| Categories | `GET /admin/categories` (listing params) → `Paginated<AdminCategoryRow>` · `GET /admin/categories/all` · `GET /admin/categories/{id}` · `POST /admin/categories` · `PUT /admin/categories/{id}` (body `CategoryInput`) · `GET /admin/categories/{id}/products?page=` → `Paginated<ProductPick>` · `POST /admin/categories/{id}/products` (`{ "add": [ids], "remove": [ids] }`) | `categories.list()`, `all()`, `getById()`, `create()`, `update()`, `listProducts()`, `assignProducts()` |
| Catalog settings | `GET /admin/brands` · `POST /admin/brands` (`{ "name" }`) · `GET /admin/tags` (most used first) · `GET /admin/attributes` (with values) · `POST /admin/attributes/{id}/values` (`{ "name" }` — new store-wide value) · `GET /admin/shipping-classes` · `GET /admin/tax-classes` · `GET /admin/settings/catalog` (`{ "lowStockThreshold" }`) | `catalogSettings.*` |
| Orders | `GET /admin/orders` (listing params) · `GET /admin/orders/{id}` · `POST /admin/orders` (body `CreateOrderInput`) · `POST /admin/orders/{id}/status` · `POST /admin/orders/{id}/notes` · `POST /admin/orders/{id}/adjustments` · `POST /admin/orders/{id}/edits` (body `OrderEdit`) · `POST /admin/orders/{id}/edits/preview` (body `OrderEdit` → `OrderEditPreview`) · `POST /admin/orders/{id}/invoices` (`{ kind, reason? }`) · `GET /admin/orders/settings` (VAT rates for previews) · `GET /admin/orders/customers?q=` · `GET /admin/orders/customers/{id}` · `GET /admin/orders/orderable-products/{productId}?customerId=` — see *Orders (admin)* below | `orders.list()`, `getById()`, `create()`, `updateStatus()`, `addNote()`, `adjustItem()`, `edit()`, `previewEdit()`, `issueInvoice()`, `calculationSettings()`, `searchCustomers()`, `customerContext()`, `orderableProduct()` |
| Customers | `GET /admin/customers` (listing params) · `GET /admin/customers/status-counts` · `GET /admin/customers/search?q=&excludeGroupId=` (max 10) · `POST /admin/customers` (`CustomerQuickInput`) · `GET /admin/customers/{id}` (→ `CustomerListItem`) · `PUT /admin/customers/{id}` (`CustomerDetailsInput`) · `POST /admin/customers/{id}/status` (`{ status, reason }`) · `POST /admin/customers/{id}/addresses` · `PUT/DELETE /admin/customers/{id}/addresses/{addressId}` — see *Customers (admin)* below | `customers.list()`, `statusCounts()`, `search()`, `create()`, `getListItem()`, `update()`, `setStatus()`, `saveAddress()`, `deleteAddress()` |
| Customer groups | `GET /admin/customer-groups` · `GET /admin/customer-groups/all` · `POST /admin/customer-groups` · `GET/PUT /admin/customer-groups/{id}` (`{ name, description }`) · `POST /admin/customer-groups/{id}/members` (`{ "add": [ids], "remove": [ids] }`). Delete is not built | `customers.listGroups()`, `listGroupSummaries()`, `getGroup()`, `createGroup()`, `updateGroup()`, `assignGroupMembers()` |
| Locations | `GET /locations/postcodes/{code}` → `PostcodeLookup` | `locations.lookupPostcode()` |
| Price rules | `GET /admin/price-rules` · `POST /admin/price-rules` · `GET/PUT /admin/price-rules/{id}` (`PriceRuleInput`) · `POST /admin/price-rules/{id}/status` (`{ "status": "active" \| "disabled" }`) · `GET /admin/rules/test?customerId=&productId=&variationId=&quantity=` → `RuleTestResult` · `GET /admin/rules/products/{id}` → `RuleProductOption` | `pricing.listRules()`, `getRule()`, `createRule()`, `updateRule()`, `setRuleStatus()`, `testRules()`, `productOption()` |
| Quantity rules | `GET /admin/quantity-rules` · `POST /admin/quantity-rules` · `GET/PUT /admin/quantity-rules/{id}` (`QuantityLimitRuleInput`) · `POST /admin/quantity-rules/{id}/status` · `GET /quantity-limits?productId=&variationId=` → `QuantityLimits` | `quantityRules.list()`, `get()`, `create()`, `update()`, `setStatus()`, `effectiveFor()` |
| Delivery routes | `GET/POST /admin/delivery-routes` · `PATCH/DELETE /admin/delivery-routes/{id}` | `delivery.listRoutes()` |
| Reminders | `GET/POST /admin/reminders` · `PATCH/DELETE /admin/reminders/{id}` | `delivery.listReminders()` |
| Store settings | `GET /admin/settings/store` → `StoreSettings` · `PUT /admin/settings/store` (`StoreSettingsInput`) | `settings.getStore()`, `updateStore()` |
| Payment methods (settings) | `GET /admin/payment-methods` → `PaymentMethodListItem[]` · `GET/PUT /admin/payment-methods/{id}` (`PaymentMethodInput`) · `PUT /admin/payment-methods/order` (`{ "ids": [...] }`) · `GET /checkout/payment-methods` → `CheckoutPaymentMethod[]` — see *Payment methods (admin)* below | `payments.listMethods()`, `getMethod()`, `updateMethod()`, `reorderMethods()`, `checkoutMethods()` |
| Tax | `GET/PUT /admin/tax/settings` (`TaxSettingsInput`) · `GET /admin/tax/classes` → `TaxClassUsage[]` · `GET /admin/tax/rates` (listing params; `taxClass`, `enabled`) · `POST /admin/tax/rates` · `GET/PUT/DELETE /admin/tax/rates/{id}` (`TaxRateInput`) · `POST /admin/tax/preview` (`TaxPreviewInput` → `TaxPreviewResult`) — see *Tax (admin)* below | `tax.getSettings()`, `updateSettings()`, `classes()`, `listRates()`, `getRate()`, `createRate()`, `updateRate()`, `deleteRate()`, `snapshotFor()`, `preview()` |
| Shipping | `GET /admin/shipping/zones` · `POST /admin/shipping/zones` · `GET/PUT/DELETE /admin/shipping/zones/{id}` (`ShippingZoneInput`; the fallback zone can't be deleted) · `POST /admin/shipping/quote` (`ShippingQuoteInput` → `ShippingQuoteResult`) — see *Store settings and shipping (admin)* below | `shipping.listZones()`, `getZone()`, `createZone()`, `updateZone()`, `deleteZone()`, `quote()` |
| Analytics | `GET /admin/analytics/dashboard?from=&to=&compareFrom=&compareTo=` | `analytics.getDashboard()` |

### Products and categories (admin)

Types in [`src/lib/types/catalog.ts`](../src/lib/types/catalog.ts): `Product` (= `Inventory` + `Shipping` + product fields),
`ProductVariation`, `ProductAttribute`, `Attribute` / `AttributeValue` (store-wide, reusable), `Category`, `Brand`, `Tag`,
`ShippingClass`, `TaxClassOption`, the payloads `ProductInput` / `VariationInput` / `CategoryInput`, and the list shapes
`AdminProductRow`, `AdminCategoryRow` and `ProductPick`.

- **Simple vs variable.** `type: "simple"` uses the product-level `basePrice`, `salePrice` (+ optional `saleFrom`/`saleTo`
  calendar dates) and inventory fields. `type: "variable"` uses `attributes` with `variation: true` to define the options,
  `defaultAttributes` (pre-selected option per attribute) and `variations[]`. Attributes with `variation: false` are product
  information (`visible` = shown under "Additional information"); simple products may have them too.
- **Store-wide vs product-specific attributes.** `attributeId` links to a store-wide `Attribute`; its `values` may mix
  store values and product-specific extra values (names). "Create value" adds a store-wide value
  (`POST /admin/attributes/{id}/values`). Omitting `attributeId` = a custom attribute for this product only. The order of
  `attributes` is the display order.
- **Parent vs variation settings.** On a variation, an omitted `weight`, `dimensions`, `shippingClassId`, `taxClass` or
  `backorders` means "same as the product". `stockMode` is `parent` (uses the product-level stock, which must be tracked),
  `track` (own `stockQuantity`) or `status` (own manual `stockStatus`). Each variation also has `status`
  (`active`/`disabled`), SKU, optional GTIN, prices and sale dates, `image` (a product gallery image or one uploaded for the
  variation only), `gallery` and a short `description`.
- **Inventory** (product level): `manageStock`, quantity or manual status, `backorders` (`no`/`notify`/`allow`),
  `lowStockThreshold` (omitted = store-wide threshold from `GET /admin/settings/catalog`) and `soldIndividually`.
- **Tax and shipping** reference future settings: `taxStatus` (`taxable`/`shipping`/`none`) and `taxClass`; `shippingClassId`,
  `weight` and optional `dimensions`. No rates are calculated in the frontend.
- **Tags** are sent as names in `ProductInput.tags`; unknown names create tags. `brandIds` (several allowed, as on the old
  store) reference `Brand`s; the form can create a brand (`POST /admin/brands`) and a category (`POST /admin/categories`) inline.
- **Linked products:** `upsellIds`, `crossSellIds` (max 20, never the product itself). The form finds them with
  `GET /admin/products/search` (max 10 results) — the full catalog is never sent to the browser.
- **Legacy / migration fields:** optional `legacyWooId` on products, variations, categories, brands, tags, attributes and
  attribute values (the old WooCommerce IDs, for mapping only). `initialStock` ("initial number in stock") and
  `unitOfMeasure` ("unit of measurement") are stored as-is from the old store; no logic depends on them.
- **Import provenance (admin only):** records imported from the old store carry `importSource` (`ImportSource` in
  [`catalog.ts`](../src/lib/types/catalog.ts); variations a subset): source currency, source regular/sale price strings and
  sale dates, source weight/dimension units, the original SKU when a `WC-<id>` SKU was generated, and tax/shipping class
  slugs that could not be mapped. Values are never converted. When the source currency is not the store currency the
  record has **no** `basePrice`/`salePrice` and cannot be ordered until a store-currency price is set. Saving through the
  admin form keeps `importSource`; duplicates drop it; public responses (`GET /products/{slug}`) must omit it.
- **Descriptions** may contain HTML (imported). The frontend renders `description` through an allowlist sanitizer
  ([`src/lib/html/sanitize.ts`](../src/lib/html/sanitize.ts): formatting tags only, no attributes/links/scripts); the backend
  should sanitize on write with the same allowlist. `shortDescription` is plain text.
- **Writes return the saved `Product`** (create → `201`). Validation failures return `422` with field paths in `error.fields`,
  e.g. `{ "sku": "…", "variations.2.salePrice": "…", "images.0.alt": "…", "defaultAttributes.Size": "…" }`.
- **Rules the backend must enforce.** The form checks the same (see
  [`src/lib/validation/product.ts`](../src/lib/validation/product.ts)); only the backend can check uniqueness and references:
  - required name, slug (`^[a-z0-9]+(-[a-z0-9]+)*$`), SKU and selling unit; optional GTIN of 8, 12, 13 or 14 digits;
  - **unique slug** and **unique SKUs across all products and variations**; existing brand, shipping class and linked products;
  - prices ≥ 0 with `salePrice < basePrice`; sale dates need a sale price and `saleTo ≥ saleFrom`;
  - when publishing: at least one category, and a price for simple products and every enabled variation (an enabled
    variation without a price cannot be purchased — the form warns and blocks publishing);
  - weight > 0; dimensions all three > 0 or none; whole-number quantities and thresholds ≥ 0; integer display order;
  - variable products: ≥ 1 variation attribute, 1–100 variations, one complete and **unique combination** per variation,
    valid default selections, and `stockMode: parent` only when the product tracks stock;
  - image alt text (product gallery and variation images); at most 20 tags of ≤ 40 characters; existing brand IDs;
  - a category's parent must exist and must not be the category itself or one of its descendants.
- **Duplicate** creates a `draft` copy named "(copy)" with a unique slug, unique SKUs (`-COPY`), no GTINs and no legacy IDs.
- **Archive** (`status: archived`) hides the product from the store and the default admin list but keeps it for order
  history. The UI has no hard delete.
- **Category assignment** (`POST /admin/categories/{id}/products`) adds or removes the category on products immediately;
  products can also be assigned from the product form.
- **Stock status** for tracked stock is derived by the backend (mock: ≤ 0 out of stock, ≤ threshold low stock). A variable
  product's `stock` is a summary of its enabled variations.
- **Images.** The frontend sends `ProductImage` objects (media-host URL, alt, width, height). Upload (`POST /admin/media`),
  resizing and storage are backend work. The demo only previews local files and never sends them.
- **Rules module dependency.** `Product.quantityRule` (min / max / increment) is **not** part of `ProductInput`: it is an
  extension point for the future Rules module together with customer- and group-specific discounts. The backend keeps the
  stored value when a product is saved.
- **Not modelled yet:** bulk/tier prices, brand/tag/attribute management screens, product reviews, rich-text descriptions,
  scheduled publishing and private/password visibility, SEO fields, virtual/downloadable products, import from the current
  store.

### Dashboard analytics

`GET /admin/analytics/dashboard?from=2026-09-01&to=2026-09-30&compareFrom=2026-08-01&compareTo=2026-08-31`
→ `DashboardSummary` ([`src/lib/types/analytics.ts`](../src/lib/types/analytics.ts)). Dates are inclusive calendar dates
in the store time zone; ranges are at most 366 days; omit `compareFrom`/`compareTo` for no comparison. The frontend
resolves presets ("last month", "same period last year", …) into explicit dates before calling.

Definitions the frontend currently assumes (confirm or change):

| Field | Definition |
| --- | --- |
| `kpis.revenue` | Net sales: item totals after discounts and weight/price adjustments, **excluding tax** (tax-inclusive orders have their tax removed via `totals.itemsNet`); excludes shipping and cancelled orders. Product/category rankings use `items[].lineNet` on the same basis |
| `kpis.orders` | Orders placed in the range, excluding cancelled |
| `kpis.activeCustomers` | Distinct customers with a non-cancelled order in the range |
| `kpis.averageOrderValue` | `revenue / orders`, rounded |
| `kpis.newOrders` | Non-cancelled orders in the range that were the customer's first non-cancelled order (`src/lib/orders/order-type.ts`); walk-ins excluded. Links to `/admin/orders?type=first&status=active&from=&to=` |
| `kpis.repeatOrders` | Non-cancelled orders in the range from customers with an earlier non-cancelled order. Links to `type=repeat` |
| `revenueSeries` | Revenue per bucket; daily up to 92 days, otherwise weekly (`granularity`). `previous` is bucketed from the comparison start and aligned by index |
| `orderStatus` | Count of all orders placed in the range per status (including cancelled) |
| `topProducts` / `topCategories` / `topCustomers` | Top 5 by revenue; `previousRevenue` for the comparison range. A product in several categories counts towards each |
| `recentOrders` | Latest 5 orders in the range |
| `lowStock` | Current products at or below the alert level (not range-dependent) |
| `pendingApprovals` | Current `pending` applications (not range-dependent) |

```json
{
  "range": { "from": "2026-09-01", "to": "2026-09-30" },
  "compare": { "from": "2026-08-01", "to": "2026-08-31" },
  "granularity": "day",
  "kpis": {
    "revenue": { "current": 2343532, "previous": 2248969 },
    "orders": { "current": 297, "previous": 286 },
    "activeCustomers": { "current": 42, "previous": 40 },
    "averageOrderValue": { "current": 7891, "previous": 7864 }
  },
  "revenueSeries": {
    "current": [{ "date": "2026-09-01", "value": 84210 }, "…"],
    "previous": [{ "date": "2026-08-01", "value": 79120 }, "…"]
  },
  "orderStatus": [{ "status": "delivered", "count": 262 }, { "status": "cancelled", "count": 12 }, "…"],
  "topProducts": [{ "id": "p-004", "name": "Refined Sugar", "detail": "95 units", "revenue": 589000, "previousRevenue": 483000 }, "…"],
  "topCategories": ["…"],
  "topCustomers": ["…"],
  "recentOrders": [{ "id": "ord-25526", "number": "ORD-25526", "customerName": "Example Mart Agrabad", "location": "Chattogram", "total": 11502, "status": "preparing", "placedAt": "2026-09-30T18:05:00+06:00" }, "…"],
  "lowStock": [{ "productId": "p-010", "name": "Chickpeas (Kabuli Chana)", "quantity": 6, "unitLabel": "sack" }],
  "pendingApprovals": 3
}
```

### Customers (admin)

There is one customer record per business, shared by the customer portal, Admin Orders (customer search, addresses,
price lookups) and Admin Customers. Customers are **never deleted** — orders reference them by `id` and keep their own
snapshot of name, contact details and addresses, so editing or deleting an address never changes past orders.
Migrated records may carry `legacyWooId` (customers, addresses, groups).

**Quick add** `POST /admin/customers` — only the essentials; everything else can be completed later:

```json
{ "companyName": "Test Bakery Uttara", "contactName": "Optional", "phone": "01819-555666", "email": null, "status": "pending", "groupId": "grp-retail" }
```

Rules: business name 2–120 chars; **phone or email** required; Bangladesh phone format; email/phone unique across
customers (`422` naming the other customer); initial status `pending` or `approved` (approving needs the approve
permission). Creates the first `statusHistory` entry. No login is created and nothing is sent.

**Approval workflow** `POST /admin/customers/{id}/status` — `{ "status": "suspended", "reason": "Overdue invoices" }`

| From | Allowed to | Reason |
| --- | --- | --- |
| `pending` | `approved`, `rejected` | required to reject |
| `approved` | `suspended` | required |
| `suspended` | `approved` (reactivate) | optional |
| `rejected` | `approved`, `pending` (reopen) | optional |

Reasons are 5–300 chars when required (≤ 300 when optional). Every change appends an `AccountStatusEvent`
`{ id, from, to, reason, at, by: Actor }`; `approvedAt` is set on first approval. Only `approved` customers see prices
and can order (`403 account_not_approved` otherwise); suspending does not change existing orders. Sending approval /
rejection emails belongs to the notifications module.

**Addresses** `POST /admin/customers/{id}/addresses` (create) · `PUT …/addresses/{addressId}` (update) — body
`AddressInput`: `type` (`shipping` | `billing`), `label`, `recipientName`, `companyName?`, `phone`,
`addressLine1`, `addressLine2?`, `area?` (upazila/thana), `city`, `prefecture` (one of the 8 prefectures),
`postalCode` (4 digits), `isDefault`. Exactly one default per type is kept: the first address of a type becomes
default, setting a new default clears the old one, and deleting the default promotes the next address of that type.

**Postcode lookup** `GET /locations/postcodes/1230` →
`{ "status": "found", "postalCode": "1230", "matches": [{ "postOffice": "Uttara Model Town", "area": "Uttara", "city": "Dhaka", "prefecture": "Dhaka" }] }`
or `{ "status": "not_found", "postalCode": "8700", "datasetSize": 12 }`. The UI only **suggests** — staff click
"Use this" to fill the fields and can always edit them. `not_found` means "not in the data", never "invalid". The
mock has 12 sample entries; the backend needs a maintained, verified postcode dataset.

**Groups** — `id` is stable (renaming keeps it) and is what future price rules and quantity rules target
(`scope: { type: "group", groupId }`). A customer is in at most one group; adding a customer to a group moves it
from its previous group. Names are unique (case-insensitive).

### Pricing and quantity rules (admin)

Types: [`src/lib/types/pricing.ts`](../src/lib/types/pricing.ts). Reference behaviour (pure, tested):
[`src/lib/pricing/engine.ts`](../src/lib/pricing/engine.ts) and `tests/pricing-engine.test.ts`. Rules may carry
`legacyWooId`. Mock permission: `pricing.manage`.

`POST /admin/price-rules` → `201 PriceRule`

```json
{
  "name": "Retail — drinks bulk tiers",
  "status": "active",
  "audience": { "type": "group", "groupId": "grp-retail" },
  "target": { "type": "categories", "categoryIds": ["cat-drinks"] },
  "tiers": [
    { "minQuantity": 5, "maxQuantity": 19, "adjustment": { "type": "percent_off", "percent": 8 } },
    { "minQuantity": 20, "adjustment": { "type": "percent_off", "percent": 12 } }
  ],
  "priority": 0,
  "validFrom": null,
  "validTo": "2026-12-31T23:59:59+06:00"
}
```

- `audience`: `{ "type": "all" }` (all approved customers) · `{ "type": "group", "groupId" }` · `{ "type": "customer", "customerId" }`.
- `target`: `{ "type": "all" }` · `{ "type": "categories", "categoryIds": [...] }` (includes subcategories) ·
  `{ "type": "products", "productIds": [...] }` (all their variations) · `{ "type": "variations", "productId", "variationIds": [...] }`.
- `adjustment`: `fixed_price` (`amount` = final unit price) · `amount_off` (`amount` > 0 taka off the base) ·
  `percent_off` (`percent` 0 < p ≤ 100, max 2 decimals).
- Validation (`422`): name 3–120 chars; non-empty target and existing ids; 1–10 tiers, whole quantities 1–100 000,
  sorted, **non-overlapping**, only the last tier may omit `maxQuantity` ("and above"); priority integer −1000…1000;
  `validTo` ≥ `validFrom`; **no tier may make any currently targeted product/variation price negative** (error names the
  product). At calculation time a rule that would still go negative (e.g. base price lowered later) is skipped.
- Below the first tier's `minQuantity` the rule does not apply (another rule or the base price is used).
- List items add `conflicts: [{ ruleId, otherId, otherName, kind }]`: two **enabled** rules with the same audience
  (same group/customer), same target level with a shared id, overlapping dates and overlapping tier ranges.
  `kind: "overlap"` = different priorities (decided by priority); `"conflict"` = same priority (decided by age —
  ask staff to set priorities). Two different categories that share a product are not reported (they still resolve
  deterministically).

`POST /admin/quantity-rules` → `201 QuantityLimitRule`

```json
{ "name": "Spices — minimum 2 per line", "status": "active", "target": { "type": "categories", "categoryIds": ["cat-spices"] }, "minQuantity": 2, "maxQuantity": null, "priority": 0 }
```

Min and/or max (at least one), whole numbers ≥ 1, `min ≤ max`. Limits are **per order line**: a category rule
applies to each matching product line separately and never to the combined category quantity. Pack multiples
(`step`) remain a product setting (`Product.quantityRule.step`); the product's old `min`/`max` fields are legacy
and were migrated into quantity rules.

`GET /admin/rules/test?customerId=cus-001&productId=p-001&variationId=p-001-20&quantity=10` → `RuleTestResult`
(abridged):

```json
{
  "customer": { "id": "cus-001", "companyName": "Sample Kitchen Gulshan", "status": "approved", "groupName": "Restaurants" },
  "product": { "id": "p-001", "name": "Premium Basmati Rice", "unitLabel": "bag", "variationLabel": "20 kg" },
  "price": {
    "basePrice": 4400, "quantity": 10, "unitPrice": 4200, "lineTotal": 42000,
    "rule": { "id": "rule-004", "name": "Sample Kitchen — basmati 20 kg contract price", "…": "…" },
    "tier": { "minQuantity": 1, "adjustment": { "type": "fixed_price", "amount": 4200 } },
    "candidates": [
      { "rule": { "id": "rule-004" }, "outcome": "winner", "unitPrice": 4200, "reason": "Highest precedence among eligible rules." },
      { "rule": { "id": "rule-006" }, "outcome": "outranked", "unitPrice": 4280, "reason": "… is customer-specific, which beats customer group rules." },
      { "rule": { "id": "rule-001" }, "outcome": "outranked", "unitPrice": 4180, "reason": "… is customer-specific, which beats customer group rules." }
    ],
    "explanation": "“Sample Kitchen — basmati 20 kg contract price” (customer-specific, variation level, priority 0) applies tier 1+. …"
  },
  "limits": { "min": 1, "max": 20, "rule": { "id": "qty-004" }, "explanation": "…" },
  "quantityError": null
}
```

Note that rule-001 would give a *lower* price (৳4,180) but loses: precedence is about who/what the rule targets, not
the cheapest result, and discounts never stack.

**Order integration.** `GET /admin/orders/quote-line?customerId=&productId=&variationId=&quantity=` →
`OrderLineQuote { unitPrice, basePrice, salePrice?, priceSource, ruleName?, tierLabel?, minQuantity, maxQuantity?, quantityError? }`
(`orders.quoteLine()`); `OrderableOption` adds `minQuantity`/`maxQuantity`. On `POST /admin/orders` the server
rejects quantities outside the effective limits (`422 items.N.quantity`) and stores
`OrderItem.pricing = { basePrice, salePrice?, rulePrice?, ruleUnitPrice, source, ruleId?, ruleName?, tier?, manualOverride }` — a **snapshot**: editing
or disabling the rule later never changes existing orders. `manualOverride` is true when staff agreed a different
unit price than the rule price.

### Store settings and shipping (admin)

Types: [`src/lib/types/shipping.ts`](../src/lib/types/shipping.ts). Reference behaviour (pure, tested):
[`src/lib/shipping/engine.ts`](../src/lib/shipping/engine.ts) and `tests/shipping-engine.test.ts`. Mock permissions:
`settings.manage`, `shipping.manage`. **All seeded rates are sample values.**

`PUT /admin/settings/store`

```json
{
  "storeName": "Wholesale Store",
  "email": "info@example.com",
  "phone": "+880 1700-000000",
  "address": { "addressLine1": "House 00, Road 00 (sample)", "area": "Tejgaon", "city": "Dhaka", "prefecture": "Dhaka", "postalCode": "1208", "country": "BD" },
  "weightUnit": "kg",
  "dimensionUnit": "cm"
}
```

The response adds `currency: "BDT"` and `timeZone: "Asia/Dhaka"` (fixed in this version) and `updatedAt`. The store
address is where orders ship from; it is unrelated to a product's `originCountry`. `weightUnit`/`dimensionUnit` are
the defaults for new products; shipping always calculates in grams.

`POST /admin/shipping/zones` → `201 ShippingZone`

```json
{
  "name": "Greater Dhaka",
  "locations": [
    { "type": "city", "prefecture": "Dhaka", "city": "Gazipur" },
    { "type": "city", "prefecture": "Dhaka", "city": "Narayanganj" }
  ],
  "methods": [
    {
      "type": "weight_tiers", "name": "Delivery by weight", "enabled": true,
      "tiers": [{ "from": 0, "cost": 250 }, { "from": 50000, "cost": 450 }, { "from": 200000, "cost": 800 }],
      "classAdjustments": [{ "shippingClassId": "ship-frozen", "amount": 300, "per": "order" }]
    },
    { "type": "free_shipping", "name": "Free delivery over ৳25,000", "enabled": true, "minSubtotal": 25000 }
  ]
}
```

- `locations`: `{ "type": "prefecture", prefecture }` · `{ "type": "city", prefecture, city }` · `{ "type": "postcode", postalCode }`.
  **Each prefecture, city (per prefecture) and postcode may belong to one zone only** (`422 locations.N` names the
  other zone). Exactly one zone has `isFallback: true`; it has no locations and cannot be deleted.
- **Matching (deterministic):** exact postcode → city (prefecture + city) → prefecture → fallback. Text compares
  ignore case and extra spaces. Addresses without a postcode still match by city/prefecture.
- Methods: `flat_rate { cost, classAdjustments }` · `weight_tiers { tiers (from = grams), classAdjustments }` ·
  `subtotal_tiers { tiers (from = taka), classAdjustments }` · `free_shipping { minSubtotal > 0 }` (at most one per zone) ·
  `local_pickup { cost, instructions? }` (at most one per zone). Max 10 methods.
- **Tiers** apply from `from` (inclusive) up to the next tier's `from`; the first tier must start at 0 and `from`
  must strictly increase — so tiers cannot overlap or leave gaps. Max 20 tiers; costs ≥ 0 with ≤ 2 decimals.
- `classAdjustments`: `{ shippingClassId, amount > 0, per: "order" | "unit" }`, one per class per method, existing class.
- **Calculation:** weight = Σ unit weight × quantity, where a **variation's own weight (and shipping class) overrides the
  product's**; subtotal = Σ unit price × quantity − line discounts (before VAT and shipping); money in integer paisa.
  Cost = flat cost or the matching tier's cost, plus class adjustments (per order once, or × units of that class).
  Free shipping is available at or above `minSubtotal`.
- **Suggested method:** the cheapest available delivery method in the matched zone (ties → the method listed first).
  Local pickup is returned as an option but never suggested automatically. No available method → no suggestion; staff
  must enter an agreed charge.

`POST /admin/shipping/quote` — `{ "address": { "prefecture": "Dhaka", "city": "Gazipur", "postalCode": null }, "items": [{ "productId": "p-001", "variationId": "p-001-20", "quantity": 3 }], "customerId": null }`
→ `ShippingQuoteResult` (abridged):

```json
{
  "quote": {
    "match": { "zone": { "id": "zone-greater-dhaka", "name": "Greater Dhaka" }, "level": "city", "explanation": "Matched “Greater Dhaka” by city: Gazipur, Dhaka." },
    "metrics": { "units": 3, "totalGrams": 60000, "subtotal": 12750, "classUnits": { "ship-heavy": 3 } },
    "options": [
      { "method": { "id": "m-gd-weight", "type": "weight_tiers" }, "available": true, "cost": 450, "breakdown": ["Weight 60 kg → tier from 50 kg: ৳450"] },
      { "method": { "id": "m-gd-free", "type": "free_shipping" }, "available": false, "reason": "Needs a subtotal of at least ৳25,000 (now ৳12,750)." }
    ],
    "selected": { "method": { "id": "m-gd-weight" }, "cost": 450 },
    "explanation": "Matched “Greater Dhaka” by city: Gazipur, Dhaka. Suggested “Delivery by weight” — the cheapest of 1 available delivery method."
  },
  "lines": [{ "productId": "p-001", "variationId": "p-001-20", "quantity": 3, "unitGrams": 20000, "weightFrom": "variation", "shippingClassId": "ship-heavy", "unitPrice": 4250, "priceSource": "sale" }],
  "skipped": []
}
```

Line prices: the given `unitPrice`, else the customer's price (B2B rule / sale / regular) when `customerId` is set,
else the active sale or regular price. The backend must repeat matching, validation and calculation at cart,
checkout and order creation; it should also use a maintained Bangladesh location/postcode dataset.

### Payment methods (admin)

Types: [`src/lib/types/payment.ts`](../src/lib/types/payment.ts). Rules (pure, tested):
[`src/lib/payments/methods.ts`](../src/lib/payments/methods.ts) and `tests/payment-methods.test.ts`. Mock permission:
`payments.manage`. **Configuration only:** nothing processes payments, collects card data, stores gateway secrets,
or changes an order's `paymentStatus` when a method is chosen.

Methods (fixed set): `pay_on_delivery` (old store gateway `cod`, order method `cash_on_delivery`), `bank_transfer`
(`bacs`, order method `bank_transfer`) and `online` (placeholder). Each has `enabled`, `sortOrder`, customer-facing
`title` (2–60), `description` (≤ 160) and `instructions` (≤ 1000). Bank transfer adds `bank`: `accountName`,
`bankName`, `accountNumber` (6–30 digits; spaces/dashes allowed), optional `branchName`, `routingNumber` (9 digits) —
required only to **enable** the method. Demo bank values are fictional.

`PUT /admin/payment-methods/bank_transfer`

```json
{ "enabled": true, "title": "Bank transfer", "description": "Transfer the order total to our bank account.", "instructions": "Use your order number as the payment reference.", "bank": { "accountName": "Wholesale Store (demo, fictional)", "bankName": "Example Bank Ltd. (fictional)", "accountNumber": "0000 1234 5678 90", "branchName": "Sample Branch, Dhaka (fictional)", "routingNumber": "000000000" } }
```

**Availability** (`availability: { configured, availableAtCheckout, reasons[] }`): pay on delivery → when enabled; bank
transfer → when enabled and account name, bank name and account number are set; online → only when enabled **and**
`online.status === "connected"`. The online connection state is read-only for the frontend: only the backend may set
it after a provider integration exists. Provider credentials (API keys, secrets, webhook secrets) must live only in
backend configuration — never in API responses, client code or browser storage.

`GET /checkout/payment-methods` (for the future checkout) → enabled **and** available methods in display order, with
customer-facing fields only (`id`, `title`, `description`, `instructions`, and `bank` for bank transfer). Today it
returns pay on delivery and bank transfer; online is excluded while not connected.

Backend requirements: persist settings; authorize `payments.manage`; validate as above; re-check availability when an
order is placed (reject a method that is no longer available); record the order's `payment.method` with
`paymentStatus` `unpaid`/`invoiced` — never `paid` on selection. Marking paid, refunds, provider webhooks and
reconciliation are a later payments module.

### Tax (admin)

Types: [`src/lib/types/tax.ts`](../src/lib/types/tax.ts). Reference behaviour (pure, tested):
[`src/lib/tax/engine.ts`](../src/lib/tax/engine.ts) and `tests/tax-engine.test.ts`. Mock permission: `tax.manage`.
**All seeded rates are fictional demo values — none is the current Bangladesh legal rate.** The backend performs the
authoritative calculation; tax filing, payment collection and refunds are out of scope.

The demo starts with tax **off** (`enabled: false`); the fictional example rates apply only after an admin enables it.

`PUT /admin/tax/settings` — `{ "enabled": true, "pricesIncludeTax": false, "shippingTaxable": false, "shippingTaxClass": "standard" }`
(`shippingTaxClass` must exist and cannot be `exempt` when shipping is taxable). Shipping is **not** assumed taxable.

**Classes** are the product editor's tax classes (`standard`, `reduced`, `exempt`): a product has `taxClass` and
`taxStatus` (`taxable` | `shipping` | `none`); a variation inherits the product's class unless it sets its own
`taxClass`. Only products with `taxStatus: "taxable"` are taxed; `exempt` is never taxed.

`POST /admin/tax/rates` → `201 TaxRate`

```json
{ "name": "Demo Gazipur standard (fictional)", "percent": 8, "taxClass": "standard", "location": { "type": "city", "prefecture": "Dhaka", "city": "Gazipur" }, "enabled": true }
```

- `location`: `{ "type": "country", "country": "BD" }` (fallback) · `{ "type": "prefecture", prefecture }` ·
  `{ "type": "city", prefecture, city }` · `{ "type": "postcode", postalCode }`.
- Validation (`422`): name 2–80 chars; `percent` 0–100 with ≤ 2 decimals (0 = zero-rated); existing, non-exempt class;
  valid prefecture / 4-digit postcode / BD only; **at most one enabled rate per class + location** (error names the
  other rate).
- **Matching (per line class, one rate per line, never stacked):** exact postcode → city (within its prefecture) →
  prefecture → country. Text ignores case and extra spaces. No match → the line is untaxed. A class without a
  country-wide rate has no fallback (shown in `GET /admin/tax/classes` as `hasFallback: false`).

**Calculation (integer paisa, one rounding method):**
1. Line amount = unit price × quantity − line discount (discount never exceeds the line); **discounts come before
   tax**. Weight-priced lines are scaled to the packed weight first. Each line amount is rounded half-up to the paisa.
2. Lines — and shipping, when taxable, at the rate matched for `shippingTaxClass` — are grouped by applied rate.
3. Per applied rate, tax is calculated once on the items and once on the shipping, each rounded half-up to the paisa:
   prices excluding tax → `amount × p / 100` (added); prices including tax → `amount × p / (100 + p)` (extracted; the
   payable total does not change). Shipping follows the same included/excluded setting.
4. Tax total = Σ rate taxes. Total = items after discounts + shipping (+ tax when prices exclude tax).
5. Each rate's item tax is shared across its lines by largest remainder (exact to the paisa), giving each line a
   net amount. **Net sales** = items after discounts **excluding tax** (`totals.itemsNet`, `items[].lineNet`);
   shipping and shipping tax are never net sales. Orders without a snapshot were tax-exclusive, so their
   `itemsTotal` is already net.

`POST /admin/tax/preview` → `TaxPreviewResult` (abridged, prices excluding tax, Dhaka city, shipping not taxable):

```json
{
  "calc": {
    "enabled": true, "pricesIncludeTax": false,
    "lines": [{ "key": "line-0", "taxClass": "standard", "subtotal": 6500, "discount": 200, "amount": 6300, "rate": { "rateId": "tax-bd-standard", "percent": 10, "matchedBy": "country" } }],
    "shipping": { "amount": 150, "taxable": false, "note": "Shipping is not taxable (tax settings)." },
    "groups": [{ "rate": { "rateId": "tax-bd-standard", "name": "Demo standard rate (fictional)", "percent": 10 }, "taxableAmount": 6300, "taxAmount": 630 }],
    "itemsSubtotal": 6500, "discountTotal": 200, "itemsTotal": 6300, "shippingTotal": 150, "taxTotal": 630, "total": 7080, "netTotal": 6450
  },
  "lines": [{ "productId": "p-013", "quantity": 10, "unitPrice": 650, "priceSource": "sale", "taxClass": "standard", "classFrom": "product", "taxable": true }],
  "shipping": { "zoneName": "Dhaka city", "selectedId": "m-dhaka-flat", "amount": 150, "options": ["…"] },
  "matches": [{ "taxClass": "standard", "explanation": "Demo standard rate (fictional) — 10% (country (fallback))" }]
}
```

**Orders.** `POST /admin/orders` stores `taxSnapshot = { enabled, pricesIncludeTax, shippingTaxable, ratesByClass,
shippingRate?, capturedAt }` — the settings plus the rate matched per class for the delivery address — and each item's
`taxable` flag. `taxes[]` gains `rateId` and `rateName`; `totals.taxIncluded` is true for tax-inclusive orders. Any
later recalculation (e.g. item adjustments) uses the order's snapshot, never current settings or rates, so editing or
deleting a rate never changes existing orders. Orders created before tax settings existed keep their stored
placeholder per-class VAT unchanged.

### Orders (admin)

Every mutation returns the updated `Order` (or `422` with field errors) and is recorded with the acting admin
(`Actor`: id, name, role). Permissions used by the frontend mock: `orders.create`, `orders.update`,
`orders.adjust`, `orders.refund` — the backend must check them.

**Status flow:** `received` → `preparing` → `on_the_way` → `delivered`, one step at a time. `cancelled` is
allowed from any status except `delivered`, needs a reason (≥ 5 characters) and is final. Each change appends a
`StatusEvent` to `statusHistory`.

`POST /admin/orders/ord-10042/status` — `{ "status": "cancelled", "note": "Customer changed the order" }`

**Notes:** `POST /admin/orders/{id}/notes` — `{ "type": "admin" | "customer", "body": "…" }` (≤ 1000 chars).
`admin` notes are staff-only and must never appear in `/customer/*` responses. Adding a `customer` note does not
send anything until the notifications module exists.

**Create on behalf of a customer:** `POST /admin/orders` (send `Idempotency-Key`)

```json
{
  "customerId": "cus-001",
  "billingAddress": { "recipientName": "Accounts", "companyName": "Sample Kitchen Gulshan", "country": "BD", "prefecture": "Dhaka", "city": "Dhaka", "area": "Gulshan", "postalCode": "1212", "addressLine1": "House 00, Road 00 (sample)", "phone": "+880 1700-000003" },
  "shippingAddress": { "recipientName": "Rahim Uddin", "country": "BD", "prefecture": "Dhaka", "city": "Dhaka", "postalCode": "1212", "addressLine1": "House 00, Road 00 (sample)", "phone": "+880 1700-000001" },
  "items": [{ "productId": "p-001", "variationId": "p-001-5", "quantity": 3, "unitPrice": 1093, "discount": 100 }],
  "shipping": { "label": "Standard delivery — Dhaka city", "amount": 150, "mode": "suggested" },
  "paymentMethod": "cash_on_delivery",
  "requestedDeliveryDate": "2026-10-06",
  "customerNote": "Please call on arrival.",
  "adminNote": "Phone order from buyer"
}
```

Rules: approved customer only; products not archived; variable products need an active `variationId`; whole
quantities 1–10,000; `discount` ≤ line amount; 4-digit postcode. The server snapshots name, SKU, attributes,
unit label, tax class, catalog price and ordered weight into each `OrderItem`; `unitPrice` is the agreed price.
New orders start as `received`, `createdVia: "admin"`, `createdBy` = the admin, `paymentStatus` `invoiced`
for the invoice method and `unpaid` otherwise. No payment is taken and nothing is sent.

**Shipping on admin orders.** `shipping.mode` is `"suggested"` or `"manual"`. The server re-quotes shipping from the
delivery address and the lines (agreed unit prices and discounts). For `suggested`, `amount` must equal the server's
suggestion, else `422 shipping.amount` ("the suggested charge is now …") — and it is rejected when no rule applies. For
`manual`, any valid amount is accepted with `reason` (5–300 chars). The order stores
`shipping.decision = { mode, suggestedAmount?, zoneId?, zoneName?, methodId?, methodName?, reason? }`. The saved
`shipping.amount` is never recalculated: editing zones or rates never changes existing orders.

**Walk-in orders** (no customer account): send `walkIn: { name, companyName?, email?, phone? }` instead of `customerId`.
Only the name (2–200 chars) is required; email and phone are validated only when given. No account or login is
created; the order has no `customerId` and stores `walkIn: { name, companyName? }`, `customerName` (company, else name)
and the optional email/phone. Walk-in lines are priced at the **catalog price** (the active sale price when lower) —
customer/group rules need an approved account; `GET …/orderable-products/{productId}` without `customerId` returns those
prices. `fulfilment`: `"delivery"` (default; addresses required, but the phone may be empty for walk-ins) or `"pickup"`
(walk-in only): no addresses, `shipping` = `{ label: "Collected in store", amount: 0 }` with a manual decision, and the tax
snapshot uses the **store's address** (`GET /admin/settings/store`). Walk-in orders never appear in a customer portal and
are left out of customer counts and top-customer rankings. Edits (`/edits`) on walk-in orders use catalog prices too.

Lookups for the form: `GET /admin/orders/customers?q=` (approved customers, max 10: id, companyName, contactName,
phone) · `GET /admin/orders/customers/{id}` → `OrderCustomerContext` (contact + addresses) · `POST /admin/shipping/quote` for the
suggested shipping charge · `GET /admin/orders/orderable-products/{productId}?customerId=` → `OrderableProduct` (each
option with `catalogPrice` and the customer's resolved `customerPrice`).

**Item adjustment** (order-level only; never changes the catalog): `POST /admin/orders/ord-10042/adjustments`

```json
{ "itemId": "oi-1", "unitPrice": 4000, "reason": "Agreed bulk price with buyer" }
```

Send `quantity`, `unitPrice` and/or `fulfilledWeight` (`{ "value": 10.4, "unit": "kg" }`) — at least one must change —
and a reason (5–300 chars). Not allowed on cancelled orders; `quantity` only until delivery (and within the quantity
rules). A new quantity scales `orderedWeight` (same weight per unit, to the gram); the agreed unit price stays. For
`pricedByWeight` items the line amount is `unitPrice × quantity × fulfilled ÷ ordered weight`; other items only record
the weight. The server recalculates the line, VAT and totals and appends an `OrderAdjustment` (`kind: "adjust"`) with
before/after values. It does not charge or refund the difference. This is the same as an `OrderEdit` of kind `adjust`.

**Order editing** (order-level only; catalog prices and rules never change): `POST /admin/orders/{id}/edits` with one
`OrderEdit` ([`src/lib/types/order.ts`](../src/lib/types/order.ts)); `…/edits/preview` takes the same body, runs the same
validation and calculation without saving and returns `OrderEditPreview` (`totalBefore`, `totalAfter`, `difference`,
`lineTotal?`, `orderDiscount`, `balanceAfter?`). The admin UI previews with an empty reason; the save requires it.

| `kind` | Body | Allowed when | Rules |
| --- | --- | --- | --- |
| `adjust` | as above | not cancelled (quantity: received / preparing / on the way) | as above |
| `add` | `{ productId, variationId?, quantity, unitPrice, discount, reason, replaceItemId? }` | received / preparing / on the way | Product not archived, active option for variable products, quantity rules, discount ≤ line amount, not already in the order (change its quantity instead). The line is snapshotted like a new order line, with `pricing` from the customer's rules at that quantity (`manualOverride` when the agreed price differs). With `replaceItemId` the new line takes that item's place in one step (`kind: "replace"` in history). |
| `remove` | `{ itemId, reason }` | received / preparing / on the way | The last item can't be removed — cancel the order instead. |
| `discount` | `{ discount: { type: "fixed" | "percent", value } | null, reason }` | not cancelled | One order-level discount (`Order.discount`). Applied to the items **after line discounts and before tax**: fixed (> 0, ≤ items total) or percent (> 0, ≤ 100, 2 decimals, rounded half-up to the paisa). For tax it is split over the lines in proportion to their line totals (largest remainder, exact to the paisa), so VAT is charged on what the customer pays. `totals.orderDiscount` holds the amount and is included in `discountTotal`/`itemsTotal`; line totals stay before it. `null` removes it. |
| `delivery_date` | `{ date: "YYYY-MM-DD" | null, reason? }` | received / preparing / on the way | Real calendar date; sets `requestedDeliveryDate` (store time zone). |
| `address` | `{ which: "billing" | "shipping", address: OrderAddressInput, reason }` | billing: not cancelled · shipping: received / preparing / on the way · never for store pickup | Same address rules as order creation (7-digit postcode, stored `NNN-NNNN`; phone optional for walk-ins). Replaces the address **on this order only** — the customer's address book is unchanged. The delivery charge and the tax snapshot are **not** re-matched; a different charge is a separate `shipping` edit. At least one field must change. History stores a one-line `address` before/after and `addressType`. |
| `shipping` | `{ label, amount, reason }` | not cancelled | Agreed delivery charge (whole yen ≥ 0, label ≤ 120 chars). Recalculated with the order's own tax basis (shipping tax per the snapshot). `shipping.decision` becomes `mode: "manual"` with the reason, keeping the original suggestion for reference. History stores `shipping` + `shippingLabel` before/after. |

Every saved edit appends an `OrderAdjustment` with `kind`, the item (`orderItemId`, `itemName`, `replacedItemName`),
`reason`, `by`, `at` and `before`/`after` holding only the touched values (`quantity`, `unitPrice`, `fulfilledWeight`,
`lineTotal`, `discount`, `deliveryDate`, `address`, `shipping`, `shippingLabel`) plus `orderTotal`. Older entries without the newer fields read as `adjust`.
An edit that would make the total smaller than the amount already refunded is rejected (`409`).

**Payment already collected.** The first edit of an order whose `paymentStatus` is `paid` or `partially_refunded` stores
`payment.amountPaid` = the net total before that edit. Afterwards `balance = totals.netTotal − amountPaid`: positive =
still to collect, negative = overpaid (a refund is due through the payment method/refund module). Unpaid orders (cash
on delivery, unpaid transfers, invoices not yet paid) have no `amountPaid`; the new total is simply what's due. Nothing
is charged or refunded by an edit.

**Record payment received** (bookkeeping, never a charge): `POST /admin/orders/{id}/payment` — `{ "reference"?: "BT-0001" }`
(≤ 100 chars). Allowed when `paymentStatus` is `unpaid` or `invoiced` and the order is not cancelled; sets `paid`,
`payment.paidAt`, the reference, and adds an internal note. Payment provider webhooks may set the same state.

**Refunds** ([`src/lib/orders/refund.ts`](../src/lib/orders/refund.ts), tested in `tests/refunds.test.ts`): `POST /admin/orders/{id}/refunds`

```json
{ "kind": "order", "lines": [{ "orderItemId": "oi-3", "quantity": 1, "amount": 1639 }], "shipping": 0, "other": 0, "reason": "One can dented on delivery", "restock": true }
```

- Only after payment was collected (`paid` / `partially_refunded`), else `409`.
- `kind: "order"` — items, delivery charge and/or another amount. Each line is capped at its **share of the order total**
  (after line and order discounts, tax included; the total is split over lines and shipping by largest remainder, so
  shares add up exactly), minus what was already refunded on it; `quantity` 0…(ordered − already refunded) — 0 = an
  amount-only correction. `shipping` ≤ shipping share − refunded. Refund total = lines + shipping + other, > 0 and ≤
  **refundable** = min(amount kept, net total). It lowers the order value (`totals.refundedTotal`, `netTotal`) and the
  amount kept, so the balance due is unchanged.
- `kind: "overpayment"` — returns money paid above the current total after an edit (`balance < 0`): one `other`
  amount ≤ the overpaid amount, no lines/shipping/restock. Lowers `payment.amountPaid` only; **not** counted in
  `refundedTotal`.
- `restock: true` adds refunded quantities back to counted stock (status-managed or removed options are skipped with a
  note) and records a stock movement (`source: "refund_restock"`).
- The order gets a `Refund` (`kind`, `amount`, `lines[]` with item names, `shipping`, `restock[]`, `reason`, `by`, `at`,
  `status`). `payment.amountPaid` (when set) is reduced by the refund. `paymentStatus` → `refunded` when nothing is kept,
  else `partially_refunded` (or `paid` after only overpayment refunds).
- **Demo:** the frontend records `status: "recorded"` and moves no money. The backend sends the refund to the payment
  provider (or records a manual bank refund), sets `status: "processed"` when confirmed, and must make the call
  idempotent (send `Idempotency-Key`).

**Stock movements.** Every stock change is logged as a `StockMovement` (`src/lib/types/catalog.ts`): product, option,
SKU, `source` (`product_edit` / `order_page` / `refund_restock`), `before`/`after` stock, `change` (units, counted stock),
order id/number, note, time and who. `GET /admin/products/{id}/stock-movements?page=` → `Paginated<StockMovement>`
(newest first), shown on the product edit page. The backend must also log reservations/deductions when orders are
placed (the demo does not deduct stock at checkout).

**Stock from the order page.** `POST /admin/products/{id}/stock` changes the **catalog** stock of the product or one
variation (everywhere on the site); orders keep their snapshots, so existing orders, amounts and invoices are not
changed. Status-managed stock takes `status` (`in_stock` / `out_of_stock`); counted stock takes `quantity` (integer
0–1,000,000; the status follows it, low stock at the product's threshold). A variation using the product's shared stock
(`stockMode: "parent"`) changes every option sharing it. Archived products and removed/disabled options are rejected.
The admin order page reads each line's current stock live and warns about lines that are out of stock or unavailable;
removing or replacing them is a separate, explicit edit. Permission in the mock: `products.stock`.

**Invoices** (`Order.invoices`, append-only): `POST /admin/orders/{id}/invoices` with `{ "kind": "invoice" | "revision" | "credit_note", "reason"? }`
issues the next document ([`src/lib/orders/invoice.ts`](../src/lib/orders/invoice.ts), tested in `tests/invoices.test.ts`):

| `kind` | Allowed when | Number | Notes |
| --- | --- | --- | --- |
| `invoice` | no document yet, order not cancelled | `INV-<year>-<NNNN>` (store time zone; sequence per year across all orders) | |
| `revision` | the latest invoice no longer matches the order (customer, billing address, items, prices, weights, discounts, shipping amount, tax or total — **not** payment status or delivery date) | `<base>-R<n>` | reason required (5–300 chars); `difference` = new total − replaced total |
| `credit_note` | the order is cancelled and its latest document is not a credit note | `<base>-CN` | reason required; `difference` = −replaced total; nothing can follow it |

Each document stores `snapshot: InvoiceSnapshot` — the order's customer, addresses, items (incl. ordered and delivered
weight), order discount, shipping, tax lines, totals and payment details **frozen at issue time**. Issued documents are
never rewritten; later edits need a revision, so the accounting trail stays intact. Any other request → `409` naming the
kind that is allowed. Customers read issued documents only (`GET /customer/orders/{id}` includes `invoices`; no drafts).
The frontend renders them as a printable page ("Print / save as PDF" via the browser); a backend may add PDF files and
real invoice numbering/tax-invoice rules — the demo documents are labelled "not a valid tax invoice" with fictional rates.

---

## 6. Business rules the backend owns

The frontend shows these values but never decides them.

1. **Price resolution (decided).** For one customer, product/variation and line quantity, **exactly one** rule applies —
   discounts never stack. Eligible rules: `status: active`, within `validFrom`/`validTo`, customer is **approved**,
   audience matches (customer id, the customer's single group, or all), target matches (variation id; product id;
   category incl. ancestors; all), a tier covers the quantity, and the result is ≥ 0. Winner = first by:
   1. audience: customer > group > all;
   2. target: variation > product > category > all products;
   3. `priority`: higher first;
   4. `createdAt` older first, then `id` — reported as a conflict.
   **Base price (decided):** percentage and amount-off rules use the **regular** price (`basePrice`), never a sale price;
   a fixed-price rule uses its entered amount. **Effective price (decided):** an approved customer pays the **lower** of the winning rule price and the
   **active sale price** (`salePrice` within `saleFrom`/`saleTo`, inclusive, store date, and below the regular price).
   They are compared, never combined — a B2B discount is never applied to a sale price. Equal → reported as the rule
   price. No eligible rule → the active sale price if any, otherwise the regular price. Responses carry `rulePrice`,
   `salePrice` and `priceSource` (`rule` | `sale` | `regular`) so the UI can show which price won.
   Money: integer paisa; `fixed_price` = amount; `amount_off` = base − amount; `percent_off` = base × (10000 − bp) / 10000
   with bp = percent × 100, rounded **half-up to the paisa** once per unit price; line total = unit price × quantity.
   The backend must enforce this at cart and checkout and re-resolve with each line's real quantity.
2. **Quantity limits (decided).** The most specific enabled rule wins as a whole (variation > product > category >
   all, then priority, then age); unset min = 1, unset max = none; no rule = min 1, no max. Limits are per order line.
   Enforce them (and the product's pack `step`) in the cart, at checkout and on admin-created orders.
3. **Tax (decided rules, fictional demo rates).** Matching, rounding, inclusive/exclusive prices and shipping tax follow
   §5 *Tax (admin)*. The backend owns the real rates and performs the authoritative calculation. Older generated demo
   orders carry placeholder per-class VAT (`standard` 15%, `reduced` 5%) from before the tax module; those are
   not real rates either.
4. **Order total** = items total (line totals after line discounts and weight adjustments, minus the order discount) + shipping + VAT;
   `netTotal` = total − refunds. Same rounding as `src/lib/orders/calc.ts` (see the Money note in §4).
5. **Shipping (decided)** comes from shipping zones (§5 *Store settings and shipping*), not from delivery routes. Routes
   remain the delivery schedule: reject orders after the route's `cutoffTime` for the requested date (`409`). The route
   `shippingFee` / `freeShippingThreshold` fields are legacy (they priced older demo orders) and are not used for quotes.
6. **Variable-weight items** are ordered by unit. Staff record the `fulfilledWeight` through an adjustment, and the
   line amount follows the packed weight. Notifying the customer belongs to the notifications module.
7. **Stock** is checked and reserved at order placement.
8. **Account approval** follows the workflow in §2. Unapproved customers never receive prices.
9. **Reminders** are sent by a backend scheduler. `schedule` is free text for now; agree on a structured format
   before building the scheduler.

---

## 7. Mock-only today

**Persistence of demo edits.** Every editable admin screen writes to in-memory stores on `globalThis` in the server
process (catalog, orders, customers and groups, pricing/quantity rules, store settings, shipping zones, tax, payment
methods). On one long-running server (`next start`, `next dev`) edits survive page refreshes and are lost on restart.
On Vercel, requests are served by short-lived serverless instances that each start from the seed data and do not share
memory: edits may vanish after a cold start, or show on one request and not the next. Treat them as throwaway demo state.
The backend replaces this with a database.

| Feature | Current frontend behaviour | Needs from backend |
| --- | --- | --- |
| Login / logout / session | No auth. The on-screen "Demo view" switcher (`demo-view` cookie; remove it or set `DEMO_VIEW_SWITCHER=off` when real auth exists), else the `MOCK_VIEWER` env var, picks guest / customer (approved) / customer-pending / admin view ([`session.ts`](../src/lib/auth/session.ts)) | §2 auth endpoints |
| Portal and admin access control | **None**. Anyone can open `/account` and `/admin`; a banner says so | Token + role checks on every endpoint |
| Portal customer | Always demo customer `cus-001` | Derived from token |
| Price visibility | Hidden for guests in the UI only (no enforcement). The mock public list omits `basePrice`; only `adminList` returns it | §3 omits prices; §4 prices endpoint; auth on `/admin/*` |
| Price and quantity rules | Create/edit/enable/disable, conflict detection and the Test rules panel work against an **in-memory** store using the reference engine; labelled as demo calculations. Admin orders re-quote by quantity, enforce limits and snapshot the rule | Persistence, the same precedence at cart/checkout, `/customer/prices` with quantity, permissions |
| Dashboard analytics | Date range and comparison work; figures are aggregated from ~21 months of generated mock orders and labelled "Preview data" | `GET /admin/analytics/dashboard` |
| Locale defaults (BD, BDT, Asia/Dhaka) | Static config for formatting; store settings show BDT/Asia-Dhaka as fixed | `/admin/settings/store` |
| Store settings and shipping zones | Store address/contact/units and zones/methods edit an **in-memory** store; rate preview and order suggestions use the reference engine with **sample rates** | Persistence, permissions, real rates, the same calculation at cart/checkout/order creation; courier booking is a later module |
| Registration | Working form → `customers.register()` creates a **pending** customer (business address as delivery + billing) in the in-memory store; appears in Admin → Customers for approval. Optional copies of the Japan Residence Card (front/back) and business license (type checked from content, size limit) kept in server memory and shown to staff on the customer page. No login account or password | `POST /applications` + real accounts, password, email verification, rate limiting |
| Cart / quick order | Server-side cart per approved customer (in memory), re-priced on every read; add from the product page, edit quantities, remove, reorder. Multi-line quick order not built | §4 cart endpoints, persistence |
| Checkout / order placement / payment | Working demo checkout: server-side re-pricing, quantity/stock checks, own addresses, suggested shipping, tax snapshot, offline payment methods, idempotency key; creates an in-memory order. No payment is processed | `POST /customer/orders`, payment provider |
| Order totals and taxes | Pure calculators (`src/lib/orders/calc.ts`, `src/lib/tax/engine.ts`); new admin orders store a tax snapshot; older demo orders keep placeholder VAT | Authoritative server calculation; real rates |
| Tax settings and rates | Settings (tax **off** by default), fictional rates, classes overview and tax preview edit an **in-memory** store | Persistence, real rates, permissions; filing/collection out of scope |
| Payment method settings | Enable/disable, order, titles, instructions and fictional bank details edit an **in-memory** store; online payment is a "Not connected" placeholder | Persistence, provider integration (credentials server-side only), checkout endpoint, payment confirmation |
| Admin orders | List, detail, status changes, notes, create-for-customer and walk-in orders (store pickup or delivery), invoices / revisions / credit notes, order editing (add / remove / replace items, quantities, agreed prices, packed weights, order discount, delivery charge, billing/delivery address, delivery date, live previews, change history, balance after payment) work against an **in-memory** mock store (same limits as products). Stock can be changed from the order page (in-memory catalog). Payment can be recorded as received and refunds recorded (per line / shipping / other amount, overpayment, optional restock, stock movement log) as demo bookkeeping; no payment, refund, email or SMS happens | §5 order endpoints, permissions, stock reservation, payment/refund and notification modules |
| Profile, address, notification edits | Read-only | §4 mutations |
| Product & category editing | Create / edit / duplicate / archive work against an **in-memory** mock store: survives refresh, lost on server restart, shared by everyone using the demo server. Server actions are not access-controlled | §5 product/category endpoints with persistence, admin auth and uniqueness checks |
| Customers and customer groups | Quick add, edit, addresses, approval workflow with audit history, group create/rename/members work against the **in-memory** mock store (same limits as products). No email/SMS, no login created. Permissions are mocked (`customers.manage`, `customers.approve`, `customer-groups.manage`) | §5 customer/group endpoints, uniqueness checks, real authorization, notifications |
| Postcode lookup | 12 sample postcodes, clearly labelled; suggestions only | Verified postcode dataset + `GET /locations/postcodes/{code}` |
| Other admin actions (delivery, reminders) | Read-only tables | §5 mutations |
| Product & category images | Local files are previewed in the browser only — never uploaded or saved | `POST /admin/media` upload + media host |
| Imported catalog (development data) | `npm run import:woocommerce` reads the old WooCommerce store (read-only, credentials in `.env.local` only) and saves a fixture (`src/lib/data/fixtures/woocommerce-catalog.json`) plus images in `public/images/products` and `public/images/categories`. The mock catalog seeds from demo records + this fixture; the demo categories are `hidden`, so storefront navigation, filters and listings show the imported catalog while demo orders/rules/admin keep their records. The running site and builds never contact WordPress. See [`woocommerce-import-report.md`](woocommerce-import-report.md) | A real migration into the backend database and media host (same field mapping, `legacyWooId` kept) |
| Contact form | Not built | Endpoint to be defined |
| Reminders sending | Data only | Scheduler + email |
| Branding (name, logo, colors) | Static [`src/config/site.ts`](../src/config/site.ts) | Optional |

---

## 8. Open questions for the backend team

- Which online payment provider(s) to integrate, and whether invoice / mobile wallet become checkout methods too.
- Who marks bank-transfer and pay-on-delivery orders paid, and how payments are reconciled.
- Should guests see stock status and quantities, or only an in-stock flag?
- Staff roles inside `admin` (e.g. packing staff who may only update orders)? The frontend mock uses permission
  names `orders.create`, `orders.update`, `orders.adjust`, `customers.manage`, `customers.approve`,
  `customer-groups.manage` — confirm or replace them.
- Source of a verified Bangladesh postcode dataset (and who maintains it).
- Can a customer belong to several groups? The frontend assumes one.
- Invoice/PDF generation and the required VAT invoice format.
- Cart-level rules (minimum order value, mixed-category quantity totals) are not modelled yet.
- Money precision: the frontend now supports 2-decimal amounts (paisa) end to end; confirm the backend stores them
  exactly (integer paisa or DECIMAL).
- VAT classes and real rates for the catalogue (the `standard` / `reduced` / `exempt` keys and all demo rates are placeholders).
- Migrating customers, orders and products from the current store. The ID strategy decides whether old IDs are kept.

## Company settings, media and website content

Added in the white-label and CMS batches. Company settings: `GET|PUT /api/v1/company` → `CompanySettings` (`src/lib/types/company.ts`); rules in `src/lib/validation/company.ts`; see `docs/WHITE-LABEL-ARCHITECTURE.md`. `settings.getStore()` is now a read-only view of those settings; `updateStore` was removed. Pages, posts, media, menus and homepage content: see `docs/CMS-AND-CONTENT-MANAGEMENT.md`.
