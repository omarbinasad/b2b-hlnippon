# API contracts

**Status: a contract, not an implementation.** No backend exists yet. This is what the frontend will call once one does, for Laravel or Django alike. Read [BACKEND-INTEGRATION-GUIDE.md](BACKEND-INTEGRATION-GUIDE.md) first. `openapi.yaml` holds the same endpoints in OpenAPI 3.0.

## Conventions

| | |
|---|---|
| Base path | `/api/v1`. Breaking changes get `/api/v2`. |
| Format | JSON, UTF-8. Field names in camelCase, exactly as in the types below. |
| Money | Numbers in the store's currency, rounded to its minor unit (whole yen for JPY). The backend calculates; the frontend only displays. |
| Weight | Grams in integer fields named `...Grams`, kilograms where the type says so. |
| Dates | ISO 8601 UTC for moments (`2026-01-31T04:00:00Z`), `YYYY-MM-DD` for calendar dates. Interpret calendar dates in the store's time zone from company settings. |
| Ids | Opaque strings. The frontend never parses them. |
| Caching | Anything specific to a customer: `Cache-Control: private, no-store`. Public catalog and content may be cached, and must never vary by customer price. |

### Errors

Every failure has the same shape:

```json
{ "error": { "code": "validation_failed", "message": "Check the highlighted fields.", "fields": { "email": ["This email is already registered."] } } }
```

| Status | `code` | Meaning |
|---|---|---|
| 400 | `bad_request` | Malformed request |
| 401 | `unauthenticated` | Not signed in |
| 403 | `forbidden` | Signed in, missing the capability |
| 404 | `not_found` | Missing, or belongs to another customer: never reveal which |
| 409 | `conflict` | State changed: stock gone, order already moved on, edit conflict |
| 422 | `validation_failed` | Fields invalid, or a business rule refused it. `fields` is keyed by input field. |
| 429 | `rate_limited` | With `Retry-After` |
| 500 | `server_error` | No internals in the message |

`message` and `fields` are shown to the user as written, so keep them plain. Field keys match the request's field names. For nested fields use dots: `lines.0.quantity`.

### Lists

Every list returns:

```json
{ "items": [], "page": 1, "perPage": 20, "total": 0, "totalPages": 0 }
```

`page` starts at 1. `perPage` is capped at 100 (the frontend asks for at most 100). `q` or `search` is a text search, as listed per endpoint. `sort` is a field name and `dir` is `asc` or `desc`. Unknown sort values fall back to the default. All filtering and sorting happens on the server: the frontend never receives a whole table to filter.

### Writes

Every write returns the updated record, or 204 where the endpoint says so. `PUT /x/{id}` replaces, `PATCH` changes the named fields, `POST /x` creates. Checkout and refunds must be idempotent: checkout takes an `idempotencyKey`, and the same key returns the order already placed.

The acting user always comes from the session. Requests never name the actor, and customer endpoints never take a customer id: `/customer/...` is always "the signed-in customer". The frontend's repository signatures do pass a customer or an actor, for the mock's sake; the HTTP adapter drops them.

## Sessions

The frontend doesn't commit to one approach. It runs on a server (Next.js), so these both work:

| Option | How | Notes |
|---|---|---|
| **HTTP-only session cookie (recommended)** | The backend sets `HttpOnly; Secure; SameSite=Lax`. Next.js forwards the cookie on its server-side calls, as `src/lib/data/index.ts` already does. | Tokens are out of reach of browser scripts. Needs the API on the same parent domain, or a proxy route. Use CSRF protection: with `SameSite=Lax` plus a token from `GET /auth/csrf` on writes. |
| Bearer token kept in an HTTP-only cookie by Next.js | Next.js swaps credentials for a token at sign-in, stores it in its own cookie, and sends `Authorization: Bearer`. | For an API on another domain. Change `headers` in `src/lib/data/index.ts`. Never put tokens in `localStorage`. |

Whichever is chosen: regenerate the session at sign-in, end it on the server at sign-out, expire idle sessions, lock out repeated failures, and check capabilities on every protected call. The frontend's route guards are only for display and protect nothing.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `DATA_SOURCE` | Server | `http` switches from the mock to the backend |
| `API_BASE_URL` | Server | e.g. `https://api.example.com/api/v1`. Preferred, since it never reaches the browser |
| `NEXT_PUBLIC_API_BASE_URL` | Browser and server | Only if browser code must call the API directly; a fallback for `API_BASE_URL`. Never a secret |
| `NEXT_PUBLIC_MEDIA_HOST` | Build | Host allowed for `next/image` |
| `NEXT_PUBLIC_SITE_URL` | Build and server | The public address, for the sitemap, robots and canonical links |
| `DEMO_VIEW_SWITCHER` | Server | `off` hides the demo switcher. Must be off in production |

No secret goes in a `NEXT_PUBLIC_` variable. Gateway, mail and storage credentials belong to the backend alone.

## State transitions

**Order status**, from `src/lib/orders/status.ts`:

```
received → preparing → on_the_way → delivered
    └──────────┴────────────┴──→ cancelled (reason required)
```

Delivered and cancelled are final. Items can be added, removed or replaced until delivered or cancelled. Prices and delivered weights can be corrected unless cancelled. "Open" means received, preparing or on the way, and not fully refunded.

**Payment status:** `unpaid` → `invoiced` → `paid` → `partially_refunded` → `refunded`. Choosing a method at checkout never changes it. Only recorded payments or verified gateway events do.

**Customer status:** `pending` → `approved` or `rejected`; `approved` → `suspended` → `approved`. A reason is required to reject or suspend. Only approved customers see prices or can order.

**Quotation:** `requested` → `quoted` or `declined`; `quoted` → `accepted` (creates an order at the quoted prices), `rejected` or `expired`.

**Pages and posts:** `draft` ↔ `published`, `scheduled` → live at its time, any → `trash` → restored or deleted for good. Only live content is public.

**Email log:** `queued` → `sent` or `failed`; `failed` → `queued` on retry.

**Reminder campaign:** `draft` ↔ `active`, `paused`. Sending is a scheduled job, deduplicated per customer, campaign and delivery date.

## Backend responsibilities

The frontend only displays. The backend owns all of this, and must recalculate rather than trust a value sent by the browser:

- Authentication, sessions, password storage, rate limits, and a capability check on every protected operation.
- Prices, quantity rules, coupons, shipping, tax and order totals, using the rules in the pure engines under `src/lib` (see [BUSINESS-RULES.md](BUSINESS-RULES.md)). Their tests are the reference.
- Stock: atomic reservation, no overselling, a movement record for every change.
- Checkout: re-pricing, re-validation, idempotency, immutable item snapshots.
- Orders, adjustments and delivered weight, with audit history.
- Refunds and real payment processing, webhooks, reconciliation.
- Invoices: frozen documents, sequential numbers, server-generated PDFs, private downloads.
- Email sending, queues, retries and bounce handling; the reminder scheduler.
- File storage: validation, malware scanning, private documents.
- HTML sanitizing on save (`src/lib/html/sanitize.ts` shows the allowlist). The frontend also sanitizes on display.
- Scheduled publishing, reports computed in the database, exports with audit logs.
- Backups, migrations and the data model in [DATABASE-REQUIREMENTS.md](DATABASE-REQUIREMENTS.md).

## Topics

Every topic asked for is under Endpoints below:

| Topic | Section |
|---|---|
| Authentication, sessions, PDF downloads, exports | Sign-in, sessions, documents and exports |
| Users, staff, roles, capabilities | Staff and roles ([ROLES-AND-CAPABILITIES.md](ROLES-AND-CAPABILITIES.md)) |
| Registration, approval, profiles, addresses, groups | Customers, registration, approval, addresses and groups |
| Products, categories, variations, inventory | Products and inventory; Categories; Brands, tags, attributes and classes |
| Pricing rules | Price rules; Quantity rules |
| Cart, checkout, orders, adjustments, delivered weight, refunds, invoices | Cart and quick order; Orders, checkout, adjustments, delivered weight, refunds and invoices |
| Coupons | Coupons |
| Zones, methods, conditional rules, pickup | Shipping zones, methods, rules, classes and pickup ([SHIPPING-RULES-AND-CALCULATIONS.md](SHIPPING-RULES-AND-CALCULATIONS.md)) |
| Tax, payments | Tax; Payment methods |
| Quotations, saved lists | Quotations; Saved lists |
| Schedules, reminders | Delivery schedules; Location-based reminders |
| Email templates, email logs | Email templates and logs |
| Reports | Reports and dashboard |
| Pages, posts, media, menus, homepage | Pages; Blog posts; Media; Navigation menus; Homepage content |
| Company settings, branding, feature settings | Company settings and branding (feature switches are part of `CompanySettings`) |

## Endpoints

259 endpoints. Generated from `src/lib/data/http/endpoints.ts` and the repository signatures by `npm run docs:api`: don't edit this part by hand. "Save" endpoints return the record on success and 422 with field errors otherwise. Every list takes `page`, `perPage`, `sort`, `dir` as described above.

### Sign-in, sessions, documents and exports

These aren't repository methods: the demo only imitates them.

#### `POST /auth/login`

**Permission:** public

Rate-limit and lock out repeated failures. A generic error: never say whether the email exists. Sets the session (see Sessions).

Request JSON:

```json
{
  "email": "buyer@example.com",
  "password": "string",
  "remember": false
}
```

Response 200:

```json
{
  "user": {
    "id": "string",
    "kind": "customer",
    "name": "string",
    "email": "string",
    "customerId": "string",
    "customerStatus": "approved",
    "roleId": null,
    "capabilities": []
  },
  "csrfToken": "string"
}
```

#### `POST /auth/logout`

**Permission:** signed in

Ends the session on the server. Response 204.

#### `GET /auth/me`

**Permission:** public

The signed-in user, or 401. The frontend calls it on the server on every request that depends on the viewer. Staff get their capabilities; customers get their approval status.

Response 200:

```json
{
  "user": {
    "id": "string",
    "kind": "staff",
    "name": "string",
    "email": "string",
    "customerId": null,
    "customerStatus": null,
    "roleId": "role-administrator",
    "capabilities": [
      "orders.view"
    ]
  }
}
```

#### `POST /auth/forgot-password`

**Permission:** public

Always responds 202, whether or not the email exists. Rate-limit. The link holds a single-use token that expires.

Request JSON:

```json
{
  "email": "buyer@example.com"
}
```

#### `POST /auth/reset-password`

**Permission:** public

Checks the token and the password policy; ends the user's other sessions. Response 204.

Request JSON:

```json
{
  "token": "string",
  "password": "string"
}
```

#### `POST /auth/change-password`

**Permission:** signed in

Needs the current password. Response 204.

Request JSON:

```json
{
  "currentPassword": "string",
  "password": "string"
}
```

#### `GET /auth/csrf`

**Permission:** public

Only with cookie sessions, if the backend uses a CSRF token.

Response 200:

```json
{
  "csrfToken": "string"
}
```

#### `POST /auth/staff-invitations/accept`

**Permission:** public

A staff invitation link sets the password. Single use, expires.

Request JSON:

```json
{
  "token": "string",
  "password": "string"
}
```

#### `GET /orders/{id}/invoices/{invoiceId}/pdf`

**Permission:** invoices.view, or the customer who owns the order

Server-generated PDF from the frozen invoice. application/pdf with Content-Disposition: attachment, Cache-Control: private, no-store. Another customer's invoice is 404. The demo only offers browser printing, which is not this.

#### `GET /orders/{id}/packing-slip/pdf`

**Permission:** orders.view

Server-generated PDF. No prices. Same headers as invoices.

#### `GET /quotations/{id}/pdf`

**Permission:** quotations.view, or the customer it belongs to

Server-generated PDF of a sent quote. Same headers as invoices.

#### `POST /documents/{id}/signed-url`

**Permission:** as the document

Optional, if files live on object storage: a short-lived link to a private file, checked per user. Never a permanent public URL.

Response 200:

```json
{
  "url": "string",
  "expiresAt": "2026-01-01T00:00:00Z"
}
```

#### `GET /admin/reports/export`

**Permission:** reports.export

text/csv. Query: report (sales, products, customers, coupons, inventory...), from, to. Neutralize spreadsheet formulas in cells (a leading = + - @). Log who exported what.

#### `GET /admin/orders/export`

**Permission:** orders.export

text/csv with the same filters as GET /orders. Run big exports as background jobs.

#### `GET /admin/customers/export`

**Permission:** customers.export

text/csv with the same filters as GET /admin/customers. Personal data: log every export.

#### `GET /admin/products/export`

**Permission:** products.export

text/csv with the same filters as GET /admin/products.

#### `POST /webhooks/payments/{provider}`

**Permission:** signature from the provider

Only if a gateway is added. Verify the signature, process idempotently, then mark the order paid. Choosing a payment method at checkout never marks an order paid.

### Company settings and branding

#### `GET /company`

**Permission:** public · **Frontend call:** `company.get()`

**Rule:** Public settings only: this reaches the browser, so it must never hold secrets.

**Response 200:** [CompanySettings](#companysettings)

#### `PUT /admin/company`

**Permission:** company.manage · **Frontend call:** `company.update(input: CompanySettingsInput)`

**Request JSON:** [CompanySettingsInput](#companysettingsinput)

```json
{"companyName":"string","storeName":"string","branding":{"logoMain":{"url":"string","width":0,"height":0},"logoLight":{"url":"string","width":0,"height":0},"logoDark":{"url":"string","width":0,"height":0},"logoMobile":{"url":"string","width":0,"height":0},"favicon":"string","primaryColor":"string","secondaryColor":"string","accentColor":"string","headingFont":"string","bodyFont":"string","buttonStyle":"rounded"},"contact":{"email":"string","phone":"string","address":{"addressLine1":"string","city":"string","prefecture":"string","postalCode":"string","country":"string"},"social":[{"network":"<SocialNetwork>","url":"string"}]},"documents":{},"locale":{"country":"string","currencyCode":"string","currencySymbol":"string","currencyDigits":0,"symbolPosition":"before","numberLocale":"string","dateLocale":"string","language":"string","timeZone":"string","weekStartsOn":0,"weightUnit":"kg","dimensionUnit":"cm"}}
```

**Response 200:** [CompanySettings](#companysettings)

**Errors:** 401, 403, 409, 422

#### `POST /admin/company/setup-complete`

**Permission:** company.manage · **Frontend call:** `company.completeSetup()`

Setup wizard: marks the first-time setup as finished.

**Response 200:** [CompanySettings](#companysettings)

**Errors:** 401, 403

#### `POST /demo/company/reset`

**Permission:** demo only · **Frontend call:** `company.resetDemo()`

DEMO: back to the sample company. The backend does not need this.

**Rule:** Demo only. The backend doesn't need it.

**Response 200:** [CompanySettings](#companysettings)

**Errors:** 401, 403

### Media

#### `GET /admin/media`

**Permission:** media.view · **Frontend call:** `media.list(query?: MediaListQuery \| undefined)`

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `kind` | `image` \\| `document` | no |  |
| `search` | string | no |  |
| `sort` | `date` \\| `name` \\| `size` | no |  |
| `dir` | `asc` \\| `desc` | no |  |
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403

#### `GET /admin/media/{id}`

**Permission:** media.view · **Frontend call:** `media.getById(id: string)`

**Path:** `id` (string)

**Response 200:** [MediaItem](#mediaitem) or null

**Errors:** 401, 403, 404

#### `GET /media/{id}/content`

**Permission:** public · **Frontend call:** `media.content(id: string)`

File contents and type for serving an uploaded file.

**Rule:** The file. In production, public URLs on the media host usually replace this.

**Path:** `id` (string)

**Response 200:** the file's bytes, with its Content-Type. Never publicly cached unless the file is public.

**Errors:** 404

#### `POST /admin/media`

**Permission:** media.create · **Frontend call:** `media.upload(input: MediaUpload)`

**Rule:** multipart/form-data. Check the content, scan and store safely.

**Request:** multipart/form-data, `file` plus the fields of [MediaUpload](#mediaupload)

**Response 200:** [MediaItem](#mediaitem)

**Errors:** 401, 403, 422

#### `PATCH /admin/media/{id}`

**Permission:** media.edit · **Frontend call:** `media.update(id: string, input: MediaUpdate)`

**Path:** `id` (string)

**Request JSON:** [MediaUpdate](#mediaupdate)

```json
{"title":"string","alt":"string"}
```

**Response 200:** [MediaItem](#mediaitem)

**Errors:** 401, 403, 404, 409, 422

#### `DELETE /admin/media/{id}`

**Permission:** media.delete · **Frontend call:** `media.remove(id: string)`

**Path:** `id` (string)

**Response:** 204, no body.

**Errors:** 401, 403, 404

### Staff and roles

#### `GET /admin/roles`

**Permission:** roles.view · **Frontend call:** `staff.roles()`

**Response 200:** [Role](#role)[]

**Errors:** 401, 403

#### `GET /admin/roles/{id}`

**Permission:** roles.view · **Frontend call:** `staff.role(id: string)`

**Path:** `id` (string)

**Response 200:** [Role](#role) or null

**Errors:** 401, 403, 404

#### `GET /admin/roles/staff-counts`

**Permission:** roles.view · **Frontend call:** `staff.staffCounts()`

Staff per role id.

**Rule:** Map of role id to number of staff.

**Response 200:** map of number

**Errors:** 401, 403

#### `PUT /admin/roles/{id?}`

**Permission:** roles.manage · **Frontend call:** `staff.saveRole(id: string \| null, input: RoleInput, actorCapabilities: string[])`

Creates when `id` is null. `actorCapabilities`: nobody can grant what they don't have themselves.

**Rule:** POST /admin/roles when creating. Refuse granting anything the user lacks. Administrator keeps everything and can't be renamed. Refuse removing roles.manage from the user's own role.

Without the id this is `POST /admin/roles` (create).

**Path:** `id` (string)

**Request JSON:** [RoleInput](#roleinput)

```json
{"description":"string","name":"string","capabilities":["string"]}
```

**Response 200:** [Role](#role)

**Errors:** 401, 403, 404, 409, 422

#### `POST /admin/roles/{id}/duplicate`

**Permission:** roles.manage · **Frontend call:** `staff.duplicateRole(id: string, actorCapabilities: string[])`

**Path:** `id` (string)

**Response 200:** [Role](#role)

**Errors:** 401, 403, 404, 409, 422

#### `DELETE /admin/roles/{id}`

**Permission:** roles.manage · **Frontend call:** `staff.deleteRole(id: string)`

Refused for built-in roles and roles in use. Administrator can't be renamed or lose permissions.

**Rule:** Refused for built-in roles and roles in use.

**Path:** `id` (string)

**Response 200:** { id }

**Errors:** 401, 403, 404, 409, 422

#### `GET /admin/staff`

**Permission:** staff.view · **Frontend call:** `staff.staff(query?: (PageQuery & { search?: string \| undefined; roleId?: string \| undefined; }) \| undefined)`

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |
| `search` | string | no |  |
| `roleId` | string | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403

#### `GET /admin/staff/{id}`

**Permission:** staff.view · **Frontend call:** `staff.staffMember(id: string)`

**Path:** `id` (string)

**Response 200:** [StaffMember](#staffmember) or null

**Errors:** 401, 403, 404

#### `PUT /admin/staff/{id?}`

**Permission:** staff.manage · **Frontend call:** `staff.saveStaff(id: string \| null, input: StaffInput)`

Refused if it would leave no active administrator. The action also refuses changing someone with more permissions than the actor.

**Rule:** POST /admin/staff when creating; invite: true emails an invitation. Refuse anything leaving no active administrator, assigning a role with more permissions than the user, or changing someone with more permissions than the user.

Without the id this is `POST /admin/staff` (create).

**Path:** `id` (string)

**Request JSON:** [StaffInput](#staffinput)

```json
{"name":"string","email":"string","roleId":"string","active":true}
```

**Response 200:** [StaffMember](#staffmember)

**Errors:** 401, 403, 404, 409, 422

#### `DELETE /admin/staff/{id}`

**Permission:** staff.manage · **Frontend call:** `staff.removeStaff(id: string)`

**Rule:** Refused for the last active administrator and for anyone with more permissions than the user.

**Path:** `id` (string)

**Response 200:** { id }

**Errors:** 401, 403, 404, 409, 422

### Email templates and logs

#### `GET /admin/email-templates`

**Permission:** emails.view · **Frontend call:** `emails.templates()`

**Response 200:** [EmailTemplate](#emailtemplate)[]

**Errors:** 401, 403

#### `GET /admin/email-templates/{key}`

**Permission:** emails.view · **Frontend call:** `emails.template(key: EmailTemplateKey)`

**Path:** `key` ([EmailTemplateKey](#emailtemplatekey))

**Response 200:** [EmailTemplate](#emailtemplate) or null

**Errors:** 401, 403, 404

#### `PUT /admin/email-templates/{key}`

**Permission:** emails.manage · **Frontend call:** `emails.saveTemplate(key: EmailTemplateKey, input: EmailTemplateInput)`

**Path:** `key` ([EmailTemplateKey](#emailtemplatekey))

**Request JSON:** [EmailTemplateInput](#emailtemplateinput)

```json
{"enabled":true,"subject":"string","bodyHtml":"string","attachInvoice":true}
```

**Response 200:** [EmailTemplate](#emailtemplate)

**Errors:** 401, 403, 404, 409, 422

#### `POST /admin/email-templates/{key}/reset`

**Permission:** emails.manage · **Frontend call:** `emails.resetTemplate(key: EmailTemplateKey)`

**Path:** `key` ([EmailTemplateKey](#emailtemplatekey))

**Response:** 204, no body.

**Errors:** 401, 403, 404

#### `POST /admin/email-templates/{key}/preview`

**Permission:** emails.view · **Frontend call:** `emails.preview(key: EmailTemplateKey, draft?: { subject: string; bodyHtml: string; } \| undefined)`

Renders a saved template or an unsaved draft with sample values.

**Rule:** Renders with sample values. Escape values; sanitize the HTML.

**Path:** `key` ([EmailTemplateKey](#emailtemplatekey))

**Request JSON:** { subject, bodyHtml }

```json
{"subject":"string","bodyHtml":"string"}
```

**Response 200:** { from, subject, bodyHtml, footer }

**Errors:** 401, 403, 404, 422

#### `GET /admin/email-sender`

**Permission:** emails.view · **Frontend call:** `emails.sender()`

**Response 200:** [EmailSenderSettings](#emailsendersettings)

**Errors:** 401, 403

#### `PUT /admin/email-sender`

**Permission:** emails.manage · **Frontend call:** `emails.saveSender(input: EmailSenderSettings)`

**Request JSON:** [EmailSenderSettings](#emailsendersettings)

```json
{"senderName":"string","senderEmail":"string"}
```

**Response 200:** [EmailSenderSettings](#emailsendersettings)

**Errors:** 401, 403, 409, 422

#### `GET /admin/email-logs`

**Permission:** emails.view · **Frontend call:** `emails.logs(query?: (PageQuery & { search?: string \| undefined; status?: EmailLogStatus \| undefined; templateKey?: EmailTemplateKey \| undefined; }) \| undefined)`

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |
| `search` | string | no |  |
| `status` | `simulated` \\| `failed` | no |  |
| `templateKey` | `customer_registered` \\| `customer_approved` \\| `password_reset` \\| `order_confirmation` \\| `order_processing` \\| `order_status` \\| `delivery_notification` \\| `invoice` \\| `refund` \\| `reminder_with_order` \\| `reminder_without_order` | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403

#### `POST /admin/email-logs/{id}/retry`

**Permission:** emails.manage · **Frontend call:** `emails.retry(id: string)`

**Path:** `id` (string)

**Response 200:** [EmailLog](#emaillog)

**Errors:** 401, 403, 404, 409, 422

### Location-based reminders

#### `GET /admin/reminder-campaigns`

**Permission:** reminders.view · **Frontend call:** `reminders.list(query?: (PageQuery & { search?: string \| undefined; }) \| undefined)`

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |
| `search` | string | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403

#### `GET /admin/reminder-campaigns/{id}`

**Permission:** reminders.view · **Frontend call:** `reminders.getById(id: string)`

**Path:** `id` (string)

**Response 200:** [ReminderCampaign](#remindercampaign) or null

**Errors:** 401, 403, 404

#### `PUT /admin/reminder-campaigns/{id?}`

**Permission:** reminders.manage · **Frontend call:** `reminders.save(id: string \| null, input: ReminderCampaignInput)`

**Rule:** POST when creating.

Without the id this is `POST /admin/reminder-campaigns` (create).

**Path:** `id` (string)

**Request JSON:** [ReminderCampaignInput](#remindercampaigninput)

```json
{"name":"string","enabled":true,"deliveryRouteId":"string","leadDays":0,"sendTime":"string","templateWithOrder":"customer_registered","templateWithoutOrder":"customer_registered"}
```

**Response 200:** [ReminderCampaign](#remindercampaign)

**Errors:** 401, 403, 404, 409, 422

#### `DELETE /admin/reminder-campaigns/{id}`

**Permission:** reminders.manage · **Frontend call:** `reminders.remove(id: string)`

**Path:** `id` (string)

**Response:** 204, no body.

**Errors:** 401, 403, 404

#### `GET /admin/reminder-campaigns/{id}/preview`

**Permission:** reminders.view · **Frontend call:** `reminders.preview(id: string)`

**Rule:** Next date, groups A and B, who is left out and why.

**Path:** `id` (string)

**Response 200:** [ReminderPreview](#reminderpreview) or null

**Errors:** 401, 403, 404

#### `POST /demo/reminder-campaigns/{id}/simulate`

**Permission:** demo only · **Frontend call:** `reminders.simulate(id: string)`

DEMO: writes what a run would send to the email log. Never sends. One per customer, campaign and date.

**Rule:** Demo only. The real sending is a scheduled job; it must dedupe per customer, campaign and date.

**Path:** `id` (string)

**Response 200:** { created, skipped }

**Errors:** 401, 403, 404, 409, 422

#### `GET /admin/reminder-campaigns/{id}/history`

**Permission:** reminders.view · **Frontend call:** `reminders.history(id: string, query?: PageQuery \| undefined)`

**Path:** `id` (string)

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403, 404

### Coupons

#### `GET /admin/coupons`

**Permission:** coupons.view · **Frontend call:** `coupons.list(query?: (PageQuery & { search?: string \| undefined; status?: CouponListStatus \| undefined; }) \| undefined)`

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |
| `search` | string | no |  |
| `status` | `active` \\| `disabled` \\| `expired` | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403

#### `GET /admin/coupons/{id}`

**Permission:** coupons.view · **Frontend call:** `coupons.getById(id: string)`

**Path:** `id` (string)

**Response 200:** [Coupon](#coupon) or null

**Errors:** 401, 403, 404

#### `GET /admin/coupons/{id}/usage`

**Permission:** coupons.view · **Frontend call:** `coupons.usage(id: string, query?: PageQuery \| undefined)`

**Path:** `id` (string)

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403, 404

#### `PUT /admin/coupons/{id?}`

**Permission:** coupons.edit · **Frontend call:** `coupons.save(id: string \| null, input: CouponInput)`

Creates when `id` is null. Codes are unique, compared in capitals.

**Rule:** POST when creating. Codes are unique, compared in capitals.

Without the id this is `POST /admin/coupons` (create).

**Path:** `id` (string)

**Request JSON:** [CouponInput](#couponinput)

```json
{"enabled":true,"code":"string","type":"percent","amount":0,"productIds":["string"],"categorySlugs":["string"],"excludedProductIds":["string"],"customerIds":["string"],"groupIds":["string"]}
```

**Response 200:** [Coupon](#coupon)

**Errors:** 401, 403, 404, 409, 422

#### `PATCH /admin/coupons/{id}/enabled`

**Permission:** coupons.edit · **Frontend call:** `coupons.setEnabled(id: string, enabled: boolean)`

**Path:** `id` (string)

**Request JSON:** { enabled }

```json
{"enabled":true}
```

**Response:** 204, no body.

**Errors:** 401, 403, 404, 422

#### `DELETE /admin/coupons/{id}`

**Permission:** coupons.delete · **Frontend call:** `coupons.remove(id: string)`

Past orders keep their own record of the code and amount.

**Rule:** Orders keep their own record of the code and amount.

**Path:** `id` (string)

**Response:** 204, no body.

**Errors:** 401, 403, 404

### Saved lists

#### `GET /customer/lists`

**Permission:** customer · **Frontend call:** `savedLists.list(customerId: string)`

**Rule:** The customer is always the signed-in one.

**Response 200:** [SavedList](#savedlist)[]

**Errors:** 401, 403

#### `GET /customer/lists/{id}`

**Permission:** customer · **Frontend call:** `savedLists.get(customerId: string, id: string)`

With live product details and this customer's prices.

**Path:** `id` (string)

**Response 200:** [SavedListDetail](#savedlistdetail) or null

**Errors:** 401, 403, 404

#### `POST /customer/lists`

**Permission:** customer · **Frontend call:** `savedLists.create(customerId: string, name: string, lines?: SavedListLineInput[] \| undefined)`

**Request JSON:** { name, lines }

```json
{"name":"string"}
```

**Response 200:** [SavedList](#savedlist)

**Errors:** 401, 403, 409, 422

#### `POST /customer/lists/from-order`

**Permission:** customer · **Frontend call:** `savedLists.createFromOrder(customerId: string, orderId: string, name?: string \| undefined)`

**Request JSON:** { orderId, name }

```json
{"orderId":"string"}
```

**Response 200:** [SavedList](#savedlist)

**Errors:** 401, 403, 409, 422

#### `PATCH /customer/lists/{id}`

**Permission:** customer · **Frontend call:** `savedLists.rename(customerId: string, id: string, name: string)`

**Path:** `id` (string)

**Request JSON:** { name }

```json
{"name":"string"}
```

**Response 200:** [SavedList](#savedlist)

**Errors:** 401, 403, 404, 409, 422

#### `DELETE /customer/lists/{id}`

**Permission:** customer · **Frontend call:** `savedLists.remove(customerId: string, id: string)`

**Path:** `id` (string)

**Response:** 204, no body.

**Errors:** 401, 403, 404

#### `POST /customer/lists/{id}/items`

**Permission:** customer · **Frontend call:** `savedLists.addItem(customerId: string, id: string, line: SavedListLineInput)`

The same product and option adds to the existing line.

**Path:** `id` (string)

**Request JSON:** [SavedListLineInput](#savedlistlineinput)

```json
{"productId":"string","quantity":0}
```

**Response 200:** [SavedList](#savedlist)

**Errors:** 401, 403, 404, 409, 422

#### `PATCH /customer/lists/{id}/items/{itemId}`

**Permission:** customer · **Frontend call:** `savedLists.setQuantity(customerId: string, id: string, itemId: string, quantity: number)`

**Path:** `id` (string), `itemId` (string)

**Request JSON:** { quantity }

```json
{"quantity":0}
```

**Response 200:** [SavedList](#savedlist)

**Errors:** 401, 403, 404, 409, 422

#### `DELETE /customer/lists/{id}/items/{itemId}`

**Permission:** customer · **Frontend call:** `savedLists.removeItem(customerId: string, id: string, itemId: string)`

**Path:** `id` (string), `itemId` (string)

**Response 200:** [SavedList](#savedlist)

**Errors:** 401, 403, 404, 409, 422

#### `POST /customer/lists/{id}/add-to-cart`

**Permission:** customer · **Frontend call:** `savedLists.addToCart(customerId: string, id: string)`

**Path:** `id` (string)

**Response 200:** { added, skipped }

**Errors:** 401, 403, 404, 409, 422

### Quotations

#### `GET /quotations`

**Permission:** quotations.view or customer · **Frontend call:** `quotations.list(query?: QuotationListQuery \| undefined)`

**Rule:** Customers only ever see their own.

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `customerId` | string | no | Always set on the customer portal. |
| `status` | `expired` \\| `requested` \\| `quoted` \\| `accepted` \\| `rejected` \\| `declined` | no |  |
| `search` | string | no |  |
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403

#### `GET /admin/quotations/counts`

**Permission:** quotations.view · **Frontend call:** `quotations.counts()`

**Response 200:** { requested }

**Errors:** 401, 403

#### `GET /quotations/{id}`

**Permission:** quotations.view or customer · **Frontend call:** `quotations.getById(id: string, customerId?: string \| undefined)`

Pass customerId to limit the lookup to that customer's own quotations.

**Path:** `id` (string)

**Response 200:** [Quotation](#quotation) or null

**Errors:** 401, 403, 404

#### `POST /customer/quotations`

**Permission:** customer · **Frontend call:** `quotations.request(customerId: string, input: QuotationRequestInput)`

**Request JSON:** [QuotationRequestInput](#quotationrequestinput)

```json
{"items":[{"productId":"string","quantity":0}]}
```

**Response 200:** [Quotation](#quotation)

**Errors:** 401, 403, 409, 422

#### `POST /admin/quotations/{id}/quote`

**Permission:** quotations.edit · **Frontend call:** `quotations.sendQuote(id: string, input: QuotationQuoteInput)`

Staff price every line and set a validity date.

**Path:** `id` (string)

**Request JSON:** [QuotationQuoteInput](#quotationquoteinput)

```json
{"prices":{},"validUntil":"string"}
```

**Response 200:** [Quotation](#quotation)

**Errors:** 401, 403, 404, 409, 422

#### `POST /admin/quotations/{id}/decline`

**Permission:** quotations.edit · **Frontend call:** `quotations.decline(id: string, reason: string)`

**Path:** `id` (string)

**Request JSON:** { reason }

```json
{"reason":"string"}
```

**Response 200:** [Quotation](#quotation)

**Errors:** 401, 403, 404, 409, 422

#### `POST /customer/quotations/{id}/respond`

**Permission:** customer · **Frontend call:** `quotations.respond(customerId: string, id: string, answer: "accept" \| "reject")`

Accepting creates an order at the quoted prices. An expired quote can't be accepted.

**Rule:** Accepting creates an order at the quoted prices. An expired quote is refused.

**Path:** `id` (string)

**Request JSON:** { answer }

```json
{"answer":"accept"}
```

**Response 200:** [Quotation](#quotation)

**Errors:** 401, 403, 404, 409, 422

### Admin notifications

#### `GET /admin/notifications`

**Permission:** dashboard.view · **Frontend call:** `adminNotifications.feed(query?: { limit?: number \| undefined; } \| undefined)`

New orders, registrations, stock alerts and contact messages, newest first, with the bell and sidebar counts.

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `limit` | number | no |  |

**Response 200:** [AdminNotificationFeed](#adminnotificationfeed)

**Errors:** 401, 403

#### `POST /admin/notifications/{id}/read`

**Permission:** dashboard.view · **Frontend call:** `adminNotifications.markRead(id: string)`

**Path:** `id` (string)

**Response:** 204, no body.

**Errors:** 401, 403, 404

#### `POST /admin/notifications/read-all`

**Permission:** dashboard.view · **Frontend call:** `adminNotifications.markAllRead()`

**Response:** 204, no body.

**Errors:** 401, 403

### Contact form

#### `POST /contact`

**Permission:** public · **Frontend call:** `contact.submit(input: ContactMessageInput)`

Validates and stores a message. The backend also rate-limits it and emails the team; the demo sends nothing.

**Rule:** Rate-limit it.

**Request JSON:** [ContactMessageInput](#contactmessageinput)

```json
{"name":"string","email":"string","topic":"general","message":"string"}
```

**Response 200:** [ContactMessage](#contactmessage)

**Errors:** 409, 422

### Blog posts

#### `GET /posts`

**Permission:** public · **Frontend call:** `posts.list(query?: { excludeSlug?: string \| undefined; limit?: number \| undefined; } \| undefined)`

Live posts, newest first.

**Rule:** Live posts only.

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `excludeSlug` | string | no |  |
| `limit` | number | no |  |

**Response 200:** [BlogPostSummary](#blogpostsummary)[]

#### `GET /posts/{slug}`

**Permission:** public · **Frontend call:** `posts.getBySlug(slug: string)`

**Path:** `slug` (string)

**Response 200:** [BlogPost](#blogpost) or null

**Errors:** 404

#### `GET /posts/archive`

**Permission:** public · **Frontend call:** `posts.archive(query: { search?: string \| undefined; category?: string \| undefined; categories?: string[] \| undefined; page?: number \| undefined; perPage?: number \| undefined; })`

`categories` matches a post in any of them. `category` is the older single form, still accepted.

**Rule:** categories: comma-separated names; a post matches if it's in any of them. Names can't contain commas.

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `search` | string | no |  |
| `category` | string | no |  |
| `categories` | string[] | no |  |
| `page` | number | no |  |
| `perPage` | number | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

#### `GET /posts/categories`

**Permission:** public · **Frontend call:** `posts.categories()`

**Response 200:** string[]

#### `GET /admin/post-terms/{kind}`

**Permission:** posts.view · **Frontend call:** `posts.terms(kind: TermKind)`

**Path:** `kind` ([TermKind](#termkind))

**Response 200:** [TermUsage](#termusage)[]

**Errors:** 401, 403, 404

#### `PUT /admin/post-terms/{kind}`

**Permission:** posts.edit · **Frontend call:** `posts.saveTerm(kind: TermKind, from: string \| null, name: string)`

Adds a term when `from` is null; otherwise renames it on every post.

**Rule:** from null adds; otherwise renames on every post.

**Path:** `kind` ([TermKind](#termkind))

**Request JSON:** { from, name }

```json
{"from":"string","name":"string"}
```

**Response 200:** { name }

**Errors:** 401, 403, 404, 409, 422

#### `DELETE /admin/post-terms/{kind}/{name}`

**Permission:** posts.delete · **Frontend call:** `posts.deleteTerm(kind: TermKind, name: string)`

Removes it from every post. Refused if a published post would be left without a category.

**Rule:** Refused if a published post would be left without a category.

**Path:** `kind` ([TermKind](#termkind)), `name` (string)

**Response 200:** { name }

**Errors:** 401, 403, 404, 409, 422

#### `GET /admin/posts`

**Permission:** posts.view · **Frontend call:** `posts.adminList(query?: (ContentListQuery & { category?: string \| undefined; }) \| undefined)`

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `status` | `draft` \\| `published` \\| `scheduled` \\| `trash` | no | Without a status, everything except the trash. |
| `search` | string | no |  |
| `sort` | `title` \\| `published` \\| `updated` | no |  |
| `dir` | `asc` \\| `desc` | no |  |
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |
| `category` | string | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403

#### `GET /admin/posts/status-counts`

**Permission:** posts.view · **Frontend call:** `posts.statusCounts()`

**Response 200:** { draft, published, scheduled, trash }

**Errors:** 401, 403

#### `GET /admin/posts/{id}`

**Permission:** posts.view · **Frontend call:** `posts.getById(id: string)`

**Path:** `id` (string)

**Response 200:** [BlogPost](#blogpost) or null

**Errors:** 401, 403, 404

#### `PUT /admin/posts/{id?}`

**Permission:** posts.edit · **Frontend call:** `posts.save(id: string \| null, input: BlogPostInput)`

Creates when `id` is null.

**Rule:** POST when creating. Sanitize the HTML on save.

Without the id this is `POST /admin/posts` (create).

**Path:** `id` (string)

**Request JSON:** [BlogPostInput](#blogpostinput)

```json
{"title":"string","bodyHtml":"string","slug":"string","excerpt":"string","status":"draft","seo":{},"categories":["string"],"tags":["string"]}
```

**Response 200:** [BlogPost](#blogpost)

**Errors:** 401, 403, 404, 409, 422

#### `POST /admin/posts/{id}/trash`

**Permission:** posts.delete · **Frontend call:** `posts.trash(id: string)`

**Path:** `id` (string)

**Response:** 204, no body.

**Errors:** 401, 403, 404

#### `POST /admin/posts/{id}/restore`

**Permission:** posts.edit · **Frontend call:** `posts.restore(id: string)`

**Path:** `id` (string)

**Response:** 204, no body.

**Errors:** 401, 403, 404

#### `DELETE /admin/posts/{id}`

**Permission:** posts.delete · **Frontend call:** `posts.deleteForever(id: string)`

Only from the trash.

**Rule:** Only from the trash.

**Path:** `id` (string)

**Response:** 204, no body.

**Errors:** 401, 403, 404

### Pages

#### `GET /pages/{slug}`

**Permission:** public · **Frontend call:** `pages.getLiveBySlug(slug: string)`

**Rule:** A customers-only page must return 404 to anyone else.

**Path:** `slug` (string)

**Response 200:** [ContentPage](#contentpage) or null

**Errors:** 404

#### `GET /pages`

**Permission:** public · **Frontend call:** `pages.listLive()`

**Response 200:** [ContentPage](#contentpage)[]

#### `GET /admin/pages`

**Permission:** pages.view · **Frontend call:** `pages.adminList(query?: ContentListQuery \| undefined)`

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `status` | `draft` \\| `published` \\| `scheduled` \\| `trash` | no | Without a status, everything except the trash. |
| `search` | string | no |  |
| `sort` | `title` \\| `published` \\| `updated` | no |  |
| `dir` | `asc` \\| `desc` | no |  |
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403

#### `GET /admin/pages/status-counts`

**Permission:** pages.view · **Frontend call:** `pages.statusCounts()`

**Response 200:** { draft, published, scheduled, trash }

**Errors:** 401, 403

#### `GET /admin/pages/{id}`

**Permission:** pages.view · **Frontend call:** `pages.getById(id: string)`

**Path:** `id` (string)

**Response 200:** [ContentPage](#contentpage) or null

**Errors:** 401, 403, 404

#### `PUT /admin/pages/{id?}`

**Permission:** pages.edit · **Frontend call:** `pages.save(id: string \| null, input: ContentPageInput)`

Creates when `id` is null.

**Rule:** POST when creating. Sanitize the HTML on save; refuse reserved addresses.

Without the id this is `POST /admin/pages` (create).

**Path:** `id` (string)

**Request JSON:** [ContentPageInput](#contentpageinput)

```json
{"title":"string","bodyHtml":"string","slug":"string","excerpt":"string","status":"draft","seo":{},"visibility":"public"}
```

**Response 200:** [ContentPage](#contentpage)

**Errors:** 401, 403, 404, 409, 422

#### `POST /admin/pages/{id}/trash`

**Permission:** pages.delete · **Frontend call:** `pages.trash(id: string)`

**Path:** `id` (string)

**Response:** 204, no body.

**Errors:** 401, 403, 404

#### `POST /admin/pages/{id}/restore`

**Permission:** pages.edit · **Frontend call:** `pages.restore(id: string)`

**Path:** `id` (string)

**Response:** 204, no body.

**Errors:** 401, 403, 404

#### `DELETE /admin/pages/{id}`

**Permission:** pages.delete · **Frontend call:** `pages.deleteForever(id: string)`

Only from the trash.

**Rule:** Only from the trash.

**Path:** `id` (string)

**Response:** 204, no body.

**Errors:** 401, 403, 404

### Navigation menus

#### `GET /admin/menus`

**Permission:** menus.view · **Frontend call:** `navigation.list()`

**Response 200:** [NavigationMenu](#navigationmenu)[]

**Errors:** 401, 403

#### `GET /admin/menus/{id}`

**Permission:** menus.view · **Frontend call:** `navigation.getById(id: string)`

**Path:** `id` (string)

**Response 200:** [NavigationMenu](#navigationmenu) or null

**Errors:** 401, 403, 404

#### `GET /navigation/{location}`

**Permission:** public · **Frontend call:** `navigation.resolved(location: "header" \| "footer")`

The menu at a location, ready to render. Links to pages that are not live are left out.

**Rule:** Real URLs; links to pages that aren't live are left out.

**Path:** `location` (`header` \| `footer`)

**Response 200:** [ResolvedMenuItem](#resolvedmenuitem)[]

**Errors:** 404

#### `PUT /admin/menus/{id?}`

**Permission:** menus.edit · **Frontend call:** `navigation.save(id: string \| null, input: NavigationMenuInput)`

Creates when `id` is null. A location holds one menu, so taking one moves any other menu off it.

**Rule:** POST when creating. One menu per location.

Without the id this is `POST /admin/menus` (create).

**Path:** `id` (string)

**Request JSON:** [NavigationMenuInput](#navigationmenuinput)

```json
{"name":"string","items":[{"id":"string","label":"string","kind":"category","children":["<MenuItem>"]}],"location":"header"}
```

**Response 200:** [NavigationMenu](#navigationmenu)

**Errors:** 401, 403, 404, 409, 422

#### `DELETE /admin/menus/{id}`

**Permission:** menus.edit · **Frontend call:** `navigation.remove(id: string)`

**Path:** `id` (string)

**Response:** 204, no body.

**Errors:** 401, 403, 404

### Homepage content

#### `GET /site-content`

**Permission:** public · **Frontend call:** `siteContent.get()`

Homepage sections and About page content.

**Response 200:** [SiteContent](#sitecontent)

#### `PUT /admin/site-content`

**Permission:** homepage.edit · **Frontend call:** `siteContent.update(input: SiteContentInput)`

**Request JSON:** [SiteContentInput](#sitecontentinput)

```json
{"topBar":"string","sections":[{"id":"string","enabled":true,"type":"hero","slides":["<HeroSlide>"],"highlights":[{"icon":"string","label":"string"}]}],"about":{"eyebrow":"string","title":"string","text":"string","image":{"src":"string","alt":"string","width":0,"height":0},"pillars":[{"icon":"string","title":"string","text":"string"}],"valuesEyebrow":"string","valuesTitle":"string","values":[{"icon":"string","title":"string","text":"string"}],"serveEyebrow":"string","serveTitle":"string","serveText":"string","serve":[{"icon":"string","title":"string"}],"ctaTitle":"string","ctaText":"string"}}
```

**Response 200:** [SiteContent](#sitecontent)

**Errors:** 401, 403, 409, 422

### Products and inventory

#### `GET /products`

**Permission:** public · **Frontend call:** `products.list(query?: ProductListQuery \| undefined)`

Public catalog: published + visible products only, never prices. Sortable by name or updated.

**Rule:** Never includes customer prices.

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `categorySlug` | string | no | Includes products in subcategories. |
| `categorySlugs` | string[] | no | Limit to products in ANY of these categories (subcategories included); combined with `categorySlug` (AND). |
| `brandSlugs` | string[] | no | Products carrying ANY of these brands. |
| `productIds` | string[] | no | Restrict to these product ids (e.g. the result of a customer price-range lookup). |
| `stockStatus` | `low_stock` \\| `in_stock` \\| `out_of_stock` \\| `backorder` | no |  |
| `featured` | boolean | no | Only products flagged as featured. |
| `search` | string | no |  |
| `sort` | `name` \\| `updated` \\| `sku` \\| `stock` \\| `price` | no |  |
| `dir` | `asc` \\| `desc` | no |  |
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

#### `GET /products/{slug}`

**Permission:** public · **Frontend call:** `products.getBySlug(slug: string)`

**Path:** `slug` (string)

**Response 200:** [Product](#product) or null

**Errors:** 404

#### `GET /categories`

**Permission:** public · **Frontend call:** `products.listCategories()`

Public (active) categories.

**Response 200:** [Category](#category)[]

#### `GET /brands`

**Permission:** public · **Frontend call:** `products.listBrands()`

Brands used by publicly listed products, with counts (shop filter).

**Response 200:** [BrandFacet](#brandfacet)[]

#### `GET /brands/featured`

**Permission:** public · **Frontend call:** `products.featuredBrands(max: number)`

Brands chosen for the homepage, in display order. productCount says whether a link to the shop would find anything.

**Rule:** Brands marked for the homepage, lowest displayOrder first.

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `max` | number | yes |  |

**Response 200:** [BrandFacet](#brandfacet)[]

#### `GET /admin/products`

**Permission:** products.view · **Frontend call:** `products.adminList(query?: AdminProductListQuery \| undefined)`

Admin catalog rows, any status, with prices.

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `status` | `draft` \\| `published` \\| `archived` | no | Omitted = published and draft (archived only when asked for). |
| `type` | `simple` \\| `variable` | no |  |
| `pricing` | `missing` \\| `set` | no | "missing": not purchasable for lack of a store-currency price (simple product without a price, or an enabled variation without one) — e.g. imported products whose source price is in another currency. "set": fully priced. |
| `categorySlug` | string | no | Includes products in subcategories. |
| `categorySlugs` | string[] | no | Limit to products in ANY of these categories (subcategories included); combined with `categorySlug` (AND). |
| `brandSlugs` | string[] | no | Products carrying ANY of these brands. |
| `productIds` | string[] | no | Restrict to these product ids (e.g. the result of a customer price-range lookup). |
| `stockStatus` | `low_stock` \\| `in_stock` \\| `out_of_stock` \\| `backorder` | no |  |
| `featured` | boolean | no | Only products flagged as featured. |
| `search` | string | no |  |
| `sort` | `name` \\| `updated` \\| `sku` \\| `stock` \\| `price` | no |  |
| `dir` | `asc` \\| `desc` | no |  |
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403

#### `GET /admin/products/{id}`

**Permission:** products.view · **Frontend call:** `products.getById(id: string)`

Admin: full product including drafts/archived and prices.

**Path:** `id` (string)

**Response 200:** [Product](#product) or null

**Errors:** 401, 403, 404

#### `POST /admin/products`

**Permission:** products.create · **Frontend call:** `products.create(input: ProductInput)`

**Request JSON:** [ProductInput](#productinput)

```json
{"type":"simple","name":"string","slug":"string","sku":"string","shortDescription":"string","description":"string","status":"draft","visibility":"visible","featured":true,"categoryIds":["string"],"tags":["string"],"brandIds":["string"],"images":[{"src":"string","alt":"string","width":0,"height":0}],"unitLabel":"string","taxStatus":"none","taxClass":"standard","manageStock":true,"stockStatus":"low_stock","backorders":"no","soldIndividually":true,"weight":{"value":0,"unit":"kg"},"isVariableWeight":true,"attributes":[{"name":"string","values":["string"],"visible":true,"variation":true}],"defaultAttributes":{},"variations":[{"sku":"string","attributes":{},"status":"active","gallery":["<ProductImage>"],"stockMode":"status","stockStatus":"low_stock"}],"upsellIds":["string"],"crossSellIds":["string"],"menuOrder":0,"reviewsEnabled":true}
```

**Response 200:** [Product](#product)

**Errors:** 401, 403, 409, 422

#### `PUT /admin/products/{id}`

**Permission:** products.edit · **Frontend call:** `products.update(id: string, input: ProductInput, byName?: string \| undefined)`

Stock changes made by the edit are recorded in the stock movement history under `byName`.

**Path:** `id` (string)

**Request JSON:** [ProductInput](#productinput)

```json
{"type":"simple","name":"string","slug":"string","sku":"string","shortDescription":"string","description":"string","status":"draft","visibility":"visible","featured":true,"categoryIds":["string"],"tags":["string"],"brandIds":["string"],"images":[{"src":"string","alt":"string","width":0,"height":0}],"unitLabel":"string","taxStatus":"none","taxClass":"standard","manageStock":true,"stockStatus":"low_stock","backorders":"no","soldIndividually":true,"weight":{"value":0,"unit":"kg"},"isVariableWeight":true,"attributes":[{"name":"string","values":["string"],"visible":true,"variation":true}],"defaultAttributes":{},"variations":[{"sku":"string","attributes":{},"status":"active","gallery":["<ProductImage>"],"stockMode":"status","stockStatus":"low_stock"}],"upsellIds":["string"],"crossSellIds":["string"],"menuOrder":0,"reviewsEnabled":true}
```

**Response 200:** [Product](#product)

**Errors:** 401, 403, 404, 409, 422

#### `POST /admin/products/{id}/duplicate`

**Permission:** products.create · **Frontend call:** `products.duplicate(id: string)`

Copies a product as a new draft with unique slug/SKUs.

**Path:** `id` (string)

**Response 200:** [Product](#product)

**Errors:** 401, 403, 404, 409, 422

#### `PATCH /admin/products/{id}/status`

**Permission:** products.edit · **Frontend call:** `products.setStatus(id: string, status: ProductStatus)`

Archive (hide from the store, keep history) or restore.

**Path:** `id` (string)

**Request JSON:** { status }

```json
{"status":"draft"}
```

**Response 200:** [Product](#product)

**Errors:** 401, 403, 404, 409, 422

#### `PATCH /admin/products/{id}/stock`

**Permission:** inventory.edit · **Frontend call:** `products.setStock(id: string, variationId: string \| undefined, change: StockChange, context: StockChangeContext)`

Global stock change for a product or one variation (e.g. from an order page): a status for status-managed stock, a count for counted stock. Options sharing the product's stock change together. Never changes existing orders. Recorded in the stock movement history.

**Rule:** Never changes existing orders. Record a stock movement; protect against concurrent changes.

**Path:** `id` (string)

**Request JSON:** { variationId, change, context }

```json
{"variationId":"string","change":{"status":"in_stock"},"context":{"source":"product_edit","byName":"string"}}
```

**Response 200:** [Product](#product)

**Errors:** 401, 403, 404, 409, 422

#### `GET /admin/inventory`

**Permission:** inventory.view · **Frontend call:** `products.inventory(query?: InventoryQuery \| undefined)`

Every stockable line (simple products and options), excluding archived products.

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `search` | string | no |  |
| `stockStatus` | `low_stock` \\| `in_stock` \\| `out_of_stock` \\| `backorder` | no |  |
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403

#### `GET /admin/inventory/counts`

**Permission:** inventory.view · **Frontend call:** `products.inventoryCounts()`

**Response 200:** { total, low, out }

**Errors:** 401, 403

#### `GET /admin/inventory/movements`

**Permission:** inventory.view · **Frontend call:** `products.allStockMovements(query?: (ListQuery<never> & DateBounds) \| undefined)`

Stock changes across all products, newest first.

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `search` | string | no |  |
| `sort` | any | no |  |
| `dir` | `asc` \\| `desc` | no |  |
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |
| `from` | string | no |  |
| `to` | string | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403

#### `GET /admin/products/{id}/stock-movements`

**Permission:** inventory.view · **Frontend call:** `products.stockMovements(id: string, query?: PageQuery \| undefined)`

Stock change history of a product (all its options), newest first.

**Path:** `id` (string)

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403, 404

#### `GET /admin/products/search`

**Permission:** products.view · **Frontend call:** `products.search(term: string, options?: { excludeIds?: string[] \| undefined; limit?: number \| undefined; } \| undefined)`

Small server-side search for pickers (never the full catalog). Excludes archived products.

**Rule:** Picker search, at most 20 results.

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `q` | string | yes |  |
| `excludeIds` | string[] | no |  |
| `limit` | number | no |  |

**Response 200:** [ProductPick](#productpick)[]

**Errors:** 401, 403

#### `GET /admin/products/picks`

**Permission:** products.view · **Frontend call:** `products.getPicks(ids: string[])`

Picks for known IDs, in the given order (e.g. selected upsells).

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `ids` | string[] | yes |  |

**Response 200:** [ProductPick](#productpick)[]

**Errors:** 401, 403

### Categories

#### `GET /admin/categories/all`

**Permission:** products.view · **Frontend call:** `categories.all()`

Every category including hidden ones (for pickers).

**Response 200:** [Category](#category)[]

**Errors:** 401, 403

#### `GET /admin/categories`

**Permission:** products.view · **Frontend call:** `categories.list(query?: CategoryListQuery \| undefined)`

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `status` | `active` \\| `hidden` | no |  |
| `search` | string | no |  |
| `sort` | `name` \\| `products` \\| `path` | no |  |
| `dir` | `asc` \\| `desc` | no |  |
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403

#### `GET /admin/categories/{id}`

**Permission:** products.view · **Frontend call:** `categories.getById(id: string)`

**Path:** `id` (string)

**Response 200:** [Category](#category) or null

**Errors:** 401, 403, 404

#### `POST /admin/categories`

**Permission:** products.create · **Frontend call:** `categories.create(input: CategoryInput)`

**Request JSON:** [CategoryInput](#categoryinput)

```json
{"name":"string","slug":"string","status":"active"}
```

**Response 200:** [Category](#category)

**Errors:** 401, 403, 409, 422

#### `PUT /admin/categories/{id}`

**Permission:** products.edit · **Frontend call:** `categories.update(id: string, input: CategoryInput)`

**Path:** `id` (string)

**Request JSON:** [CategoryInput](#categoryinput)

```json
{"name":"string","slug":"string","status":"active"}
```

**Response 200:** [Category](#category)

**Errors:** 401, 403, 404, 409, 422

#### `GET /admin/categories/{id}/products`

**Permission:** products.view · **Frontend call:** `categories.listProducts(id: string, query?: PageQuery \| undefined)`

Products directly in this category (not subcategories), paginated.

**Path:** `id` (string)

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403, 404

#### `POST /admin/categories/{id}/products`

**Permission:** products.edit · **Frontend call:** `categories.assignProducts(id: string, change: { add?: string[] \| undefined; remove?: string[] \| undefined; })`

Adds/removes the category on products. Returns the number of products changed.

**Path:** `id` (string)

**Request JSON:** { add, remove }

```json
{}
```

**Response 200:** number

**Errors:** 401, 403, 404, 409, 422

### Brands, tags, attributes and classes

#### `GET /admin/brands`

**Permission:** products.view · **Frontend call:** `catalogSettings.brands()`

**Response 200:** [Brand](#brand)[]

**Errors:** 401, 403

#### `GET /admin/product-tags`

**Permission:** products.view · **Frontend call:** `catalogSettings.tags()`

Most used first (for "most used tags" suggestions).

**Response 200:** [Tag](#tag)[]

**Errors:** 401, 403

#### `GET /admin/catalog-defaults`

**Permission:** products.view · **Frontend call:** `catalogSettings.storeDefaults()`

Store-wide defaults shown as placeholders in the product form.

**Response 200:** { lowStockThreshold }

**Errors:** 401, 403

#### `POST /admin/brands`

**Permission:** products.edit · **Frontend call:** `catalogSettings.createBrand(name: string)`

**Request JSON:** { name }

```json
{"name":"string"}
```

**Response 200:** [Brand](#brand)

**Errors:** 401, 403, 409, 422

#### `GET /admin/brands/list`

**Permission:** products.view · **Frontend call:** `catalogSettings.adminBrands(query?: BrandListQuery \| undefined)`

Admin brand list, with logos and product counts.

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `showOnHome` | boolean | no |  |
| `search` | string | no |  |
| `sort` | `name` \\| `order` \\| `products` | no |  |
| `dir` | `asc` \\| `desc` | no |  |
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403

#### `PUT /admin/brand-records/{id?}`

**Permission:** products.edit · **Frontend call:** `catalogSettings.saveBrand(id: string \| null, input: BrandInput)`

Creates when id is null.

**Rule:** POST when creating. The logo comes from the media library.

Without the id this is `POST /admin/brand-records` (create).

**Path:** `id` (string)

**Request JSON:** [BrandInput](#brandinput)

```json
{"name":"string","logo":{"src":"string","alt":"string","width":0,"height":0},"showOnHome":true,"displayOrder":0}
```

**Response 200:** [Brand](#brand)

**Errors:** 401, 403, 404, 409, 422

#### `GET /admin/brands/usage`

**Permission:** products.view · **Frontend call:** `catalogSettings.brandUsage()`

Brands with the number of products carrying each.

**Response 200:** [TermUsage](#termusage)[]

**Errors:** 401, 403

#### `PATCH /admin/brands/{name}`

**Permission:** products.edit · **Frontend call:** `catalogSettings.renameBrand(from: string, name: string)`

**Path:** `name` (string)

**Request JSON:** { name }

```json
{"name":"string"}
```

**Response 200:** [Brand](#brand)

**Errors:** 401, 403, 404, 409, 422

#### `DELETE /admin/brands/{name}`

**Permission:** products.delete · **Frontend call:** `catalogSettings.deleteBrand(name: string)`

Removes it from the products that carry it.

**Path:** `name` (string)

**Response 200:** { name }

**Errors:** 401, 403, 404, 409, 422

#### `POST /admin/attributes/{id}/values`

**Permission:** products.edit · **Frontend call:** `catalogSettings.createAttributeValue(attributeId: string, name: string)`

Adds a reusable value to a store-wide attribute.

**Path:** `id` (string)

**Request JSON:** { name }

```json
{"name":"string"}
```

**Response 200:** [AttributeValue](#attributevalue)

**Errors:** 401, 403, 404, 409, 422

#### `GET /admin/attributes`

**Permission:** products.view · **Frontend call:** `catalogSettings.attributes()`

Store-wide reusable attributes with their values.

**Response 200:** [Attribute](#attribute)[]

**Errors:** 401, 403

#### `GET /admin/shipping/class-options`

**Permission:** products.view · **Frontend call:** `catalogSettings.shippingClasses()`

Classes referenced by the future shipping-rate settings.

**Response 200:** [ShippingClass](#shippingclass)[]

**Errors:** 401, 403

#### `GET /admin/tax/class-options`

**Permission:** products.view · **Frontend call:** `catalogSettings.taxClasses()`

Classes referenced by the future tax-rate settings.

**Response 200:** [TaxClassOption](#taxclassoption)[]

**Errors:** 401, 403

### Price rules

#### `POST /customer/prices`

**Permission:** customer or products.view · **Frontend call:** `pricing.getCustomerPrices(customerId: string, productIds: string[])`

Prices for a single customer at quantity 1. Never cache publicly.

**Rule:** Never cache publicly. A staff session gets the standard wholesale price: rules for all approved customers and sale prices, no group or customer rules.

**Request JSON:** { productIds }

```json
{"productIds":["string"]}
```

**Response 200:** [ResolvedPrice](#resolvedprice)[]

**Errors:** 401, 403, 422

#### `GET /customer/products-in-price-range`

**Permission:** customer or products.view · **Frontend call:** `pricing.productIdsInPriceRange(customerId: string, range: { min?: number \| undefined; max?: number \| undefined; })`

Ids of products this (approved) customer can buy within the price range at quantity 1 — own price incl. rules; for variable products, any active variation. Unpriced products never match. Customer-scoped (shop price filter); never exposed to guests.

**Rule:** A staff session uses the standard wholesale price.

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `min` | number | no |  |
| `max` | number | no |  |

**Response 200:** string[]

**Errors:** 401, 403

#### `GET /customer/price-bounds`

**Permission:** customer or products.view · **Frontend call:** `pricing.priceBounds(customerId: string)`

Lowest and highest price this (approved) customer can buy at, at quantity 1, for the shop's price slider; null if none.

**Rule:** A staff session uses the standard wholesale price.

**Response 200:** { min, max } or null

**Errors:** 401, 403, 404

#### `GET /admin/price-rules`

**Permission:** pricing.view · **Frontend call:** `pricing.listRules(query?: PriceRuleListQuery \| undefined)`

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `audienceType` | `customer` \\| `all` \\| `group` | no |  |
| `targetType` | `products` \\| `categories` \\| `all` \\| `variations` | no |  |
| `status` | `active` \\| `disabled` | no |  |
| `withConflicts` | boolean | no | true = only rules that overlap or conflict with another active rule. |
| `search` | string | no |  |
| `sort` | `name` \\| `updated` \\| `audience` \\| `target` \\| `priority` | no |  |
| `dir` | `asc` \\| `desc` | no |  |
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403

#### `GET /admin/price-rules/{id}`

**Permission:** pricing.view · **Frontend call:** `pricing.getRule(id: string)`

**Path:** `id` (string)

**Response 200:** [PriceRuleListItem](#pricerulelistitem) or null

**Errors:** 401, 403, 404

#### `POST /admin/price-rules`

**Permission:** pricing.create · **Frontend call:** `pricing.createRule(input: PriceRuleInput)`

**Request JSON:** [PriceRuleInput](#priceruleinput)

```json
{"name":"string","status":"active","audience":{"type":"all"},"target":{"type":"all"},"priority":0,"tiers":[{"minQuantity":0,"adjustment":{"type":"fixed_price","amount":0}}]}
```

**Response 200:** [PriceRule](#pricerule)

**Errors:** 401, 403, 409, 422

#### `PUT /admin/price-rules/{id}`

**Permission:** pricing.edit · **Frontend call:** `pricing.updateRule(id: string, input: PriceRuleInput)`

**Path:** `id` (string)

**Request JSON:** [PriceRuleInput](#priceruleinput)

```json
{"name":"string","status":"active","audience":{"type":"all"},"target":{"type":"all"},"priority":0,"tiers":[{"minQuantity":0,"adjustment":{"type":"fixed_price","amount":0}}]}
```

**Response 200:** [PriceRule](#pricerule)

**Errors:** 401, 403, 404, 409, 422

#### `PATCH /admin/price-rules/{id}/status`

**Permission:** pricing.edit · **Frontend call:** `pricing.setRuleStatus(id: string, status: RuleStatus)`

**Path:** `id` (string)

**Request JSON:** { status }

```json
{"status":"active"}
```

**Response 200:** [PriceRule](#pricerule)

**Errors:** 401, 403, 404, 409, 422

#### `GET /admin/price-rules/product-options/{id}`

**Permission:** pricing.view · **Frontend call:** `pricing.productOption(productId: string)`

Product with its variations and base prices, for rule targets and the test panel.

**Path:** `id` (string)

**Response 200:** [RuleProductOption](#ruleproductoption) or null

**Errors:** 401, 403, 404

#### `POST /admin/price-rules/test`

**Permission:** pricing.view · **Frontend call:** `pricing.testRules(query: RuleTestQuery)`

Price + quantity limits for a customer, product option and quantity, with explanations.

**Request JSON:** [RuleTestQuery](#ruletestquery)

```json
{"productId":"string","quantity":0}
```

**Response 200:** [RuleTestResult](#ruletestresult) or null

**Errors:** 401, 403, 404, 422

### Quantity rules

#### `GET /admin/quantity-rules`

**Permission:** pricing.view · **Frontend call:** `quantityRules.list(query?: QuantityRuleListQuery \| undefined)`

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `targetType` | `products` \\| `categories` \\| `all` \\| `variations` | no |  |
| `status` | `active` \\| `disabled` | no |  |
| `search` | string | no |  |
| `sort` | `name` \\| `updated` \\| `target` \\| `priority` | no |  |
| `dir` | `asc` \\| `desc` | no |  |
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403

#### `GET /admin/quantity-rules/{id}`

**Permission:** pricing.view · **Frontend call:** `quantityRules.get(id: string)`

**Path:** `id` (string)

**Response 200:** [QuantityRuleListItem](#quantityrulelistitem) or null

**Errors:** 401, 403, 404

#### `POST /admin/quantity-rules`

**Permission:** pricing.create · **Frontend call:** `quantityRules.create(input: QuantityLimitRuleInput)`

**Request JSON:** [QuantityLimitRuleInput](#quantitylimitruleinput)

```json
{"name":"string","status":"active","target":{"type":"all"},"priority":0}
```

**Response 200:** [QuantityLimitRule](#quantitylimitrule)

**Errors:** 401, 403, 409, 422

#### `PUT /admin/quantity-rules/{id}`

**Permission:** pricing.edit · **Frontend call:** `quantityRules.update(id: string, input: QuantityLimitRuleInput)`

**Path:** `id` (string)

**Request JSON:** [QuantityLimitRuleInput](#quantitylimitruleinput)

```json
{"name":"string","status":"active","target":{"type":"all"},"priority":0}
```

**Response 200:** [QuantityLimitRule](#quantitylimitrule)

**Errors:** 401, 403, 404, 409, 422

#### `PATCH /admin/quantity-rules/{id}/status`

**Permission:** pricing.edit · **Frontend call:** `quantityRules.setStatus(id: string, status: RuleStatus)`

**Path:** `id` (string)

**Request JSON:** { status }

```json
{"status":"active"}
```

**Response 200:** [QuantityLimitRule](#quantitylimitrule)

**Errors:** 401, 403, 404, 409, 422

#### `GET /quantity-limits`

**Permission:** public · **Frontend call:** `quantityRules.effectiveFor(productId: string, variationId?: string \| undefined)`

Effective per-line limits for a product option (most specific rule wins).

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `productId` | string | yes |  |
| `variationId` | string | no |  |

**Response 200:** [QuantityLimits](#quantitylimits) or null

**Errors:** 404

### Customers, registration, approval, addresses and groups

#### `DELETE /admin/customers/{id}`

**Permission:** customers.delete · **Frontend call:** `customers.remove(id: string)`

Refused once the customer has an order: suspend them instead.

**Rule:** Refused once the customer has an order: suspend them instead. Personal data: log it.

**Path:** `id` (string)

**Response 200:** { id }

**Errors:** 401, 403, 404, 409, 422

#### `GET /admin/customers`

**Permission:** customers.view · **Frontend call:** `customers.list(query?: CustomerListQuery \| undefined)`

Rows include group name and order aggregates (count, spend, last order).

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `status` | `rejected` \\| `pending` \\| `approved` \\| `suspended` | no |  |
| `groupId` | string | no |  |
| `prefecture` | string | no |  |
| `hasOrders` | boolean | no | true = has at least one non-cancelled order; false = none. |
| `pendingFirst` | boolean | no | Pending customers come first, each part in the requested sort order. |
| `search` | string | no |  |
| `sort` | `orders` \\| `status` \\| `group` \\| `company` \\| `registered` \\| `spend` | no |  |
| `dir` | `asc` \\| `desc` | no |  |
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |
| `from` | string | no |  |
| `to` | string | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403

#### `GET /customers/{id}`

**Permission:** customers.view or customer · **Frontend call:** `customers.getById(id: string)`

**Rule:** Customers only ever get themselves.

**Path:** `id` (string)

**Response 200:** [Customer](#customer) or null

**Errors:** 401, 403, 404

#### `GET /admin/customers/{id}/summary`

**Permission:** customers.view · **Frontend call:** `customers.getListItem(id: string)`

Customer with order aggregates, for the admin detail page.

**Path:** `id` (string)

**Response 200:** [CustomerListItem](#customerlistitem) or null

**Errors:** 401, 403, 404

#### `GET /admin/customers/status-counts`

**Permission:** customers.view · **Frontend call:** `customers.statusCounts()`

Count per approval status (for the status summary).

**Response 200:** { rejected, pending, approved, suspended }

**Errors:** 401, 403

#### `GET /admin/customers/search`

**Permission:** customers.view · **Frontend call:** `customers.search(term: string, options?: { excludeGroupId?: string \| undefined; limit?: number \| undefined; } \| undefined)`

Any status; name/contact/email/phone search, max `limit` — for pickers.

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `q` | string | yes |  |
| `excludeGroupId` | string | no |  |
| `limit` | number | no |  |

**Response 200:** { companyName, id, status, contactName, groupId }[]

**Errors:** 401, 403

#### `POST /register`

**Permission:** public · **Frontend call:** `customers.register(input: RegistrationInput)`

Online wholesale application: creates a `pending` customer with the business address (delivery + billing), recorded as applied online. No login account or password — that needs the backend. Duplicate email/phone → 422.

**Rule:** Rate-limit it. Duplicate email or phone: 422.

**Request JSON:** [RegistrationInput](#registrationinput)

```json
{"companyName":"string","businessType":"string","contactName":"string","email":"string","phone":"string","address":{"prefecture":"string","city":"string","postalCode":"string","addressLine1":"string"},"acceptTerms":true}
```

**Response 200:** [Customer](#customer)

**Errors:** 409, 422

#### `GET /admin/customers/{id}/documents/{documentId}`

**Permission:** customer_approval.view · **Frontend call:** `customers.getDocument(customerId: string, documentId: string)`

Admin only: an uploaded identity document with its bytes (private; never cached).

**Rule:** Private storage, never cached.

**Path:** `id` (string), `documentId` (string)

**Response 200:** the file's bytes, with its Content-Type. Never publicly cached unless the file is public.

**Errors:** 401, 403, 404

#### `POST /admin/customers`

**Permission:** customers.create · **Frontend call:** `customers.create(input: CustomerQuickInput)`

Quick add with essentials only; records the initial status in the history.

**Request JSON:** [CustomerQuickInput](#customerquickinput)

```json
{"companyName":"string","status":"pending"}
```

**Response 200:** [Customer](#customer)

**Errors:** 401, 403, 409, 422

#### `PUT /admin/customers/{id}`

**Permission:** customers.edit · **Frontend call:** `customers.update(id: string, input: CustomerDetailsInput)`

**Path:** `id` (string)

**Request JSON:** [CustomerDetailsInput](#customerdetailsinput)

```json
{"companyName":"string"}
```

**Response 200:** [Customer](#customer)

**Errors:** 401, 403, 404, 409, 422

#### `PUT /customer/profile`

**Permission:** customer · **Frontend call:** `customers.updateProfile(id: string, input: CustomerProfileInput)`

The customer's own edit of their business and contact details.

**Request JSON:** [CustomerProfileInput](#customerprofileinput)

```json
{"companyName":"string","contactName":"string","email":"string","phone":"string"}
```

**Response 200:** [Customer](#customer)

**Errors:** 401, 403, 409, 422

#### `POST /admin/customers/{id}/status`

**Permission:** customer_approval.approve · **Frontend call:** `customers.setStatus(id: string, status: AccountStatus, reason: string \| undefined)`

Approval workflow step; appends an AccountStatusEvent. Reason required for reject/suspend.

**Rule:** A reason is required to reject or suspend.

**Path:** `id` (string)

**Request JSON:** { status, reason }

```json
{"status":"rejected","reason":"string"}
```

**Response 200:** [Customer](#customer)

**Errors:** 401, 403, 404, 409, 422

#### `PUT /customers/{id}/addresses`

**Permission:** customers.edit or customer · **Frontend call:** `customers.saveAddress(id: string, input: AddressInput)`

Create (no id) or update an address; keeps one default per address type.

**Rule:** Creates without an address id. One default per address type.

**Path:** `id` (string)

**Request JSON:** [AddressInput](#addressinput)

```json
{"type":"shipping","label":"string","recipientName":"string","country":"string","prefecture":"string","city":"string","postalCode":"string","addressLine1":"string","phone":"string","isDefault":true}
```

**Response 200:** [Customer](#customer)

**Errors:** 401, 403, 404, 409, 422

#### `DELETE /customers/{id}/addresses/{addressId}`

**Permission:** customers.edit or customer · **Frontend call:** `customers.deleteAddress(id: string, addressId: string)`

**Path:** `id` (string), `addressId` (string)

**Response 200:** [Customer](#customer)

**Errors:** 401, 403, 404, 409, 422

#### `GET /admin/customer-groups/all`

**Permission:** customers.view · **Frontend call:** `customers.listGroups()`

All groups, e.g. for filter options.

**Response 200:** [CustomerGroup](#customergroup)[]

**Errors:** 401, 403

#### `GET /admin/customer-groups`

**Permission:** customers.view · **Frontend call:** `customers.listGroupSummaries(query?: ListQuery<GroupSortField> \| undefined)`

Groups as a searchable, sortable listing with member counts.

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `search` | string | no |  |
| `sort` | `name` \\| `customers` | no |  |
| `dir` | `asc` \\| `desc` | no |  |
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403

#### `GET /admin/customer-groups/{id}`

**Permission:** customers.view · **Frontend call:** `customers.getGroup(id: string)`

**Path:** `id` (string)

**Response 200:** [CustomerGroupListItem](#customergrouplistitem) or null

**Errors:** 401, 403, 404

#### `POST /admin/customer-groups`

**Permission:** customers.create · **Frontend call:** `customers.createGroup(input: CustomerGroupInput)`

**Request JSON:** [CustomerGroupInput](#customergroupinput)

```json
{"name":"string"}
```

**Response 200:** [CustomerGroup](#customergroup)

**Errors:** 401, 403, 409, 422

#### `PUT /admin/customer-groups/{id}`

**Permission:** customers.edit · **Frontend call:** `customers.updateGroup(id: string, input: CustomerGroupInput)`

Rename / describe. The id never changes, so future price and quantity rules keep pointing at it.

**Path:** `id` (string)

**Request JSON:** [CustomerGroupInput](#customergroupinput)

```json
{"name":"string"}
```

**Response 200:** [CustomerGroup](#customergroup)

**Errors:** 401, 403, 404, 409, 422

#### `POST /admin/customer-groups/{id}/members`

**Permission:** customers.edit · **Frontend call:** `customers.assignGroupMembers(id: string, change: { add: string[]; remove: string[]; })`

Adds customers to (moving them from any other group) or removes them from this group.

**Path:** `id` (string)

**Request JSON:** { add, remove }

```json
{"add":["string"],"remove":["string"]}
```

**Response 200:** [CustomerGroupListItem](#customergrouplistitem)

**Errors:** 401, 403, 404, 409, 422

#### `GET /customer/notifications`

**Permission:** customer · **Frontend call:** `customers.listNotifications(customerId: string, query?: NotificationListQuery \| undefined)`

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `kind` | `order` \\| `account` \\| `delivery` \\| `reminder` | no |  |
| `unreadOnly` | boolean | no |  |
| `search` | string | no |  |
| `sort` | `date` | no |  |
| `dir` | `asc` \\| `desc` | no |  |
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403

### Orders, checkout, adjustments, delivered weight, refunds and invoices

#### `DELETE /admin/orders/{id}`

**Permission:** orders.delete · **Frontend call:** `orders.remove(id: string)`

Refused unless the order is cancelled with no payment, refund or invoice.

**Rule:** Only a cancelled order with no payment, refund or invoice. 422 otherwise.

**Path:** `id` (string)

**Response 200:** { id }

**Errors:** 401, 403, 404, 409, 422

#### `GET /orders`

**Permission:** orders.view or customer · **Frontend call:** `orders.list(query?: OrderListQuery \| undefined)`

`search` matches order number and customer name; dates filter on placement date. Rows carry `orderType`.

**Rule:** Customers only ever get their own.

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `customerId` | string | no | Scope to one customer (always set for the customer portal). |
| `status` | `received` \\| `preparing` \\| `on_the_way` \\| `delivered` \\| `cancelled` | no |  |
| `excludeCancelled` | boolean | no | Leave out cancelled orders (matches dashboard and customer order counts). Ignored when `status` is set. |
| `open` | boolean | no | Only open orders (`isOpenOrder`). Ignored when `status` is set. |
| `paymentStatus` | `unpaid` \\| `invoiced` \\| `paid` \\| `partially_refunded` \\| `refunded` | no |  |
| `deliveryRouteId` | string | no |  |
| `orderType` | `first` \\| `repeat` \\| `walk_in` | no |  |
| `search` | string | no |  |
| `sort` | `number` \\| `customer` \\| `status` \\| `placed` \\| `total` | no |  |
| `dir` | `asc` \\| `desc` | no |  |
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |
| `from` | string | no |  |
| `to` | string | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403

#### `GET /orders/{id}`

**Permission:** orders.view or customer · **Frontend call:** `orders.getById(id: string, customerId?: string \| undefined)`

Pass customerId to scope the lookup to that customer's own orders.

**Rule:** Another customer's order is 404.

**Path:** `id` (string)

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `customerId` | string | no |  |

**Response 200:** [Order](#order) or null

**Errors:** 401, 403, 404

#### `GET /admin/orders/calculation-settings`

**Permission:** orders.view · **Frontend call:** `orders.calculationSettings()`

**Response 200:** [OrderCalculationSettings](#ordercalculationsettings)

**Errors:** 401, 403

#### `GET /admin/orders/customers`

**Permission:** orders_create.create · **Frontend call:** `orders.searchCustomers(term: string, limit?: number \| undefined)`

Approved customers matching a name/email/phone search (max `limit`), for the order form.

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `q` | string | yes |  |
| `limit` | number | no |  |

**Response 200:** { id, companyName, contactName, phone, email }[]

**Errors:** 401, 403

#### `GET /admin/orders/customers/{id}`

**Permission:** orders_create.create · **Frontend call:** `orders.customerContext(customerId: string)`

Addresses and suggested delivery charge for an approved customer; null otherwise.

**Path:** `id` (string)

**Response 200:** [OrderCustomerContext](#ordercustomercontext) or null

**Errors:** 401, 403, 404

#### `GET /orderable-products/{id}`

**Permission:** orders_create.create or products.view or customer · **Frontend call:** `orders.orderableProduct(productId: string, customerId?: string \| undefined)`

Purchasable options of a product with this customer's prices; null if not orderable. Without a customer id (walk-in order) options carry the catalog price (sale price when active) — rule prices need an approved account.

**Rule:** customerId prices it for that customer (staff creating an order). standard=true gives the standard wholesale price (staff viewing the store). Neither: walk-in catalog prices.

**Path:** `id` (string)

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `customerId` | string | no |  |

**Response 200:** [OrderableProduct](#orderableproduct) or null

**Errors:** 401, 403, 404

#### `POST /admin/orders/quote-line`

**Permission:** orders_create.create · **Frontend call:** `orders.quoteLine(customerId: string \| undefined, productId: string, variationId: string \| undefined, quantity: number)`

Rule price and quantity limits for one line at a quantity (prices can change with bulk tiers). No customer id = walk-in.

**Request JSON:** { customerId, productId, variationId, quantity }

```json
{"customerId":"string","productId":"string","variationId":"string","quantity":0}
```

**Response 200:** [OrderLineQuote](#orderlinequote) or null

**Errors:** 401, 403, 404, 422

#### `POST /admin/orders`

**Permission:** orders_create.create · **Frontend call:** `orders.create(input: CreateOrderInput)`

Admin creates an order on behalf of a customer. Item details are snapshotted from the catalog.

**Rule:** Snapshot item details. Walk-in orders need only a name.

**Request JSON:** [CreateOrderInput](#createorderinput)

```json
{"items":[{"productId":"string","quantity":0,"unitPrice":0,"discount":0}],"shipping":{"label":"string","amount":0,"mode":"suggested"},"paymentMethod":"invoice"}
```

**Response 200:** [Order](#order)

**Errors:** 401, 403, 409, 422

#### `POST /admin/orders/{id}/status`

**Permission:** order_status.edit · **Frontend call:** `orders.updateStatus(id: string, status: OrderStatus, note?: string \| undefined)`

Moves along received → preparing → on_the_way → delivered, or cancels (with a note).

**Rule:** received → preparing → on_the_way → delivered, or cancelled with a reason.

**Path:** `id` (string)

**Request JSON:** { status, note }

```json
{"status":"received"}
```

**Response 200:** [Order](#order)

**Errors:** 401, 403, 404, 409, 422

#### `POST /admin/orders/{id}/notes`

**Permission:** orders_edit.edit · **Frontend call:** `orders.addNote(id: string, note: { type: OrderNoteType; body: string; })`

**Path:** `id` (string)

**Request JSON:** { type, body }

```json
{"type":"customer","body":"string"}
```

**Response 200:** [Order](#order)

**Errors:** 401, 403, 404, 409, 422

#### `POST /admin/orders/{id}/adjust-item`

**Permission:** order_prices.edit or order_quantities.edit or delivered_weight.edit · **Frontend call:** `orders.adjustItem(id: string, input: AdjustItemInput)`

Changes an item's fulfilled weight and/or agreed unit price, recording an audit entry.

**Rule:** Delivered weight: line = agreed price × delivered ÷ ordered weight. Keep the original for comparison.

**Path:** `id` (string)

**Request JSON:** [AdjustItemInput](#adjustiteminput)

```json
{"itemId":"string","reason":"string"}
```

**Response 200:** [Order](#order)

**Errors:** 401, 403, 404, 409, 422

#### `POST /admin/orders/{id}/edit`

**Permission:** order_items.edit or order_discounts.edit or order_addresses.edit or orders_edit.edit · **Frontend call:** `orders.edit(id: string, edit: OrderEdit)`

Edits an existing order (adjust / add / remove / replace an item, order discount, delivery date): validates against the order's status, recalculates with the order's own tax basis, records the change in `adjustments` and keeps catalog products unchanged.

**Rule:** Check the permission for the kind of edit: add and remove need order_items.edit, discount order_discounts.edit, address order_addresses.edit, delivery date and shipping orders_edit.edit. Recalculates with the order's own tax basis; never changes the catalog.

**Path:** `id` (string)

**Request JSON:** [OrderEdit](#orderedit)

```json
{"kind":"adjust","itemId":"string","reason":"string"}
```

**Response 200:** [Order](#order)

**Errors:** 401, 403, 404, 409, 422

#### `POST /admin/orders/{id}/invoices`

**Permission:** invoices.create · **Frontend call:** `orders.issueInvoice(id: string, input: { kind: InvoiceKind; reason?: string \| undefined; })`

Issues the next invoice document (see src/lib/orders/invoice.ts): the first invoice, a revision after the order changed, or a credit note for a cancelled order. Issued documents are frozen and never rewritten.

**Rule:** Issued documents are frozen.

**Path:** `id` (string)

**Request JSON:** { kind, reason }

```json
{"kind":"invoice"}
```

**Response 200:** [Order](#order)

**Errors:** 401, 403, 404, 409, 422

#### `POST /customer/checkout`

**Permission:** customer · **Frontend call:** `orders.checkout(customerId: string, input: CheckoutInput)`

Customer checkout from their server-side cart: re-prices every line for the customer, checks quantity rules and stock, quotes shipping for the chosen address, snapshots tax and creates the order (`createdVia: "storefront"`, never paid). Empties the cart. The same `idempotencyKey` returns the order already placed (no duplicate).

**Rule:** Re-price and re-check everything. The same idempotencyKey returns the order already placed.

**Request JSON:** [CheckoutInput](#checkoutinput)

```json
{"shippingAddressId":"string","paymentMethod":"bank_transfer","idempotencyKey":"string"}
```

**Response 200:** [Order](#order)

**Errors:** 401, 403, 409, 422

#### `GET /customer/summary`

**Permission:** customer · **Frontend call:** `orders.accountSummary(customerId: string)`

Totals for the customer dashboard.

**Response 200:** [AccountSummary](#accountsummary)

**Errors:** 401, 403

#### `GET /customer/invoices`

**Permission:** customer · **Frontend call:** `orders.listInvoices(query: { customerId: string; search?: string \| undefined; page?: number \| undefined; perPage?: number \| undefined; })`

Every issued invoice document of a customer, newest first.

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `search` | string | no |  |
| `page` | number | no |  |
| `perPage` | number | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403

#### `POST /customer/checkout/preview`

**Permission:** customer · **Frontend call:** `orders.checkoutPreview(customerId: string, input: Omit<CheckoutInput, "idempotencyKey">)`

What `checkout` would create, without saving (totals for the checkout page).

**Request JSON:** { shippingAddressId, shippingMethodId, billingAddressId, paymentMethod, requestedDeliveryDate, customerNote }

```json
{"shippingAddressId":"string","paymentMethod":"bank_transfer"}
```

**Response 200:** [CheckoutPreview](#checkoutpreview)

**Errors:** 401, 403, 409, 422

#### `POST /admin/orders/{id}/refunds`

**Permission:** refunds.refund · **Frontend call:** `orders.refund(id: string, input: RefundInput)`

Records a refund (see src/lib/orders/refund.ts): items, shipping or another amount, or an overpayment. Optionally returns refunded quantities to stock. DEMO: status "recorded" — no money is moved; the payment backend processes refunds and sets "processed".

**Rule:** The backend moves the money, and must be idempotent.

**Path:** `id` (string)

**Request JSON:** [RefundInput](#refundinput)

```json
{"kind":"order","lines":[{"orderItemId":"string","quantity":0,"amount":0}],"shipping":0,"other":0,"reason":"string","restock":true}
```

**Response 200:** [Order](#order)

**Errors:** 401, 403, 404, 409, 422

#### `POST /admin/orders/{id}/payments`

**Permission:** orders_edit.edit · **Frontend call:** `orders.recordPayment(id: string, input: RecordPaymentInput)`

Admin records payment received outside the site (unpaid/invoiced → paid). Never charges anyone.

**Path:** `id` (string)

**Request JSON:** [RecordPaymentInput](#recordpaymentinput)

```json
{}
```

**Response 200:** [Order](#order)

**Errors:** 401, 403, 404, 409, 422

#### `POST /admin/orders/{id}/edit/preview`

**Permission:** order_items.edit or order_discounts.edit or order_addresses.edit or orders_edit.edit · **Frontend call:** `orders.previewEdit(id: string, edit: OrderEdit)`

Same as `edit` without saving: before/after totals for the confirmation step.

**Path:** `id` (string)

**Request JSON:** [OrderEdit](#orderedit)

```json
{"kind":"adjust","itemId":"string","reason":"string"}
```

**Response 200:** [OrderEditPreview](#ordereditpreview)

**Errors:** 401, 403, 404, 409, 422

### Cart and quick order

#### `GET /customer/cart`

**Permission:** customer · **Frontend call:** `cart.get(customerId: string)`

**Rule:** Re-priced on every read. Never cache publicly.

**Response 200:** [Cart](#cart)

**Errors:** 401, 403

#### `POST /customer/cart/lines`

**Permission:** customer · **Frontend call:** `cart.add(customerId: string, lines: CartLineInput[])`

Adds lines (same option = quantities summed). Unknown, archived or unpriced products are skipped with a reason.

**Request JSON:** { lines }

```json
{"lines":[{"productId":"string","quantity":0}]}
```

**Response 200:** { cart, added, skipped }

**Errors:** 401, 403, 409, 422

#### `PATCH /customer/cart/lines/{lineId}`

**Permission:** customer · **Frontend call:** `cart.setQuantity(customerId: string, lineId: string, quantity: number)`

Quantity 0 removes the line.

**Path:** `lineId` (string)

**Request JSON:** { quantity }

```json
{"quantity":0}
```

**Response 200:** [Cart](#cart)

**Errors:** 401, 403, 404, 409, 422

#### `GET /quick-order`

**Permission:** public · **Frontend call:** `cart.quickOrder(customerId: string \| null, query?: QuickOrderQuery \| undefined)`

Quick order sheet: published products (name/SKU search, category incl. subcategories), sorted by name, paginated by product, one line per orderable option. Prices only when `customerId` is an approved customer (null = no prices).

**Rule:** Prices for an approved customer, and the standard wholesale price for a staff session; none for guests and applicants. 10 products per page; a product with options gives one line per option.

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `search` | string | no | Name, SKU (incl. variation SKUs) or GTIN. |
| `categorySlug` | string | no | Includes subcategories. |
| `productIds` | string[] | no | Limit to these products (e.g. the products on a shop page). |
| `page` | number | no |  |

**Response 200:** [QuickOrderPage](#quickorderpage)

#### `DELETE /customer/cart/lines/{lineId}`

**Permission:** customer · **Frontend call:** `cart.remove(customerId: string, lineId: string)`

**Path:** `lineId` (string)

**Response 200:** [Cart](#cart)

**Errors:** 401, 403, 404, 409, 422

#### `POST /customer/cart/coupon`

**Permission:** customer · **Frontend call:** `cart.applyCoupon(customerId: string, code: string)`

Saves a code on the cart if it applies now. It is re-checked on every read and at checkout.

**Rule:** Re-checked on every read and at checkout.

**Request JSON:** { code }

```json
{"code":"string"}
```

**Response 200:** [Cart](#cart)

**Errors:** 401, 403, 409, 422

#### `DELETE /customer/cart/coupon`

**Permission:** customer · **Frontend call:** `cart.removeCoupon(customerId: string)`

**Response 200:** [Cart](#cart)

**Errors:** 401, 403, 409, 422

### Delivery schedules

#### `GET /admin/delivery-schedules`

**Permission:** delivery.view · **Frontend call:** `delivery.listRoutes(query?: RouteListQuery \| undefined)`

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `active` | boolean | no |  |
| `search` | string | no |  |
| `sort` | `name` \\| `fee` \\| `cutoff` | no |  |
| `dir` | `asc` \\| `desc` | no |  |
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403

#### `GET /customer/deliveries`

**Permission:** customer · **Frontend call:** `delivery.forCustomer(customerId: string)`

Each saved delivery address with its route and next delivery dates.

**Response 200:** [CustomerDeliveryLocation](#customerdeliverylocation)[]

**Errors:** 401, 403

#### `GET /admin/delivery-schedules/{id}`

**Permission:** delivery.view · **Frontend call:** `delivery.getRoute(id: string)`

**Path:** `id` (string)

**Response 200:** [DeliveryRoute](#deliveryroute) or null

**Errors:** 401, 403, 404

#### `GET /admin/delivery-schedules/{id}/detail`

**Permission:** delivery.view · **Frontend call:** `delivery.routeDetail(id: string)`

Next dates, eligible customers and open orders, for the schedule page.

**Path:** `id` (string)

**Response 200:** [DeliveryRouteDetail](#deliveryroutedetail) or null

**Errors:** 401, 403, 404

#### `PUT /admin/delivery-schedules/{id?}`

**Permission:** delivery.manage · **Frontend call:** `delivery.saveRoute(id: string \| null, input: DeliveryRouteInput)`

**Rule:** POST when creating.

Without the id this is `POST /admin/delivery-schedules` (create).

**Path:** `id` (string)

**Request JSON:** [DeliveryRouteInput](#deliveryrouteinput)

```json
{"name":"string","active":true,"deliveryDays":["mon"],"cutoffTime":"string","areas":["string"]}
```

**Response 200:** [DeliveryRoute](#deliveryroute)

**Errors:** 401, 403, 404, 409, 422

#### `DELETE /admin/delivery-schedules/{id}`

**Permission:** delivery.manage · **Frontend call:** `delivery.deleteRoute(id: string)`

Refused while a reminder campaign uses it.

**Rule:** Refused while a reminder campaign uses it.

**Path:** `id` (string)

**Response 200:** { id }

**Errors:** 401, 403, 404, 409, 422

#### `GET /admin/reminders-legacy`

**Permission:** reminders.view · **Frontend call:** `delivery.listReminders(query?: ReminderListQuery \| undefined)`

**Rule:** Older model; not used by a screen now. Can be dropped.

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `type` | `reorder` \\| `order_cutoff` \\| `payment_due` | no |  |
| `channel` | `email` \\| `sms` \\| `whatsapp` | no |  |
| `active` | boolean | no |  |
| `search` | string | no |  |
| `sort` | `type` \\| `lastSent` | no |  |
| `dir` | `asc` \\| `desc` | no |  |
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403

### Postcode lookup

#### `GET /postcodes/{postalCode}`

**Permission:** public · **Frontend call:** `locations.lookupPostcode(postalCode: string)`

Postcode → prefecture/city/area suggestions. MOCK: a small sample dataset; "not_found" means "not in the data", never "invalid postcode".

**Path:** `postalCode` (string)

**Response 200:** [PostcodeLookup](#postcodelookup)

**Errors:** 404

### Store settings

#### `GET /store`

**Permission:** public · **Frontend call:** `settings.getStore()`

**Rule:** Read-only view of the company settings.

**Response 200:** [StoreSettings](#storesettings)

### Shipping zones, methods, rules, classes and pickup

#### `GET /admin/shipping/zones`

**Permission:** shipping.view · **Frontend call:** `shipping.listZones(query?: ListQuery<ZoneSortField> \| undefined)`

Default order is the matching order: postcode zones, then city, then prefecture, fallback last.

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `search` | string | no |  |
| `sort` | `name` \\| `match` | no |  |
| `dir` | `asc` \\| `desc` | no |  |
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403

#### `GET /admin/shipping/zones/{id}`

**Permission:** shipping.view · **Frontend call:** `shipping.getZone(id: string)`

**Path:** `id` (string)

**Response 200:** [ShippingZoneListItem](#shippingzonelistitem) or null

**Errors:** 401, 403, 404

#### `POST /admin/shipping/zones`

**Permission:** shipping.manage · **Frontend call:** `shipping.createZone(input: ShippingZoneInput)`

**Request JSON:** [ShippingZoneInput](#shippingzoneinput)

```json
{"name":"string","locations":[{"type":"prefecture","prefecture":"string"}],"methods":[{"id":"string","name":"string","enabled":true,"type":"flat_rate","cost":0,"classAdjustments":["<ClassAdjustment>"]}]}
```

**Response 200:** [ShippingZone](#shippingzone)

**Errors:** 401, 403, 409, 422

#### `PUT /admin/shipping/zones/{id}`

**Permission:** shipping.manage · **Frontend call:** `shipping.updateZone(id: string, input: ShippingZoneInput)`

**Path:** `id` (string)

**Request JSON:** [ShippingZoneInput](#shippingzoneinput)

```json
{"name":"string","locations":[{"type":"prefecture","prefecture":"string"}],"methods":[{"id":"string","name":"string","enabled":true,"type":"flat_rate","cost":0,"classAdjustments":["<ClassAdjustment>"]}]}
```

**Response 200:** [ShippingZone](#shippingzone)

**Errors:** 401, 403, 404, 409, 422

#### `DELETE /admin/shipping/zones/{id}`

**Permission:** shipping.manage · **Frontend call:** `shipping.deleteZone(id: string)`

The fallback zone cannot be deleted.

**Rule:** The fallback zone can't be deleted.

**Path:** `id` (string)

**Response 200:** { id }

**Errors:** 401, 403, 404, 409, 422

#### `POST /shipping/quote`

**Permission:** customer or shipping.view · **Frontend call:** `shipping.quote(input: ShippingQuoteInput)`

**Rule:** Authoritative. Repeat at cart, checkout and order creation. Tester numbers are staff-only.

**Request JSON:** [ShippingQuoteInput](#shippingquoteinput)

```json
{"address":{"prefecture":"string","city":"string"},"items":[{"productId":"string","quantity":0}]}
```

**Response 200:** [ShippingQuoteResult](#shippingquoteresult)

**Errors:** 401, 403, 422

#### `GET /admin/shipping/rules`

**Permission:** shipping.view · **Frontend call:** `shipping.listRules()`

**Response 200:** [ShippingRule](#shippingrule)[]

**Errors:** 401, 403

#### `GET /admin/shipping/rules/{id}`

**Permission:** shipping.view · **Frontend call:** `shipping.getRule(id: string)`

**Path:** `id` (string)

**Response 200:** [ShippingRule](#shippingrule) or null

**Errors:** 401, 403, 404

#### `PUT /admin/shipping/rules/{id?}`

**Permission:** shipping.manage · **Frontend call:** `shipping.saveRule(id: string \| null, input: ShippingRuleInput)`

**Rule:** POST when creating.

Without the id this is `POST /admin/shipping/rules` (create).

**Path:** `id` (string)

**Request JSON:** [ShippingRuleInput](#shippingruleinput)

```json
{"name":"string","enabled":true,"priority":0,"match":"all","conditions":[{"field":"quantity","op":"lt","value":0}],"action":{"type":"set_charge","amount":0},"zoneIds":["string"]}
```

**Response 200:** [ShippingRule](#shippingrule)

**Errors:** 401, 403, 404, 409, 422

#### `DELETE /admin/shipping/rules/{id}`

**Permission:** shipping.manage · **Frontend call:** `shipping.deleteRule(id: string)`

**Path:** `id` (string)

**Response:** 204, no body.

**Errors:** 401, 403, 404

#### `GET /admin/shipping/classes`

**Permission:** shipping.view · **Frontend call:** `shipping.listClasses()`

**Response 200:** [ShippingClassUsage](#shippingclassusage)[]

**Errors:** 401, 403

#### `PUT /admin/shipping/classes/{id?}`

**Permission:** shipping.manage · **Frontend call:** `shipping.saveClass(id: string \| null, input: ShippingClassInput)`

**Rule:** POST when creating.

Without the id this is `POST /admin/shipping/classes` (create).

**Path:** `id` (string)

**Request JSON:** [ShippingClassInput](#shippingclassinput)

```json
{"name":"string"}
```

**Response 200:** [ShippingClassUsage](#shippingclassusage)

**Errors:** 401, 403, 404, 409, 422

#### `DELETE /admin/shipping/classes/{id}`

**Permission:** shipping.manage · **Frontend call:** `shipping.deleteClass(id: string)`

Refused while products use the class.

**Rule:** Refused while products use it.

**Path:** `id` (string)

**Response 200:** { id }

**Errors:** 401, 403, 404, 409, 422

#### `GET /admin/shipping/pickups`

**Permission:** shipping.view · **Frontend call:** `shipping.listPickups()`

**Response 200:** [PickupLocation](#pickuplocation)[]

**Errors:** 401, 403

#### `PUT /admin/shipping/pickups/{id?}`

**Permission:** shipping.manage · **Frontend call:** `shipping.savePickup(id: string \| null, input: PickupLocationInput)`

**Rule:** POST when creating.

Without the id this is `POST /admin/shipping/pickups` (create).

**Path:** `id` (string)

**Request JSON:** [PickupLocationInput](#pickuplocationinput)

```json
{"name":"string","enabled":true,"address":"string","fee":0}
```

**Response 200:** [PickupLocation](#pickuplocation)

**Errors:** 401, 403, 404, 409, 422

#### `DELETE /admin/shipping/pickups/{id}`

**Permission:** shipping.manage · **Frontend call:** `shipping.deletePickup(id: string)`

**Path:** `id` (string)

**Response:** 204, no body.

**Errors:** 401, 403, 404

#### `GET /admin/shipping/settings`

**Permission:** shipping.view · **Frontend call:** `shipping.getGeneral()`

**Response 200:** [ShippingGeneralSettings](#shippinggeneralsettings)

**Errors:** 401, 403

#### `PUT /admin/shipping/settings`

**Permission:** shipping.manage · **Frontend call:** `shipping.updateGeneral(input: ShippingGeneralSettings)`

**Request JSON:** [ShippingGeneralSettings](#shippinggeneralsettings)

```json
{"hidePaidWhenFree":true,"unavailableMessage":"string"}
```

**Response:** 204, no body.

**Errors:** 401, 403, 422

#### `PATCH /admin/shipping/zones/{zoneId}/methods/{methodId}`

**Permission:** shipping.manage · **Frontend call:** `shipping.setMethodEnabled(zoneId: string, methodId: string, enabled: boolean)`

**Path:** `zoneId` (string), `methodId` (string)

**Request JSON:** { enabled }

```json
{"enabled":true}
```

**Response 200:** { id }

**Errors:** 401, 403, 404, 409, 422

#### `POST /admin/shipping/zones/test`

**Permission:** shipping.manage · **Frontend call:** `shipping.testDraftZone(zone: ShippingZoneInput, input: { address: ShippingAddress; grams: number; subtotal: number; })`

Quotes a zone that isn't saved yet, for the guided setup.

**Request JSON:** { zone, address, grams, subtotal }

```json
{"zone":{"name":"string","locations":[{"type":"prefecture","prefecture":"string"}],"methods":[{"id":"string","name":"string","enabled":true,"type":"flat_rate","cost":0,"classAdjustments":["<ClassAdjustment>"]}]},"address":{"prefecture":"string","city":"string"},"grams":0,"subtotal":0}
```

**Response 200:** [RuledQuote](#ruledquote)

**Errors:** 401, 403, 422

### Tax

#### `GET /admin/tax/settings`

**Permission:** taxes.view · **Frontend call:** `tax.getSettings()`

**Response 200:** [TaxSettings](#taxsettings)

**Errors:** 401, 403

#### `PUT /admin/tax/settings`

**Permission:** taxes.manage · **Frontend call:** `tax.updateSettings(input: TaxSettingsInput)`

**Request JSON:** [TaxSettingsInput](#taxsettingsinput)

```json
{"enabled":true,"pricesIncludeTax":true,"shippingTaxable":true,"shippingTaxClass":"standard"}
```

**Response 200:** [TaxSettings](#taxsettings)

**Errors:** 401, 403, 409, 422

#### `GET /admin/tax/classes`

**Permission:** taxes.view · **Frontend call:** `tax.classes()`

**Response 200:** [TaxClassUsage](#taxclassusage)[]

**Errors:** 401, 403

#### `GET /admin/tax/rates`

**Permission:** taxes.view · **Frontend call:** `tax.listRates(query?: TaxRateListQuery \| undefined)`

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `taxClass` | `standard` \\| `reduced` \\| `exempt` | no |  |
| `enabled` | boolean | no |  |
| `search` | string | no |  |
| `sort` | `name` \\| `percent` \\| `match` | no |  |
| `dir` | `asc` \\| `desc` | no |  |
| `page` | number | no | 1-based page number. |
| `perPage` | number | no |  |

**Response 200:** { items, page, perPage, total, totalPages }

**Errors:** 401, 403

#### `GET /admin/tax/rates/{id}`

**Permission:** taxes.view · **Frontend call:** `tax.getRate(id: string)`

**Path:** `id` (string)

**Response 200:** [TaxRateListItem](#taxratelistitem) or null

**Errors:** 401, 403, 404

#### `POST /admin/tax/rates`

**Permission:** taxes.manage · **Frontend call:** `tax.createRate(input: TaxRateInput)`

**Request JSON:** [TaxRateInput](#taxrateinput)

```json
{"name":"string","enabled":true,"percent":0,"location":{"type":"country","country":"string"},"taxClass":"standard"}
```

**Response 200:** [TaxRate](#taxrate)

**Errors:** 401, 403, 409, 422

#### `PUT /admin/tax/rates/{id}`

**Permission:** taxes.manage · **Frontend call:** `tax.updateRate(id: string, input: TaxRateInput)`

**Path:** `id` (string)

**Request JSON:** [TaxRateInput](#taxrateinput)

```json
{"name":"string","enabled":true,"percent":0,"location":{"type":"country","country":"string"},"taxClass":"standard"}
```

**Response 200:** [TaxRate](#taxrate)

**Errors:** 401, 403, 404, 409, 422

#### `DELETE /admin/tax/rates/{id}`

**Permission:** taxes.manage · **Frontend call:** `tax.deleteRate(id: string)`

**Path:** `id` (string)

**Response 200:** { id }

**Errors:** 401, 403, 404, 409, 422

#### `POST /tax/snapshot`

**Permission:** orders_create.create · **Frontend call:** `tax.snapshotFor(address: ShippingAddress)`

Current settings + rates matched for an address, frozen for a new order.

**Request JSON:** [ShippingAddress](#shippingaddress)

```json
{"prefecture":"string","city":"string"}
```

**Response 200:** [OrderTaxSnapshot](#ordertaxsnapshot)

**Errors:** 401, 403, 422

#### `POST /admin/tax/preview`

**Permission:** taxes.view · **Frontend call:** `tax.preview(input: TaxPreviewInput)`

**Request JSON:** [TaxPreviewInput](#taxpreviewinput)

```json
{"address":{"prefecture":"string","city":"string"},"lines":[{"productId":"string","quantity":0}]}
```

**Response 200:** [TaxPreviewResult](#taxpreviewresult)

**Errors:** 401, 403, 422

### Payment methods

#### `GET /admin/payment-methods`

**Permission:** payments.view · **Frontend call:** `payments.listMethods()`

All methods in display order, with availability.

**Response 200:** [PaymentMethodListItem](#paymentmethodlistitem)[]

**Errors:** 401, 403

#### `GET /admin/payment-methods/{id}`

**Permission:** payments.view · **Frontend call:** `payments.getMethod(id: PaymentMethodId)`

**Path:** `id` ([PaymentMethodId](#paymentmethodid))

**Response 200:** [PaymentMethodListItem](#paymentmethodlistitem) or null

**Errors:** 401, 403, 404

#### `PUT /admin/payment-methods/{id}`

**Permission:** payments.manage · **Frontend call:** `payments.updateMethod(id: PaymentMethodId, input: PaymentMethodInput)`

**Rule:** Gateway secrets stay on the backend, never in this API.

**Path:** `id` ([PaymentMethodId](#paymentmethodid))

**Request JSON:** [PaymentMethodInput](#paymentmethodinput)

```json
{"enabled":true,"title":"string","description":"string","instructions":"string"}
```

**Response 200:** [PaymentMethodSettings](#paymentmethodsettings)

**Errors:** 401, 403, 404, 409, 422

#### `POST /admin/payment-methods/reorder`

**Permission:** payments.manage · **Frontend call:** `payments.reorderMethods(ids: PaymentMethodId[])`

Saves a new display order; `ids` must list every method exactly once.

**Request JSON:** { ids }

```json
{"ids":["bank_transfer"]}
```

**Response 200:** [PaymentMethodListItem](#paymentmethodlistitem)[]

**Errors:** 401, 403, 409, 422

#### `GET /customer/payment-methods`

**Permission:** customer · **Frontend call:** `payments.checkoutMethods()`

For checkout (not built yet): enabled AND available methods, in display order, with customer-facing fields only. Online payment is excluded until a provider is connected.

**Response 200:** [CheckoutPaymentMethod](#checkoutpaymentmethod)[]

**Errors:** 401, 403

### Reports and dashboard

#### `GET /admin/reports`

**Permission:** reports.view · **Frontend call:** `analytics.report(range: DateRange)`

Reports screen figures; cancelled orders count only in the status report.

**Rule:** Compute in the database. Definitions: src/lib/reports/aggregate.ts.

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `from` | string | yes |  |
| `to` | string | yes |  |

**Response 200:** [ReportData](#reportdata)

**Errors:** 401, 403

#### `GET /admin/dashboard`

**Permission:** dashboard.view · **Frontend call:** `analytics.getDashboard(query: DashboardQuery)`

Admin dashboard figures for a date range, optionally compared with a second range.

**Query:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `from` | [DashboardQuery](#dashboardquery) | yes |  |
| `to` | [DashboardQuery](#dashboardquery) | yes |  |
| `compareFrom` | [DashboardQuery](#dashboardquery) | yes |  |
| `compareTo` | [DashboardQuery](#dashboardquery) | yes |  |

**Response 200:** [DashboardSummary](#dashboardsummary)

**Errors:** 401, 403

## Types

JSON Schema for all of these is in `openapi.yaml`.

### AboutContent

| Field | Type | Required | Notes |
|---|---|---|---|
| `eyebrow` | string | yes |  |
| `title` | string | yes |  |
| `text` | string | yes |  |
| `image` | [SiteImage](#siteimage) or null | yes |  |
| `pillars` | [IconText](#icontext)[] | yes |  |
| `valuesEyebrow` | string | yes |  |
| `valuesTitle` | string | yes |  |
| `values` | [IconText](#icontext)[] | yes |  |
| `serveEyebrow` | string | yes |  |
| `serveTitle` | string | yes |  |
| `serveText` | string | yes |  |
| `serve` | { icon, title }[] | yes |  |
| `ctaTitle` | string | yes |  |
| `ctaText` | string | yes |  |

### AccountStatus

Type: `rejected` \| `pending` \| `approved` \| `suspended`

### AccountStatusEvent

One approval decision, kept as an audit trail.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `from` | `rejected` \\| `pending` \\| `approved` \\| `suspended` | no | Undefined for the first entry (account created). |
| `to` | [AccountStatus](#accountstatus) | yes |  |
| `reason` | string | no | Required for rejections and suspensions. |
| `at` | string | yes |  |
| `by` | [Actor](#actor) | yes |  |

### AccountSummary

| Field | Type | Required | Notes |
|---|---|---|---|
| `totalOrders` | number | yes |  |
| `openOrders` | number | yes |  |
| `monthSpend` | number | yes |  |
| `lastMonthSpend` | number | yes |  |
| `byStatus` | { status, count }[] | yes |  |

### Actor

Who did something (for history and audit).

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `name` | string | yes |  |
| `role` | `customer` \\| `admin` \\| `system` | yes |  |

### Address

Japanese address: postcode (NNN-NNNN) → prefecture (都道府県) → city (市区町村) → optional town (町域) → street/building.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `type` | [AddressType](#addresstype) | yes |  |
| `label` | string | yes |  |
| `recipientName` | string | yes |  |
| `companyName` | string | no |  |
| `country` | string | yes | ISO 3166-1 alpha-2, e.g. "JP". |
| `prefecture` | string | yes |  |
| `city` | string | yes |  |
| `area` | string | no | Town (町域), e.g. "Nishi-Shinjuku"; optional. |
| `postalCode` | string | yes |  |
| `addressLine1` | string | yes |  |
| `addressLine2` | string | no |  |
| `phone` | string | yes |  |
| `isDefault` | boolean | yes |  |
| `legacyWooId` | number | no |  |

### AddressInput

Create (no id) or update (id) one address in the customer's address book.

| Field | Type | Required | Notes |
|---|---|---|---|
| `companyName` | string | no |  |
| `type` | [AddressType](#addresstype) | yes |  |
| `label` | string | yes |  |
| `recipientName` | string | yes |  |
| `country` | string | yes | ISO 3166-1 alpha-2, e.g. "JP". |
| `prefecture` | string | yes |  |
| `city` | string | yes |  |
| `area` | string | no | Town (町域), e.g. "Nishi-Shinjuku"; optional. |
| `postalCode` | string | yes |  |
| `addressLine1` | string | yes |  |
| `addressLine2` | string | no |  |
| `phone` | string | yes |  |
| `isDefault` | boolean | yes |  |
| `id` | string | no |  |

### AddressType

Type: `shipping` \| `billing`

### AdjustItemInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `itemId` | string | yes |  |
| `quantity` | number | no | New quantity; the ordered weight scales with it. |
| `unitPrice` | number | no |  |
| `fulfilledWeight` | [Weight](#weight) | no |  |
| `reason` | string | yes |  |

### AdminBrandRow

Brand row for the admin brand list.

| Field | Type | Required | Notes |
|---|---|---|---|
| `productCount` | number | yes |  |
| `id` | string | yes |  |
| `slug` | string | yes |  |
| `name` | string | yes |  |
| `logo` | [SiteImage](#siteimage) or null | no | Shown in the homepage brands section. Without one, the name is shown. |
| `showOnHome` | boolean | no |  |
| `displayOrder` | number | no | Lower comes first on the homepage. |
| `legacyWooId` | number | no |  |

### AdminCategoryRow

Category row for the admin category list.

| Field | Type | Required | Notes |
|---|---|---|---|
| `path` | string | yes | "Parent › Child" display path. |
| `depth` | number | yes |  |
| `productCount` | number | yes |  |
| `id` | string | yes |  |
| `slug` | string | yes |  |
| `name` | string | yes |  |
| `description` | string | no |  |
| `parentId` | string | no |  |
| `status` | [CategoryStatus](#categorystatus) | yes | Hidden categories are not shown on the storefront. |
| `image` | [ProductImage](#productimage) | no |  |
| `legacyWooId` | number | no |  |

### AdminNotification

Something staff should look at. Derived from current data, so it disappears once the work is done.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `kind` | [AdminNotificationKind](#adminnotificationkind) | yes |  |
| `title` | string | yes |  |
| `detail` | string | no |  |
| `href` | string | no | Where to act on it; absent when there is no screen for it yet. |
| `at` | string | yes |  |
| `read` | boolean | yes |  |

### AdminNotificationFeed

| Field | Type | Required | Notes |
|---|---|---|---|
| `items` | [AdminNotification](#adminnotification)[] | yes | Newest first, at most the requested number. |
| `total` | number | yes | All notifications, including those past the limit. |
| `unread` | number | yes | Bell count. |
| `openOrders` | number | yes | Sidebar badge: orders in progress (not yet delivered or cancelled). Reading a notification does not change it. |
| `pendingRegistrations` | number | yes | Sidebar badge: registrations still pending; approved, rejected and suspended ones are not counted. |

### AdminNotificationKind

Type: `contact` \| `order` \| `registration` \| `low_stock`

### AdminProductRow

Row shape for the admin product list.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `type` | [ProductType](#producttype) | yes |  |
| `slug` | string | yes |  |
| `sku` | string | yes |  |
| `name` | string | yes |  |
| `status` | [ProductStatus](#productstatus) | yes |  |
| `visibility` | [ProductVisibility](#productvisibility) | yes |  |
| `image` | [ProductImage](#productimage) | no |  |
| `categoryNames` | string[] | yes |  |
| `price` | { min, max } | no | Simple: the price. Variable: lowest–highest active variation price. |
| `salePrice` | number | no | Simple products only. |
| `stock` | [StockInfo](#stockinfo) | yes |  |
| `weight` | [Weight](#weight) | yes |  |
| `originCountry` | string | no |  |
| `variationCount` | number | yes |  |
| `unpricedVariations` | number | yes | Enabled variations without a price (cannot be purchased). |
| `updatedAt` | string | yes |  |

### AppliedTaxRate

The rate that applied to a class at an address (copied into orders).

| Field | Type | Required | Notes |
|---|---|---|---|
| `rateId` | string | yes |  |
| `name` | string | yes |  |
| `percent` | number | yes |  |
| `taxClass` | [TaxClass](#taxclass) | yes |  |
| `matchedBy` | `country` \\| `prefecture` \\| `city` \\| `postcode` | yes |  |

### Attribute

Store-wide reusable attribute (e.g. Size) with a shared list of values.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `slug` | string | yes |  |
| `name` | string | yes |  |
| `values` | [AttributeValue](#attributevalue)[] | yes |  |
| `legacyWooId` | number | no |  |

### AttributeValue

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `slug` | string | yes |  |
| `name` | string | yes |  |
| `legacyWooId` | number | no |  |

### BackorderPolicy

Whether orders may exceed available stock.

Type: `no` \| `notify` \| `allow`

### BankAccountDetails

Bank account shown to customers who choose Bank Transfer. Demo values are fictional.

| Field | Type | Required | Notes |
|---|---|---|---|
| `accountName` | string | yes |  |
| `bankName` | string | yes |  |
| `accountNumber` | string | yes |  |
| `branchName` | string | no |  |
| `routingNumber` | string | no | Optional bank/branch code shown to the customer (its format depends on the country). |

### BlogPost

A journal article.

| Field | Type | Required | Notes |
|---|---|---|---|
| `tag` | string | yes | First category, shown on cards. |
| `categories` | string[] | yes |  |
| `tags` | string[] | yes |  |
| `readingMinutes` | number | yes |  |
| `id` | string | yes |  |
| `slug` | string | yes |  |
| `title` | string | yes |  |
| `excerpt` | string | yes | Short summary for cards and search results. |
| `bodyHtml` | string | yes | Sanitized HTML: on save by the backend, and again when rendered (src/lib/html/sanitize.ts). |
| `status` | [ContentStatus](#contentstatus) | yes |  |
| `publishedAt` | string | no | When a scheduled item goes live, or when it was published. |
| `image` | [ProductImage](#productimage) | no | Absent = no featured image. |
| `seo` | [SeoFields](#seofields) | yes |  |
| `authorName` | string | yes |  |
| `createdAt` | string | yes |  |
| `updatedAt` | string | yes |  |
| `trashedFrom` | `draft` \\| `published` \\| `scheduled` | no | Status to return to when restored from the trash. |

### BlogPostInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `image` | [ProductImage](#productimage) | no | Absent = no featured image. |
| `title` | string | yes |  |
| `bodyHtml` | string | yes | Sanitized HTML: on save by the backend, and again when rendered (src/lib/html/sanitize.ts). |
| `slug` | string | yes |  |
| `excerpt` | string | yes | Short summary for cards and search results. |
| `publishedAt` | string | no | When a scheduled item goes live, or when it was published. |
| `status` | [ContentStatus](#contentstatus) | yes |  |
| `seo` | [SeoFields](#seofields) | yes |  |
| `categories` | string[] | yes |  |
| `tags` | string[] | yes |  |

### BlogPostSummary

A post without its body, for cards.

| Field | Type | Required | Notes |
|---|---|---|---|
| `image` | [ProductImage](#productimage) | no | Absent = no featured image. |
| `title` | string | yes |  |
| `id` | string | yes |  |
| `slug` | string | yes |  |
| `excerpt` | string | yes | Short summary for cards and search results. |
| `tag` | string | yes | First category, shown on cards. |
| `authorName` | string | yes |  |
| `publishedAt` | string | no | When a scheduled item goes live, or when it was published. |
| `readingMinutes` | number | yes |  |

### Brand

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `slug` | string | yes |  |
| `name` | string | yes |  |
| `logo` | [SiteImage](#siteimage) or null | no | Shown in the homepage brands section. Without one, the name is shown. |
| `showOnHome` | boolean | no |  |
| `displayOrder` | number | no | Lower comes first on the homepage. |
| `legacyWooId` | number | no |  |

### BrandFacet

Brand with the number of publicly listed products (shop filter).

| Field | Type | Required | Notes |
|---|---|---|---|
| `productCount` | number | yes |  |
| `id` | string | yes |  |
| `slug` | string | yes |  |
| `name` | string | yes |  |
| `logo` | [SiteImage](#siteimage) or null | no | Shown in the homepage brands section. Without one, the name is shown. |
| `showOnHome` | boolean | no |  |
| `displayOrder` | number | no | Lower comes first on the homepage. |
| `legacyWooId` | number | no |  |

### BrandImage

An image chosen for branding. Width and height keep the layout stable.

| Field | Type | Required | Notes |
|---|---|---|---|
| `url` | string | yes |  |
| `width` | number | yes |  |
| `height` | number | yes |  |

### BrandInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes |  |
| `logo` | [SiteImage](#siteimage) or null | yes |  |
| `showOnHome` | boolean | yes |  |
| `displayOrder` | number | yes |  |

### ButtonStyle

Type: `rounded` \| `pill` \| `square`

### CandidateOutcome

Type: `winner` \| `outranked` \| `skipped`

### Cart

| Field | Type | Required | Notes |
|---|---|---|---|
| `customerId` | string | yes |  |
| `lines` | [CartLine](#cartline)[] | yes |  |
| `itemsSubtotal` | number | yes | Sum of priced lines, before shipping and tax. |
| `coupon` | [CartCoupon](#cartcoupon) | no | The coupon the customer entered, re-checked on every read. |
| `valid` | boolean | yes | True when every line can be ordered. |
| `updatedAt` | string | no |  |

### CartCoupon

The coupon on a cart, re-checked on every read.

| Field | Type | Required | Notes |
|---|---|---|---|
| `code` | string | yes |  |
| `discount` | number | no | Set while the coupon applies. |
| `error` | string | no | Why it doesn't apply right now. |

### CartLine

A cart line priced for the customer at its quantity (bulk tiers apply), with what blocks checkout.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | `${productId}:${variationId ?? ""}` — one line per product option. |
| `slug` | string | yes |  |
| `name` | string | yes |  |
| `sku` | string | yes |  |
| `variationLabel` | string | no |  |
| `image` | [ProductImage](#productimage) | no |  |
| `unitLabel` | string | yes |  |
| `pricedByWeight` | boolean | yes |  |
| `stockStatus` | [StockStatus](#stockstatus) | yes |  |
| `unitPrice` | number | no |  |
| `lineTotal` | number | no |  |
| `priceNote` | string | no | e.g. "Your price", "Sale price", a tier label. |
| `minQuantity` | number | yes |  |
| `maxQuantity` | number | no |  |
| `step` | number | yes |  |
| `error` | string | no | Set when this line can't be ordered as it is (quantity rule, stock, no price, removed product). |
| `productId` | string | yes |  |
| `variationId` | string | no |  |
| `quantity` | number | yes |  |

### CartLineInput

What the browser may send: product, option and quantity. Prices are always resolved on the server.

| Field | Type | Required | Notes |
|---|---|---|---|
| `productId` | string | yes |  |
| `variationId` | string | no |  |
| `quantity` | number | yes |  |

### CartMetrics

| Field | Type | Required | Notes |
|---|---|---|---|
| `units` | number | yes |  |
| `totalGrams` | number | yes |  |
| `subtotal` | number | yes |  |
| `classUnits` | map of number | yes | Units per shipping class id. |

### Category

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `slug` | string | yes |  |
| `name` | string | yes |  |
| `description` | string | no |  |
| `parentId` | string | no |  |
| `status` | [CategoryStatus](#categorystatus) | yes | Hidden categories are not shown on the storefront. |
| `image` | [ProductImage](#productimage) | no |  |
| `legacyWooId` | number | no |  |

### CategoryInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes |  |
| `slug` | string | yes |  |
| `parentId` | string | no |  |
| `description` | string | no |  |
| `status` | [CategoryStatus](#categorystatus) | yes |  |
| `image` | [ProductImage](#productimage) | no |  |

### CategoryStatus

Type: `active` \| `hidden`

### ChargeBreakdown

| Field | Type | Required | Notes |
|---|---|---|---|
| `base` | number | yes | The method's own charge, or the rule's. |
| `surcharges` | { label, amount }[] | yes |  |
| `final` | number | yes |  |
| `free` | boolean | yes |  |

### CheckoutInput

Customer checkout. Addresses come from the customer's own address book.

| Field | Type | Required | Notes |
|---|---|---|---|
| `shippingAddressId` | string | yes |  |
| `shippingMethodId` | string | no | The customer's choice; absent = the cheapest delivery method. |
| `billingAddressId` | string | no | Defaults to the customer's default billing address, else the delivery address. |
| `paymentMethod` | [PaymentMethodId](#paymentmethodid) | yes |  |
| `requestedDeliveryDate` | string | no | YYYY-MM-DD, today or later in the store time zone. |
| `customerNote` | string | no |  |
| `idempotencyKey` | string | yes | One per checkout page view: a repeated submission returns the order already placed. |

### CheckoutPaymentMethod

What checkout will receive: customer-facing fields only, enabled and available methods, in order.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | [PaymentMethodId](#paymentmethodid) | yes |  |
| `title` | string | yes |  |
| `description` | string | yes |  |
| `instructions` | string | yes |  |
| `bank` | [BankAccountDetails](#bankaccountdetails) | no |  |

### CheckoutPreview

What checkout would create, without saving it.

| Field | Type | Required | Notes |
|---|---|---|---|
| `items` | [OrderItem](#orderitem)[] | yes |  |
| `shipping` | [ShippingCharge](#shippingcharge) | yes |  |
| `taxes` | [TaxLine](#taxline)[] | yes |  |
| `totals` | [OrderTotals](#ordertotals) | yes |  |
| `paymentStatus` | [PaymentStatus](#paymentstatus) | yes |  |
| `coupon` | [OrderCoupon](#ordercoupon) | no | Coupon the customer used. Its amount is shared across the lines' discounts; apart from the staff order discount. |
| `shippingOptions` | [CheckoutShippingOption](#checkoutshippingoption)[] | yes |  |
| `selectedMethodId` | string | no |  |

### CheckoutShippingOption

A delivery option the customer can choose at checkout.

| Field | Type | Required | Notes |
|---|---|---|---|
| `methodId` | string | yes |  |
| `name` | string | yes |  |
| `type` | `flat_rate` \\| `weight_tiers` \\| `subtotal_tiers` \\| `free_shipping` \\| `local_pickup` | yes |  |
| `cost` | number | yes |  |
| `detail` | string | no | Pickup location details, when there are any. |

### ClassAdjustment

Extra charge when the cart contains items of a shipping class.

| Field | Type | Required | Notes |
|---|---|---|---|
| `shippingClassId` | string | yes |  |
| `amount` | number | yes |  |
| `per` | `order` \\| `unit` | yes | Once per order, or per unit of that class. |

### CompanyAddress

| Field | Type | Required | Notes |
|---|---|---|---|
| `addressLine1` | string | yes |  |
| `addressLine2` | string | no |  |
| `area` | string | no |  |
| `city` | string | yes |  |
| `prefecture` | string | yes | Top address level: prefecture, state, division… The label follows the country. |
| `postalCode` | string | yes |  |
| `country` | string | yes |  |

### CompanyBranding

| Field | Type | Required | Notes |
|---|---|---|---|
| `logoMain` | [BrandImage](#brandimage) or null | yes | Used wherever no more specific logo is set. Null shows a text placeholder. |
| `logoLight` | [BrandImage](#brandimage) or null | yes | On light backgrounds. Falls back to the main logo. |
| `logoDark` | [BrandImage](#brandimage) or null | yes | On dark backgrounds and the admin sidebar. Falls back to the main logo. |
| `logoMobile` | [BrandImage](#brandimage) or null | yes | In the store header on phones. Falls back to the theme logo. |
| `favicon` | string or null | yes |  |
| `primaryColor` | string | yes | #rrggbb |
| `secondaryColor` | string | yes |  |
| `accentColor` | string | yes |  |
| `headingFont` | string | yes |  |
| `bodyFont` | string | yes |  |
| `buttonStyle` | [ButtonStyle](#buttonstyle) | yes |  |

### CompanyContact

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | yes |  |
| `phone` | string | yes |  |
| `whatsapp` | string | no |  |
| `hours` | string | no |  |
| `address` | [CompanyAddress](#companyaddress) | yes |  |
| `map` | { lat, lng, label } | no |  |
| `social` | [SocialLink](#sociallink)[] | yes |  |

### CompanyDocumentBranding

How documents present the company. Invoice and email modules read these.

| Field | Type | Required | Notes |
|---|---|---|---|
| `invoiceTitle` | string | no | Heading on invoices, e.g. "Tax invoice". Default "Invoice". |
| `invoicePrefix` | string | no | Number prefix, e.g. INV gives INV-2026-0001. |
| `invoiceHeaderNote` | string | no |  |
| `showLogoOnInvoice` | boolean | no |  |
| `showRegistrationOnInvoice` | boolean | no |  |
| `showTaxNumberOnInvoice` | boolean | no |  |
| `attachInvoicePdf` | boolean | no | Settings for the backend's invoice email; nothing is sent in the demo. |
| `emailInvoiceOnIssue` | boolean | no |  |
| `invoiceFooter` | string | no |  |
| `emailSenderName` | string | no |  |
| `emailFooter` | string | no |  |

### CompanyLocale

| Field | Type | Required | Notes |
|---|---|---|---|
| `country` | string | yes |  |
| `currencyCode` | string | yes |  |
| `currencySymbol` | string | yes |  |
| `currencyDigits` | `0` or `2` or `3` | yes | Decimals an amount may have: 0 for JPY, 2 for USD. Drives money rounding. |
| `symbolPosition` | [SymbolPosition](#symbolposition) | yes |  |
| `numberLocale` | string | yes | BCP 47 tag for number grouping, e.g. ja-JP. |
| `dateLocale` | string | yes | BCP 47 tag for dates, e.g. en-GB. |
| `language` | string | yes | Page language, e.g. en. |
| `timeZone` | string | yes | IANA name, e.g. Asia/Tokyo. |
| `weekStartsOn` | `0` or `2` or `3` or `1` or `4` or `5` or `6` | yes | First day of the week in date pickers: 0 = Sunday … 6 = Saturday. |
| `weightUnit` | `kg` \\| `g` | yes |  |
| `dimensionUnit` | `cm` \\| `mm` \\| `m` | yes |  |

### CompanySettings

Everything that makes one deployment a particular company. One company per deployment.

| Field | Type | Required | Notes |
|---|---|---|---|
| `companyName` | string | yes |  |
| `legalName` | string | no |  |
| `storeName` | string | yes |  |
| `tagline` | string | no |  |
| `description` | string | no |  |
| `registrationNumber` | string | no |  |
| `taxNumber` | string | no |  |
| `branding` | [CompanyBranding](#companybranding) | yes |  |
| `contact` | [CompanyContact](#companycontact) | yes |  |
| `documents` | [CompanyDocumentBranding](#companydocumentbranding) | yes |  |
| `locale` | [CompanyLocale](#companylocale) | yes |  |
| `setup` | [CompanySetupProgress](#companysetupprogress) | yes |  |
| `updatedAt` | string | yes |  |

### CompanySettingsInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `companyName` | string | yes |  |
| `legalName` | string | no |  |
| `storeName` | string | yes |  |
| `tagline` | string | no |  |
| `description` | string | no |  |
| `registrationNumber` | string | no |  |
| `taxNumber` | string | no |  |
| `branding` | [CompanyBranding](#companybranding) | yes |  |
| `contact` | [CompanyContact](#companycontact) | yes |  |
| `documents` | [CompanyDocumentBranding](#companydocumentbranding) | yes |  |
| `locale` | [CompanyLocale](#companylocale) | yes |  |

### CompanySetupProgress

| Field | Type | Required | Notes |
|---|---|---|---|
| `completedAt` | string | no |  |

### ConditionField

Type: `quantity` \| `category` \| `weight` \| `city` \| `postcode` \| `coupon` \| `product` \| `subtotal` \| `region` \| `shipping_class` \| `customer_group`

### ConditionOp

Type: `lt` \| `lte` \| `gt` \| `gte` \| `in` \| `not_in`

### ContactMessage

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `receivedAt` | string | yes |  |
| `name` | string | yes |  |
| `company` | string | no |  |
| `email` | string | yes |  |
| `phone` | string | no |  |
| `topic` | [ContactTopic](#contacttopic) | yes |  |
| `message` | string | yes |  |

### ContactMessageInput

What the public contact form sends.

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes |  |
| `company` | string | no |  |
| `email` | string | yes |  |
| `phone` | string | no |  |
| `topic` | [ContactTopic](#contacttopic) | yes |  |
| `message` | string | yes |  |

### ContactTopic

Type: `general` \| `products` \| `account` \| `orders` \| `other`

### ContentPage

| Field | Type | Required | Notes |
|---|---|---|---|
| `visibility` | [PageVisibility](#pagevisibility) | yes |  |
| `id` | string | yes |  |
| `slug` | string | yes |  |
| `title` | string | yes |  |
| `excerpt` | string | yes | Short summary for cards and search results. |
| `bodyHtml` | string | yes | Sanitized HTML: on save by the backend, and again when rendered (src/lib/html/sanitize.ts). |
| `status` | [ContentStatus](#contentstatus) | yes |  |
| `publishedAt` | string | no | When a scheduled item goes live, or when it was published. |
| `image` | [ProductImage](#productimage) | no | Absent = no featured image. |
| `seo` | [SeoFields](#seofields) | yes |  |
| `authorName` | string | yes |  |
| `createdAt` | string | yes |  |
| `updatedAt` | string | yes |  |
| `trashedFrom` | `draft` \\| `published` \\| `scheduled` | no | Status to return to when restored from the trash. |

### ContentPageInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `image` | [ProductImage](#productimage) | no | Absent = no featured image. |
| `title` | string | yes |  |
| `bodyHtml` | string | yes | Sanitized HTML: on save by the backend, and again when rendered (src/lib/html/sanitize.ts). |
| `slug` | string | yes |  |
| `excerpt` | string | yes | Short summary for cards and search results. |
| `publishedAt` | string | no | When a scheduled item goes live, or when it was published. |
| `status` | [ContentStatus](#contentstatus) | yes |  |
| `seo` | [SeoFields](#seofields) | yes |  |
| `visibility` | [PageVisibility](#pagevisibility) | yes |  |

### ContentStatus

Type: `draft` \| `published` \| `scheduled` \| `trash`

### Coupon

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `code` | string | yes | Stored in capitals. |
| `description` | string | no |  |
| `type` | [CouponType](#coupontype) | yes |  |
| `amount` | number | yes | Percent, or an amount in the store currency. |
| `minSpend` | number | no | On the cart subtotal. |
| `maxSpend` | number | no |  |
| `productIds` | string[] | yes | Limits to these products or categories; both empty means every product. |
| `categorySlugs` | string[] | yes |  |
| `excludedProductIds` | string[] | yes |  |
| `customerIds` | string[] | yes | Limits to these customers or groups; both empty means every approved customer. |
| `groupIds` | string[] | yes |  |
| `startsOn` | string | no | YYYY-MM-DD in store time, both inclusive. |
| `expiresOn` | string | no |  |
| `usageLimit` | number | no |  |
| `usageLimitPerCustomer` | number | no |  |
| `usedCount` | number | yes |  |
| `enabled` | boolean | yes |  |
| `createdAt` | string | yes |  |
| `updatedAt` | string | yes |  |

### CouponInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `description` | string | no |  |
| `enabled` | boolean | yes |  |
| `code` | string | yes | Stored in capitals. |
| `type` | [CouponType](#coupontype) | yes |  |
| `amount` | number | yes | Percent, or an amount in the store currency. |
| `minSpend` | number | no | On the cart subtotal. |
| `maxSpend` | number | no |  |
| `productIds` | string[] | yes | Limits to these products or categories; both empty means every product. |
| `categorySlugs` | string[] | yes |  |
| `excludedProductIds` | string[] | yes |  |
| `customerIds` | string[] | yes | Limits to these customers or groups; both empty means every approved customer. |
| `groupIds` | string[] | yes |  |
| `startsOn` | string | no | YYYY-MM-DD in store time, both inclusive. |
| `expiresOn` | string | no |  |
| `usageLimit` | number | no |  |
| `usageLimitPerCustomer` | number | no |  |

### CouponType

Type: `percent` \| `fixed_cart` \| `fixed_product`

### CouponUsage

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `couponId` | string | yes |  |
| `orderId` | string | yes |  |
| `orderNumber` | string | yes |  |
| `customerId` | string | yes |  |
| `customerName` | string | yes |  |
| `discount` | number | yes |  |
| `at` | string | yes |  |

### CreateOrderInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `customerId` | string | no | Registered customer; omit (with `walkIn`) for a walk-in order. |
| `walkIn` | { name, companyName, email, phone } | no | Walk-in buyer (no account is created). Name required; email and phone optional. |
| `fulfilment` | `delivery` \\| `pickup` | no | Absent = "delivery". "pickup" is for walk-in orders only. |
| `billingAddress` | [OrderAddressInput](#orderaddressinput) | no | Required for delivery; ignored for pickup. |
| `shippingAddress` | [OrderAddressInput](#orderaddressinput) | no |  |
| `items` | { productId, variationId, quantity, unitPrice, discount }[] | yes |  |
| `shipping` | { label, amount, mode, reason, methodId } | yes | `methodId`: the delivery option the customer chose at checkout. |
| `paymentMethod` | [PaymentMethod](#paymentmethod) | yes |  |
| `customerNote` | string | no |  |
| `adminNote` | string | no |  |
| `requestedDeliveryDate` | string | no |  |
| `coupon` | [OrderCoupon](#ordercoupon) | no | Checkout only: the coupon behind the line discounts. |

### CtaLink

| Field | Type | Required | Notes |
|---|---|---|---|
| `label` | string | yes |  |
| `href` | string | yes |  |

### Customer

| Field | Type | Required | Notes |
|---|---|---|---|
| `remindersOptOut` | boolean | no | The customer turned off delivery reminders. |
| `id` | string | yes |  |
| `companyName` | string | yes | Business (trading) name — the only required name. |
| `contactName` | string | no | Contact details can be completed later, but at least one of phone or email is required. |
| `email` | string | no |  |
| `phone` | string | no |  |
| `businessType` | string | no |  |
| `tradeLicenseNumber` | string | no | Trade licence number (optional, verified by staff). |
| `vatRegistrationNumber` | string | no | VAT Business Identification Number (optional). |
| `status` | [AccountStatus](#accountstatus) | yes |  |
| `statusHistory` | [AccountStatusEvent](#accountstatusevent)[] | yes |  |
| `groupId` | string | no |  |
| `deliveryRouteId` | string | no |  |
| `addresses` | [Address](#address)[] | yes |  |
| `internalNote` | string | no | Internal staff note; never shown to the customer. |
| `documents` | [CustomerDocument](#customerdocument)[] | no | Identity documents uploaded with the application. Staff only; file bytes are served by a separate admin call. |
| `createdAt` | string | yes |  |
| `approvedAt` | string | no |  |
| `updatedAt` | string | no |  |
| `legacyWooId` | number | no |  |

### CustomerDeliveryLocation

| Field | Type | Required | Notes |
|---|---|---|---|
| `address` | [Address](#address) | yes |  |
| `route` | { name, id, deliveryDays, cutoffTime } | no |  |
| `upcoming` | [UpcomingDelivery](#upcomingdelivery)[] | yes |  |

### CustomerDetailsInput

Full edit of the customer's own details (addresses and status have their own calls).

| Field | Type | Required | Notes |
|---|---|---|---|
| `companyName` | string | yes |  |
| `contactName` | string | no |  |
| `phone` | string | no |  |
| `email` | string | no |  |
| `businessType` | string | no |  |
| `tradeLicenseNumber` | string | no |  |
| `vatRegistrationNumber` | string | no |  |
| `groupId` | string | no |  |
| `deliveryRouteId` | string | no |  |
| `internalNote` | string | no |  |

### CustomerDocument

Metadata of an uploaded identity document (never the file itself).

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `kind` | [CustomerDocumentKind](#customerdocumentkind) | yes |  |
| `fileName` | string | yes |  |
| `contentType` | [DocumentContentType](#documentcontenttype) | yes | Detected from the file's content, not trusted from the browser. |
| `size` | number | yes | Bytes. |
| `uploadedAt` | string | yes |  |

### CustomerDocumentKind

Online wholesale application (see src/lib/validation/registration.ts). No password: accounts need the backend.

Type: `residence_card_front` \| `residence_card_back` \| `business_license`

### CustomerGroup

Group of customers. The stable `id` is what future price rules and quantity rules will target (`scope: { type: "group", groupId }`) — renaming keeps it.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `name` | string | yes |  |
| `description` | string | no |  |
| `legacyWooId` | number | no |  |

### CustomerGroupInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes |  |
| `description` | string | no |  |

### CustomerGroupListItem

| Field | Type | Required | Notes |
|---|---|---|---|
| `customerCount` | number | yes |  |
| `id` | string | yes |  |
| `name` | string | yes |  |
| `description` | string | no |  |
| `legacyWooId` | number | no |  |

### CustomerListItem

Admin list row: customer + order aggregates (non-cancelled orders).

| Field | Type | Required | Notes |
|---|---|---|---|
| `groupName` | string | no |  |
| `orderCount` | number | yes |  |
| `totalSpend` | number | yes | Sum of order totals after refunds, excluding cancelled orders. |
| `lastOrderAt` | string | no |  |
| `remindersOptOut` | boolean | no | The customer turned off delivery reminders. |
| `id` | string | yes |  |
| `companyName` | string | yes | Business (trading) name — the only required name. |
| `contactName` | string | no | Contact details can be completed later, but at least one of phone or email is required. |
| `email` | string | no |  |
| `phone` | string | no |  |
| `businessType` | string | no |  |
| `tradeLicenseNumber` | string | no | Trade licence number (optional, verified by staff). |
| `vatRegistrationNumber` | string | no | VAT Business Identification Number (optional). |
| `status` | [AccountStatus](#accountstatus) | yes |  |
| `statusHistory` | [AccountStatusEvent](#accountstatusevent)[] | yes |  |
| `groupId` | string | no |  |
| `deliveryRouteId` | string | no |  |
| `addresses` | [Address](#address)[] | yes |  |
| `internalNote` | string | no | Internal staff note; never shown to the customer. |
| `documents` | [CustomerDocument](#customerdocument)[] | no | Identity documents uploaded with the application. Staff only; file bytes are served by a separate admin call. |
| `createdAt` | string | yes |  |
| `approvedAt` | string | no |  |
| `updatedAt` | string | no |  |
| `legacyWooId` | number | no |  |

### CustomerNotification

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `customerId` | string | yes |  |
| `kind` | [NotificationKind](#notificationkind) | yes |  |
| `title` | string | yes |  |
| `body` | string | yes |  |
| `createdAt` | string | yes |  |
| `readAt` | string | no |  |

### CustomerProfileInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `companyName` | string | yes |  |
| `contactName` | string | yes |  |
| `email` | string | yes |  |
| `phone` | string | yes |  |
| `remindersOptOut` | boolean | no |  |

### CustomerQuickInput

Quick add: only the essentials; everything else can be completed later.

| Field | Type | Required | Notes |
|---|---|---|---|
| `companyName` | string | yes |  |
| `contactName` | string | no |  |
| `phone` | string | no |  |
| `email` | string | no |  |
| `status` | `pending` \\| `approved` | yes | Initial approval status. |
| `groupId` | string | no |  |

### DashboardQuery

| Field | Type | Required | Notes |
|---|---|---|---|
| `range` | [DateRange](#daterange) | yes |  |
| `compare` | [DateRange](#daterange) | no | Omit for no comparison. |

### DashboardSummary

| Field | Type | Required | Notes |
|---|---|---|---|
| `range` | [DateRange](#daterange) | yes |  |
| `compare` | [DateRange](#daterange) | no |  |
| `granularity` | `day` \\| `week` | yes | Bucket size of the revenue series. |
| `kpis` | { revenue, orders, activeCustomers, averageOrderValue, newOrders, repeatOrders } | yes |  |
| `revenueSeries` | { current, previous } | yes |  |
| `orderStatus` | { status, count }[] | yes | All orders placed in the range, by status (including cancelled). |
| `topProducts` | [RankingItem](#rankingitem)[] | yes |  |
| `topCategories` | [RankingItem](#rankingitem)[] | yes |  |
| `topCustomers` | [RankingItem](#rankingitem)[] | yes |  |
| `recentOrders` | [RecentOrderSummary](#recentordersummary)[] | yes |  |
| `lowStock` | [LowStockItem](#lowstockitem)[] | yes | Current stock — not affected by the date range. |
| `pendingApprovals` | number | yes | Applications awaiting review — not affected by the date range. |

### DateRange

Inclusive range of calendar dates ("YYYY-MM-DD") in the store time zone.

| Field | Type | Required | Notes |
|---|---|---|---|
| `from` | string | yes |  |
| `to` | string | yes |  |

### DeliveryDate

| Field | Type | Required | Notes |
|---|---|---|---|
| `date` | string | yes | Delivery day, YYYY-MM-DD. |
| `orderByDate` | string | yes | Last moment to order for it: the day before, at the route's cutoff, store time. |
| `orderByTime` | string | yes |  |

### DeliveryRoute

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `name` | string | yes |  |
| `areas` | string[] | yes | Prefectures, cities or areas served by this route. |
| `deliveryDays` | [Weekday](#weekday)[] | yes |  |
| `cutoffTime` | string | yes | Order cutoff in store local time, "HH:mm", on the day before delivery. |
| `shippingFee` | number | yes |  |
| `freeShippingThreshold` | number | no | LEGACY: shipping charges now come from shipping zones (src/lib/shipping). Orders at or above this subtotal shipped free. |
| `active` | boolean | yes |  |
| `excludedDates` | string[] | no | Holidays and other days without delivery, YYYY-MM-DD. |
| `extraDates` | string[] | no | Delivery on these dates even if not a regular day. |

### DeliveryRouteDetail

| Field | Type | Required | Notes |
|---|---|---|---|
| `upcoming` | [DeliveryDate](#deliverydate)[] | yes |  |
| `customers` | { id, name }[] | yes |  |
| `orders` | { id, number, customerName, status, requestedDeliveryDate }[] | yes |  |

### DeliveryRouteInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes |  |
| `active` | boolean | yes |  |
| `deliveryDays` | [Weekday](#weekday)[] | yes |  |
| `cutoffTime` | string | yes | Order cutoff in store local time, "HH:mm", on the day before delivery. |
| `areas` | string[] | yes | Prefectures, cities or areas served by this route. |
| `excludedDates` | string[] | no | Holidays and other days without delivery, YYYY-MM-DD. |
| `extraDates` | string[] | no | Delivery on these dates even if not a regular day. |

### Dimensions

| Field | Type | Required | Notes |
|---|---|---|---|
| `length` | number | yes |  |
| `width` | number | yes |  |
| `height` | number | yes |  |
| `unit` | [DimensionUnit](#dimensionunit) | yes |  |

### DimensionUnit

Type: `cm` \| `mm` \| `m`

### DocumentContentType

Type: `image/jpeg` \| `image/png` \| `image/webp` \| `application/pdf`

### DocumentUpload

A file received from a form, before it is stored.

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | [CustomerDocumentKind](#customerdocumentkind) | yes |  |
| `fileName` | string | yes |  |
| `bytes` | binary | yes |  |

### EmailLog

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `templateKey` | [EmailTemplateKey](#emailtemplatekey) | yes |  |
| `to` | string | yes |  |
| `subject` | string | yes |  |
| `status` | [EmailLogStatus](#emaillogstatus) | yes |  |
| `error` | string | no |  |
| `attempts` | number | yes |  |
| `campaignId` | string | no | Set when this row comes from a reminder campaign. |
| `at` | string | yes |  |

### EmailLogStatus

A record of an email the system would send. "simulated" means nothing left the server; "failed" shows how a failure looks. The backend adds "queued", "sent" and "bounced".

Type: `simulated` \| `failed`

### EmailSenderSettings

| Field | Type | Required | Notes |
|---|---|---|---|
| `senderName` | string | yes |  |
| `senderEmail` | string | yes |  |
| `replyTo` | string | no |  |
| `footer` | string | no |  |

### EmailTemplate

| Field | Type | Required | Notes |
|---|---|---|---|
| `key` | [EmailTemplateKey](#emailtemplatekey) | yes |  |
| `name` | string | yes |  |
| `trigger` | string | yes | When it would go out. |
| `audience` | `customer` \\| `staff` | yes |  |
| `enabled` | boolean | yes |  |
| `subject` | string | yes |  |
| `bodyHtml` | string | yes | Simple HTML with `{{placeholders}}`. |
| `placeholders` | string[] | yes |  |
| `supportsAttachment` | boolean | yes | Can carry the invoice PDF once the backend generates it. |
| `attachInvoice` | boolean | yes |  |
| `updatedAt` | string | yes |  |

### EmailTemplateInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `enabled` | boolean | yes |  |
| `subject` | string | yes |  |
| `bodyHtml` | string | yes | Simple HTML with `{{placeholders}}`. |
| `attachInvoice` | boolean | yes |  |

### EmailTemplateKey

Type: `customer_registered` \| `customer_approved` \| `password_reset` \| `order_confirmation` \| `order_processing` \| `order_status` \| `delivery_notification` \| `invoice` \| `refund` \| `reminder_with_order` \| `reminder_without_order`

### HeroSlide

| Field | Type | Required | Notes |
|---|---|---|---|
| `eyebrow` | string | yes |  |
| `title` | string | yes |  |
| `description` | string | yes |  |
| `cta` | [CtaLink](#ctalink) | yes |  |
| `secondaryCta` | [CtaLink](#ctalink) or null | no | Optional text link next to the button, such as "Open a trade account". |
| `image` | [SiteImage](#siteimage) or null | yes | With an image the slide uses the photo layout: the photo fills it and the copy sits on a frosted card. |
| `imageDark` | [SiteImage](#siteimage) or null | no | The photo for the dark theme. Without one, the light photo is used in both. |
| `icons` | string[] | yes | Shown when there is no image. |

### HomeSection

One homepage section. `type` decides its fields; order and visibility are shared.

Type: { id, enabled, type, slides, highlights } or { id, enabled, type, items } or { id, enabled, type, eyebrow, title, slugs, max } or { id, enabled, type, eyebrow, title, max } or { id, enabled, type, title, text } or { id, enabled, type, eyebrow, title, text, cta, image, cards } or { id, enabled, type, title, max } or { id, enabled, type, eyebrow, title, text, cta, image } or { id, enabled, type, eyebrow, title, text, image } or { id, enabled, type, eyebrow, title, items } or { id, enabled, type, eyebrow, title, max } or { id, enabled, type, title, text, cta }

### IconText

| Field | Type | Required | Notes |
|---|---|---|---|
| `icon` | string | yes | Name from the icon set. |
| `title` | string | yes |  |
| `text` | string | yes |  |

### InventoryRow

One stockable line on the inventory screen.

| Field | Type | Required | Notes |
|---|---|---|---|
| `productId` | string | yes |  |
| `productName` | string | yes |  |
| `variationId` | string | no |  |
| `variationLabel` | string | no |  |
| `sku` | string | yes |  |
| `stock` | [StockInfo](#stockinfo) | yes |  |
| `mode` | `quantity` \\| `status` | yes | "quantity" = counted; "status" = marked in or out of stock. |
| `shared` | boolean | yes | Options sharing the product's stock change together. |
| `lowStockThreshold` | number | no |  |
| `unavailable` | string | no |  |

### Invoice

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `number` | string | yes | e.g. "INV-2026-0007", "INV-2026-0007-R1", "INV-2026-0007-CN". |
| `kind` | [InvoiceKind](#invoicekind) | yes |  |
| `replaces` | string | no | Revisions and credit notes: the document number they replace or cancel. |
| `reason` | string | no | Required for revisions and credit notes. |
| `issuedAt` | string | yes |  |
| `issuedBy` | [Actor](#actor) | yes |  |
| `snapshot` | [InvoiceSnapshot](#invoicesnapshot) | yes |  |
| `difference` | number | no | Revisions and credit notes: total change against the replaced document (negative = credit to the customer). |

### InvoiceKind

"invoice" = first issue; "revision" = replaces the previous document after the order changed; "credit_note" = cancels it.

Type: `invoice` \| `revision` \| `credit_note`

### InvoiceListItem

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `number` | string | yes |  |
| `kind` | [InvoiceKind](#invoicekind) | yes |  |
| `replaces` | string | no |  |
| `orderId` | string | yes |  |
| `orderNumber` | string | yes |  |
| `issuedAt` | string | yes |  |
| `total` | number | yes |  |

### InvoiceSeller

The seller as printed, frozen when the invoice is issued.

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes |  |
| `addressLines` | string[] | yes |  |
| `contact` | string | no |  |
| `registrationNumber` | string | no |  |
| `taxNumber` | string | no |  |

### InvoiceSnapshot

| Field | Type | Required | Notes |
|---|---|---|---|
| `seller` | [InvoiceSeller](#invoiceseller) | no | Missing only on documents issued before this was added: those print the current company. |
| `coupon` | [OrderCoupon](#ordercoupon) | no |  |
| `orderNumber` | string | yes |  |
| `placedAt` | string | yes |  |
| `customerName` | string | yes |  |
| `walkIn` | [WalkInCustomer](#walkincustomer) | no |  |
| `customerEmail` | string | no |  |
| `customerPhone` | string | no |  |
| `billingAddress` | [Address](#address) | no |  |
| `shippingAddress` | [Address](#address) | no |  |
| `fulfilment` | `delivery` \\| `pickup` | no |  |
| `requestedDeliveryDate` | string | no |  |
| `items` | [OrderItem](#orderitem)[] | yes |  |
| `discount` | { type, value } | no |  |
| `shipping` | { amount, label } | yes |  |
| `taxes` | [TaxLine](#taxline)[] | yes |  |
| `totals` | [OrderTotals](#ordertotals) | yes |  |
| `paymentMethod` | [PaymentMethod](#paymentmethod) | yes |  |
| `paymentStatus` | [PaymentStatus](#paymentstatus) | yes |  |
| `amountPaid` | number | no |  |

### Kpi

| Field | Type | Required | Notes |
|---|---|---|---|
| `current` | number | yes |  |
| `previous` | number | no | Value for the comparison period, when one was requested. |

### LowStockItem

| Field | Type | Required | Notes |
|---|---|---|---|
| `productId` | string | yes |  |
| `name` | string | yes |  |
| `quantity` | number | yes |  |
| `unitLabel` | string | yes |  |

### MediaItem

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `url` | string | yes | Public address of the file. |
| `kind` | [MediaKind](#mediakind) | yes |  |
| `fileName` | string | yes |  |
| `title` | string | yes |  |
| `alt` | string | yes | Alternative text; describes the image for screen readers. |
| `contentType` | string | yes |  |
| `size` | number | yes | Bytes. |
| `width` | number | no | Pixels; images only. |
| `height` | number | no |  |
| `sample` | boolean | no | Bundled sample files cannot be removed from the demo. |
| `uploadedAt` | string | yes |  |
| `uploadedBy` | string | yes |  |

### MediaKind

Type: `image` \| `document`

### MediaUpdate

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes |  |
| `alt` | string | yes | Alternative text; describes the image for screen readers. |

### MediaUpload

| Field | Type | Required | Notes |
|---|---|---|---|
| `fileName` | string | yes |  |
| `title` | string | no |  |
| `alt` | string | no |  |
| `bytes` | binary | yes |  |
| `width` | number | no |  |
| `height` | number | no |  |

### MenuItem

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `label` | string | yes |  |
| `kind` | `category` \\| `page` \\| `custom` | yes | "page" and "category" follow the target; "custom" uses `url`. |
| `ref` | string | no | Page id or category slug. |
| `url` | string | no |  |
| `children` | [MenuItem](#menuitem)[] | yes |  |

### MenuLocation

Type: `header` \| `footer` \| `none`

### MethodQuote

| Field | Type | Required | Notes |
|---|---|---|---|
| `method` | [ShippingMethod](#shippingmethod) | yes |  |
| `available` | boolean | yes |  |
| `cost` | number | no | Store currency; set when available. |
| `breakdown` | string[] | yes | Plain-language calculation steps. |
| `reason` | string | no |  |

### NavigationMenu

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `name` | string | yes |  |
| `location` | [MenuLocation](#menulocation) | yes |  |
| `items` | [MenuItem](#menuitem)[] | yes |  |
| `updatedAt` | string | yes |  |

### NavigationMenuInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes |  |
| `items` | [MenuItem](#menuitem)[] | yes |  |
| `location` | [MenuLocation](#menulocation) | yes |  |

### NotificationKind

Type: `order` \| `account` \| `delivery` \| `reminder`

### OnlinePaymentConnection

Online payment provider connection. Only the backend may hold provider credentials; the frontend only ever sees the connection state.

| Field | Type | Required | Notes |
|---|---|---|---|
| `status` | `not_connected` \\| `connected` | yes |  |
| `providerName` | string | no | Display name of the connected provider, once a backend integration exists. |

### Order

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `number` | string | yes |  |
| `customerId` | string | no | The registered customer; absent for walk-in orders (see `walkIn`). |
| `walkIn` | [WalkInCustomer](#walkincustomer) | no | Set for walk-in orders created by staff without a customer account. |
| `customerName` | string | yes | Customer company name (or the walk-in buyer's name) at the time of the order (snapshot, for lists and search). |
| `customerEmail` | string | no |  |
| `customerPhone` | string | no |  |
| `status` | [OrderStatus](#orderstatus) | yes |  |
| `statusHistory` | [StatusEvent](#statusevent)[] | yes |  |
| `paymentStatus` | [PaymentStatus](#paymentstatus) | yes |  |
| `payment` | [PaymentDetails](#paymentdetails) | yes |  |
| `items` | [OrderItem](#orderitem)[] | yes |  |
| `billingAddress` | [Address](#address) | no | Absent only for walk-in orders collected at the store. |
| `shippingAddress` | [Address](#address) | no | Absent only for walk-in orders collected at the store. |
| `fulfilment` | `delivery` \\| `pickup` | no | Absent = "delivery". |
| `shipping` | [ShippingCharge](#shippingcharge) | yes |  |
| `taxes` | [TaxLine](#taxline)[] | yes |  |
| `totals` | [OrderTotals](#ordertotals) | yes |  |
| `taxSnapshot` | [OrderTaxSnapshot](#ordertaxsnapshot) | no | Tax settings and matched rates frozen at order time; recalculation uses these, never current rates. |
| `refunds` | [Refund](#refund)[] | yes |  |
| `notes` | [OrderNote](#ordernote)[] | yes |  |
| `coupon` | [OrderCoupon](#ordercoupon) | no | Coupon the customer used. Its amount is shared across the lines' discounts; apart from the staff order discount. |
| `discount` | [OrderDiscount](#orderdiscount) | no | Order-level discount, if any (the amount is `totals.orderDiscount`). |
| `adjustments` | [OrderAdjustment](#orderadjustment)[] | yes |  |
| `invoices` | [Invoice](#invoice)[] | no | Issued invoices, revisions and credit notes, oldest first. Append-only: issued documents are never rewritten. |
| `customerNote` | string | no | Note the customer wrote when ordering. |
| `requestedDeliveryDate` | string | no |  |
| `createdVia` | `admin` \\| `storefront` | yes |  |
| `createdBy` | [Actor](#actor) | no |  |
| `placedAt` | string | yes |  |
| `updatedAt` | string | yes |  |
| `legacyWooId` | number | no |  |

### OrderableOption

One purchasable option (the product itself, or one variation) for the admin order form.

| Field | Type | Required | Notes |
|---|---|---|---|
| `variationId` | string | no |  |
| `label` | string | yes | e.g. "Size: 5 kg"; empty for simple products. |
| `sku` | string | yes |  |
| `available` | boolean | yes |  |
| `stock` | [StockInfo](#stockinfo) | yes |  |
| `taxClass` | [TaxClass](#taxclass) | yes |  |
| `weight` | [Weight](#weight) | yes |  |
| `catalogPrice` | number | yes |  |
| `customerPrice` | number | yes | Price this customer would pay at the minimum quantity (price rules applied). |
| `minQuantity` | number | yes | Per-line quantity limits from the quantity rules. |
| `maxQuantity` | number | no |  |

### OrderableProduct

| Field | Type | Required | Notes |
|---|---|---|---|
| `productId` | string | yes |  |
| `name` | string | yes |  |
| `type` | [ProductType](#producttype) | yes |  |
| `unitLabel` | string | yes |  |
| `pricedByWeight` | boolean | yes |  |
| `options` | [OrderableOption](#orderableoption)[] | yes |  |

### OrderAddressInput

Address fields entered/edited for an order (snapshotted onto it).

| Field | Type | Required | Notes |
|---|---|---|---|
| `companyName` | string | no |  |
| `recipientName` | string | yes |  |
| `country` | string | yes | ISO 3166-1 alpha-2, e.g. "JP". |
| `prefecture` | string | yes |  |
| `city` | string | yes |  |
| `area` | string | no | Town (町域), e.g. "Nishi-Shinjuku"; optional. |
| `postalCode` | string | yes |  |
| `addressLine1` | string | yes |  |
| `addressLine2` | string | no |  |
| `phone` | string | yes |  |

### OrderAdjustment

Audit record of an admin changing an order: an item's price, weight or quantity, adding, removing or replacing an item, the order discount or the delivery date. Catalog products are never changed by these.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `kind` | [OrderChangeKind](#orderchangekind) | yes |  |
| `orderItemId` | string | no | The item changed (for "replace": the new item). Absent for order-level changes. |
| `itemName` | string | no | Item name at the time (for readable history); for "replace": the new item. |
| `replacedItemName` | string | no | "replace" only: the item that was taken out. |
| `addressType` | `shipping` \\| `billing` | no | "address" only: which address changed. |
| `reason` | string | yes |  |
| `at` | string | yes |  |
| `by` | [Actor](#actor) | yes |  |
| `before` | [OrderChangeValues](#orderchangevalues) | yes |  |
| `after` | [OrderChangeValues](#orderchangevalues) | yes |  |

### OrderCalculationSettings

| Field | Type | Required | Notes |
|---|---|---|---|
| `taxRates` | [TaxRates](#taxrates) | yes | Placeholder VAT rates (%) per class until the tax module exists. |
| `shippingTaxClass` | [TaxClass](#taxclass) | yes | Tax class applied to shipping charges. |

### OrderChangeKind

What an admin changed on an order (audit history).

Type: `shipping` \| `adjust` \| `add` \| `remove` \| `replace` \| `discount` \| `delivery_date` \| `address`

### OrderChangeValues

Values before/after a change: only the fields the change touched, plus the order total.

| Field | Type | Required | Notes |
|---|---|---|---|
| `quantity` | number | no |  |
| `unitPrice` | number | no |  |
| `fulfilledWeight` | [Weight](#weight) | no |  |
| `lineTotal` | number | no |  |
| `discount` | { type, value } or null | no | Order discount; null = none. |
| `deliveryDate` | string or null | no | YYYY-MM-DD; null = none. |
| `shipping` | number | no | Shipping charge and label (for "shipping"). |
| `shippingLabel` | string | no |  |
| `address` | string | no | One-line address (for "address"). |
| `orderTotal` | number | yes |  |

### OrderCoupon

A coupon applied to an order. Recorded apart from the staff order discount.

| Field | Type | Required | Notes |
|---|---|---|---|
| `code` | string | yes |  |
| `amount` | number | yes |  |

### OrderCustomerContext

Customer details the admin order form needs: addresses and a suggested delivery charge.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `companyName` | string | yes |  |
| `contactName` | string | no |  |
| `email` | string | no |  |
| `phone` | string | no |  |
| `addresses` | [Address](#address)[] | yes |  |

### OrderDiscount

Order-level discount on the items (after line discounts, before tax), set by an admin.

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | `percent` \\| `fixed` | yes |  |
| `value` | number | yes | Store-currency amount for "fixed"; a percentage (above 0, at most 100, up to 2 decimals) for "percent". |
| `reason` | string | yes |  |
| `at` | string | yes |  |
| `by` | [Actor](#actor) | yes |  |

### OrderEdit

Admin edits to an existing order. Each is validated, recalculated and recorded in `adjustments`.

Type: { kind, itemId, quantity, unitPrice, fulfilledWeight, reason } or { kind, productId, variationId, quantity, unitPrice, discount, reason, replaceItemId } or { kind, itemId, reason } or { kind, discount, reason } or { kind, date, reason } or { kind, which, address, reason } or { kind, label, amount, reason }

### OrderEditPreview

An edit applied without saving (for the confirmation preview).

| Field | Type | Required | Notes |
|---|---|---|---|
| `totalBefore` | number | yes |  |
| `totalAfter` | number | yes |  |
| `difference` | number | yes | totalAfter − totalBefore. |
| `lineTotal` | number | no | Line total after the change, for item edits. |
| `orderDiscount` | number | yes | Order discount amount after the change (0 = none). |
| `balanceAfter` | number | no | Balance against the amount already paid, when payment was collected (positive = still due, negative = overpaid). |

### OrderItem

One ordered line. Product details are SNAPSHOTS taken when the order was placed, so later catalog edits (name, SKU, price, weight) never rewrite it.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `productId` | string | yes | References for linking only — never re-read for display or totals. |
| `variationId` | string | no |  |
| `name` | string | yes |  |
| `sku` | string | yes |  |
| `attributes` | map of string | no | Selected variation options, e.g. { Size: "20 kg" }. |
| `unitLabel` | string | yes |  |
| `taxClass` | [TaxClass](#taxclass) | yes |  |
| `pricedByWeight` | boolean | yes | Price follows the packed weight (variable-weight products). |
| `quantity` | number | yes |  |
| `catalogUnitPrice` | number | yes | Catalog price per unit when ordered (snapshot, for reference). |
| `unitPrice` | number | yes | Agreed price per unit; may be adjusted by an admin. |
| `discount` | number | yes | Line discount (store currency); 0 when none. |
| `orderedWeight` | [Weight](#weight) | yes | quantity × unit weight at order time. |
| `fulfilledWeight` | [Weight](#weight) | no | Actual packed weight, once weighed/adjusted. |
| `lineSubtotal` | number | yes | Derived from the fields above (see src/lib/orders/calc.ts). |
| `lineTotal` | number | yes |  |
| `pricing` | [OrderItemPricing](#orderitempricing) | no | Snapshot of the price rule outcome at order time; later rule edits never change it. |
| `taxable` | boolean | no | Product tax status at order time: false for "none" / "shipping only". Absent = taxable. |
| `lineNet` | number | no | Line total excluding tax (net sales). Set on orders with a tax snapshot; absent = lineTotal (tax was never inside it). |
| `legacyWooId` | number | no |  |

### OrderItemPricing

| Field | Type | Required | Notes |
|---|---|---|---|
| `basePrice` | number | yes | Regular catalog price when ordered. |
| `salePrice` | number | no | Active sale price when ordered, if any. |
| `rulePrice` | number | no | Price the winning rule produced, when a rule applied. |
| `ruleUnitPrice` | number | yes | Suggested unit price: the lower of the rule price and the active sale price, else the regular price. |
| `source` | `rule` \\| `sale` \\| `regular` | yes | Where the suggested price came from (sale and rule discounts are never combined). |
| `ruleId` | string | no |  |
| `ruleName` | string | no |  |
| `tier` | { minQuantity, maxQuantity } | no |  |
| `manualOverride` | boolean | yes | True when staff agreed a different unit price than the rule price. |

### OrderLineQuote

Rule outcome for one order line at a given quantity (DEMO calculation; the backend enforces it).

| Field | Type | Required | Notes |
|---|---|---|---|
| `unitPrice` | number | yes |  |
| `basePrice` | number | yes | Regular price. |
| `salePrice` | number | no |  |
| `rulePrice` | number | no | Winning rule's price, when a rule applied (the sale price may still be lower). |
| `priceSource` | `rule` \\| `sale` \\| `regular` | yes |  |
| `ruleName` | string | no |  |
| `tierLabel` | string | no | e.g. "10+" or "5–9". |
| `minQuantity` | number | yes |  |
| `maxQuantity` | number | no |  |
| `quantityError` | string | no |  |

### OrderListItem

An order in a listing, with its derived order type (first / repeat / walk-in).

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `number` | string | yes |  |
| `customerId` | string | no | The registered customer; absent for walk-in orders (see `walkIn`). |
| `walkIn` | [WalkInCustomer](#walkincustomer) | no | Set for walk-in orders created by staff without a customer account. |
| `customerName` | string | yes | Customer company name (or the walk-in buyer's name) at the time of the order (snapshot, for lists and search). |
| `customerEmail` | string | no |  |
| `customerPhone` | string | no |  |
| `status` | [OrderStatus](#orderstatus) | yes |  |
| `statusHistory` | [StatusEvent](#statusevent)[] | yes |  |
| `paymentStatus` | [PaymentStatus](#paymentstatus) | yes |  |
| `payment` | [PaymentDetails](#paymentdetails) | yes |  |
| `items` | [OrderItem](#orderitem)[] | yes |  |
| `billingAddress` | [Address](#address) | no | Absent only for walk-in orders collected at the store. |
| `shippingAddress` | [Address](#address) | no | Absent only for walk-in orders collected at the store. |
| `fulfilment` | `delivery` \\| `pickup` | no | Absent = "delivery". |
| `shipping` | [ShippingCharge](#shippingcharge) | yes |  |
| `taxes` | [TaxLine](#taxline)[] | yes |  |
| `totals` | [OrderTotals](#ordertotals) | yes |  |
| `taxSnapshot` | [OrderTaxSnapshot](#ordertaxsnapshot) | no | Tax settings and matched rates frozen at order time; recalculation uses these, never current rates. |
| `refunds` | [Refund](#refund)[] | yes |  |
| `notes` | [OrderNote](#ordernote)[] | yes |  |
| `coupon` | [OrderCoupon](#ordercoupon) | no | Coupon the customer used. Its amount is shared across the lines' discounts; apart from the staff order discount. |
| `discount` | [OrderDiscount](#orderdiscount) | no | Order-level discount, if any (the amount is `totals.orderDiscount`). |
| `adjustments` | [OrderAdjustment](#orderadjustment)[] | yes |  |
| `invoices` | [Invoice](#invoice)[] | no | Issued invoices, revisions and credit notes, oldest first. Append-only: issued documents are never rewritten. |
| `customerNote` | string | no | Note the customer wrote when ordering. |
| `requestedDeliveryDate` | string | no |  |
| `createdVia` | `admin` \\| `storefront` | yes |  |
| `createdBy` | [Actor](#actor) | no |  |
| `placedAt` | string | yes |  |
| `updatedAt` | string | yes |  |
| `legacyWooId` | number | no |  |
| `orderType` | [OrderType](#ordertype) | yes |  |

### OrderNote

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `type` | [OrderNoteType](#ordernotetype) | yes | admin = staff only; customer = visible to the customer in their account. |
| `body` | string | yes |  |
| `at` | string | yes |  |
| `by` | [Actor](#actor) | yes |  |

### OrderNoteType

Type: `customer` \| `admin`

### OrderStatus

Main delivery flow received → preparing → on_the_way → delivered; cancelled is separate.

Type: `received` \| `preparing` \| `on_the_way` \| `delivered` \| `cancelled`

### OrderTaxSnapshot

Everything needed to recalculate an order's tax later without reading current settings or rates: editing a rate never changes an existing order.

| Field | Type | Required | Notes |
|---|---|---|---|
| `enabled` | boolean | yes |  |
| `pricesIncludeTax` | boolean | yes |  |
| `shippingTaxable` | boolean | yes |  |
| `ratesByClass` | { standard, reduced, exempt } | yes | Rate per class matched for the delivery address; missing = no rate (untaxed). |
| `shippingRate` | [AppliedTaxRate](#appliedtaxrate) | no |  |
| `capturedAt` | string | yes |  |

### OrderTotals

| Field | Type | Required | Notes |
|---|---|---|---|
| `itemsSubtotal` | number | yes |  |
| `discountTotal` | number | yes |  |
| `itemsTotal` | number | yes | Net sales: items after discounts, excl. VAT and shipping. |
| `orderDiscount` | number | no | Order-level discount amount (already included in `discountTotal`); absent when there is none. |
| `shippingTotal` | number | yes |  |
| `taxTotal` | number | yes |  |
| `total` | number | yes |  |
| `refundedTotal` | number | yes |  |
| `netTotal` | number | yes |  |
| `taxIncluded` | boolean | no | true when the order's prices included tax (tax was extracted, not added). |
| `itemsNet` | number | no | Items after discounts excluding tax — net sales. Set on orders with a tax snapshot; absent = itemsTotal. |
| `itemsTax` | number | no | Tax on the items only (excluding shipping tax). |

### OrderType

Derived for listings: "first" = the customer has no earlier non-cancelled order; "repeat" = they do; "walk_in" = no customer account.

Type: `first` \| `repeat` \| `walk_in`

### PageVisibility

Who may see a page. "customers" is a UI rule in the demo; the backend must enforce it.

Type: `public` \| `customers`

### PaymentAvailability

| Field | Type | Required | Notes |
|---|---|---|---|
| `configured` | boolean | yes | Has everything it needs (e.g. bank details; a connected provider for online). |
| `availableAtCheckout` | boolean | yes | Enabled and configured → offered at checkout. |
| `reasons` | string[] | yes | Plain-language reasons when not available. |

### PaymentDetails

| Field | Type | Required | Notes |
|---|---|---|---|
| `method` | [PaymentMethod](#paymentmethod) | yes |  |
| `reference` | string | no | Gateway / bank reference, when known. |
| `paidAt` | string | no |  |
| `amountPaid` | number | no | Amount received and kept (after any refunds), when payment was collected before the order changed. Set the first time a paid order is edited; balance = `totals.netTotal − amountPaid`. Absent = nothing collected yet, so the current total is what's due. |

### PaymentMethod

Type: `invoice` \| `cash_on_delivery` \| `bank_transfer` \| `mobile_wallet`

### PaymentMethodId

Type: `bank_transfer` \| `pay_on_delivery` \| `online`

### PaymentMethodInput

Editable fields. Connection state is never editable from the browser.

| Field | Type | Required | Notes |
|---|---|---|---|
| `enabled` | boolean | yes |  |
| `title` | string | yes |  |
| `description` | string | yes |  |
| `instructions` | string | yes |  |
| `bank` | [BankAccountDetails](#bankaccountdetails) | no |  |

### PaymentMethodListItem

| Field | Type | Required | Notes |
|---|---|---|---|
| `availability` | [PaymentAvailability](#paymentavailability) | yes |  |
| `id` | [PaymentMethodId](#paymentmethodid) | yes |  |
| `enabled` | boolean | yes |  |
| `sortOrder` | number | yes | Display order at checkout (lower first). |
| `title` | string | yes | Customer-facing name, e.g. "Pay on delivery". |
| `description` | string | yes | Short customer-facing line shown next to the option. |
| `instructions` | string | yes | Shown to the customer after choosing the method / on the order confirmation. |
| `bank` | [BankAccountDetails](#bankaccountdetails) | no | Bank Transfer only. |
| `online` | [OnlinePaymentConnection](#onlinepaymentconnection) | no | Online Payment only. |
| `orderPaymentMethod` | `invoice` \\| `cash_on_delivery` \\| `bank_transfer` \\| `mobile_wallet` | no | Order payment method recorded when a customer uses this option (no payment status change). |
| `legacyWooGatewayId` | string | no | Gateway id in the old store (e.g. "cod", "bacs"), for migration. |
| `updatedAt` | string | yes |  |

### PaymentMethodSettings

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | [PaymentMethodId](#paymentmethodid) | yes |  |
| `enabled` | boolean | yes |  |
| `sortOrder` | number | yes | Display order at checkout (lower first). |
| `title` | string | yes | Customer-facing name, e.g. "Pay on delivery". |
| `description` | string | yes | Short customer-facing line shown next to the option. |
| `instructions` | string | yes | Shown to the customer after choosing the method / on the order confirmation. |
| `bank` | [BankAccountDetails](#bankaccountdetails) | no | Bank Transfer only. |
| `online` | [OnlinePaymentConnection](#onlinepaymentconnection) | no | Online Payment only. |
| `orderPaymentMethod` | `invoice` \\| `cash_on_delivery` \\| `bank_transfer` \\| `mobile_wallet` | no | Order payment method recorded when a customer uses this option (no payment status change). |
| `legacyWooGatewayId` | string | no | Gateway id in the old store (e.g. "cod", "bacs"), for migration. |
| `updatedAt` | string | yes |  |

### PaymentStatus

Type: `unpaid` \| `invoiced` \| `paid` \| `partially_refunded` \| `refunded`

### PickupLocation

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `name` | string | yes |  |
| `address` | string | yes |  |
| `hours` | string | no |  |
| `instructions` | string | no |  |
| `fee` | number | yes |  |
| `enabled` | boolean | yes |  |

### PickupLocationInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes |  |
| `enabled` | boolean | yes |  |
| `address` | string | yes |  |
| `fee` | number | yes |  |
| `hours` | string | no |  |
| `instructions` | string | no |  |

### PostcodeLookup

Result of the postal-code lookup. Only a small sample dataset exists today.

Type: { status, postalCode, matches } or { status, postalCode, datasetSize }

### PriceAdjustment

Type: { type, amount } or { type, amount } or { type, percent }

### PriceCandidate

| Field | Type | Required | Notes |
|---|---|---|---|
| `rule` | [PriceRule](#pricerule) | yes |  |
| `outcome` | [CandidateOutcome](#candidateoutcome) | yes |  |
| `reason` | string | yes |  |
| `tier` | [PriceTier](#pricetier) | no |  |
| `unitPrice` | number | no |  |

### PriceResolution

| Field | Type | Required | Notes |
|---|---|---|---|
| `basePrice` | number | yes | Regular catalog price — the base for percentage and amount-off rules. |
| `salePrice` | number | no | Active sale price, when the product has one today. |
| `rulePrice` | number | no | Price the winning rule produced (before comparing with the sale price). |
| `priceSource` | [PriceSource](#pricesource) | yes | Which price the customer pays: the rule price, the sale price (no rule, or lower than the rule) or the regular price. |
| `quantity` | number | yes |  |
| `unitPrice` | number | yes |  |
| `lineTotal` | number | yes |  |
| `rule` | [PriceRule](#pricerule) | no |  |
| `tier` | [PriceTier](#pricetier) | no |  |
| `candidates` | [PriceCandidate](#pricecandidate)[] | yes | Rules whose audience and target match this customer and item, winner first. |
| `explanation` | string | yes |  |

### PriceRule

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `name` | string | yes |  |
| `status` | [RuleStatus](#rulestatus) | yes |  |
| `audience` | [PriceRuleAudience](#priceruleaudience) | yes |  |
| `target` | [RuleTarget](#ruletarget) | yes |  |
| `tiers` | [PriceTier](#pricetier)[] | yes |  |
| `priority` | number | yes | Tie-breaker within the same audience and target level; higher wins. |
| `validFrom` | string | no |  |
| `validTo` | string | no |  |
| `createdAt` | string | yes |  |
| `updatedAt` | string | yes |  |
| `legacyWooId` | number | no |  |

### PriceRuleAudience

Who a price rule applies to. Only approved customers ever get rule prices.

Type: { type } or { type, groupId } or { type, customerId }

### PriceRuleInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes |  |
| `status` | [RuleStatus](#rulestatus) | yes |  |
| `audience` | [PriceRuleAudience](#priceruleaudience) | yes |  |
| `target` | [RuleTarget](#ruletarget) | yes |  |
| `priority` | number | yes | Tie-breaker within the same audience and target level; higher wins. |
| `tiers` | [PriceTier](#pricetier)[] | yes |  |
| `validFrom` | string | no |  |
| `validTo` | string | no |  |

### PriceRuleListItem

Rule with display names and detected overlaps, so lists can search, sort and warn.

| Field | Type | Required | Notes |
|---|---|---|---|
| `audienceName` | string | yes |  |
| `targetName` | string | yes |  |
| `conflicts` | [RuleConflictItem](#ruleconflictitem)[] | yes |  |
| `id` | string | yes |  |
| `name` | string | yes |  |
| `status` | [RuleStatus](#rulestatus) | yes |  |
| `audience` | [PriceRuleAudience](#priceruleaudience) | yes |  |
| `target` | [RuleTarget](#ruletarget) | yes |  |
| `tiers` | [PriceTier](#pricetier)[] | yes |  |
| `priority` | number | yes | Tie-breaker within the same audience and target level; higher wins. |
| `validFrom` | string | no |  |
| `validTo` | string | no |  |
| `createdAt` | string | yes |  |
| `updatedAt` | string | yes |  |
| `legacyWooId` | number | no |  |

### PriceSource

Where the unit price came from.

Type: `rule` \| `sale` \| `regular`

### PriceTier

Quantity band of a rule. Tiers are sorted, non-overlapping and contiguous is not required; `maxQuantity` undefined = "and above" (only allowed on the last tier). A one-tier rule starting at 1 is a plain (non-bulk) price.

| Field | Type | Required | Notes |
|---|---|---|---|
| `minQuantity` | number | yes |  |
| `maxQuantity` | number | no |  |
| `adjustment` | [PriceAdjustment](#priceadjustment) | yes |  |

### Product

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `type` | [ProductType](#producttype) | yes |  |
| `slug` | string | yes |  |
| `sku` | string | yes |  |
| `gtin` | string | no | GTIN / EAN / UPC / barcode. |
| `name` | string | yes |  |
| `shortDescription` | string | yes |  |
| `description` | string | yes |  |
| `status` | [ProductStatus](#productstatus) | yes |  |
| `visibility` | [ProductVisibility](#productvisibility) | yes |  |
| `featured` | boolean | yes |  |
| `categoryIds` | string[] | yes |  |
| `tagIds` | string[] | yes |  |
| `brandIds` | string[] | yes | A product may carry several brands (as on the old store). |
| `images` | [ProductImage](#productimage)[] | yes | First image is the main image; the rest form the gallery. |
| `originCountry` | string | no | Country of origin (ISO 3166-1 alpha-2, e.g. "JP"). Independent of the store location. |
| `unitLabel` | string | yes | Selling unit shown to customers, e.g. "case", "bag", "pack". |
| `basePrice` | number | no | Simple products: admin responses only. |
| `salePrice` | number | no |  |
| `saleFrom` | string | no |  |
| `saleTo` | string | no |  |
| `taxStatus` | [TaxStatus](#taxstatus) | yes |  |
| `taxClass` | [TaxClass](#taxclass) | yes |  |
| `initialStock` | number | no | Imported "initial number in stock" from the old store. Stored as-is; no business logic. |
| `unitOfMeasure` | string | no | Imported "unit of measurement" from the old store. Stored as-is; meaning to be confirmed. |
| `quantityRule` | [QuantityRule](#quantityrule) | yes | Extension point for the future Rules module; not edited in the product form. |
| `isVariableWeight` | boolean | yes | Priced per kg and adjusted after packing (e.g. fresh meat). Final amount can change. |
| `attributes` | [ProductAttribute](#productattribute)[] | yes |  |
| `defaultAttributes` | map of string | yes | Pre-selected option per variation attribute on the product page. |
| `variations` | [ProductVariation](#productvariation)[] | yes |  |
| `upsellIds` | string[] | yes |  |
| `crossSellIds` | string[] | yes |  |
| `purchaseNote` | string | no | Shown to the customer after purchase. |
| `menuOrder` | number | yes | Manual sort position (lower first). |
| `reviewsEnabled` | boolean | yes |  |
| `updatedAt` | string | yes |  |
| `legacyWooId` | number | no |  |
| `manageStock` | boolean | yes | Track a quantity (true) or set `stock.status` by hand (false). |
| `stock` | [StockInfo](#stockinfo) | yes | Current stock; `status` is derived by the backend when the quantity is tracked. |
| `backorders` | [BackorderPolicy](#backorderpolicy) | yes |  |
| `lowStockThreshold` | number | no | Undefined = the store default threshold (a backend setting). |
| `soldIndividually` | boolean | yes | Limit to one unit per order. |
| `weight` | [Weight](#weight) | yes |  |
| `dimensions` | [Dimensions](#dimensions) | no |  |
| `shippingClassId` | string | no |  |

### ProductAttribute

An attribute on one product: a store-wide attribute or a product-specific (custom) one.

| Field | Type | Required | Notes |
|---|---|---|---|
| `attributeId` | string | no | Set for store-wide attributes; omitted for product-specific ones. |
| `name` | string | yes |  |
| `values` | string[] | yes | Value names used on this product. |
| `visible` | boolean | yes | Shown in the product page's "Additional information". |
| `variation` | boolean | yes | Used to create variations (variable products only). |

### ProductImage

| Field | Type | Required | Notes |
|---|---|---|---|
| `src` | string | yes | Absolute URL or path under /public. Never a base64 data URI. |
| `alt` | string | yes |  |
| `width` | number | yes |  |
| `height` | number | yes |  |

### ProductInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | [ProductType](#producttype) | yes |  |
| `name` | string | yes |  |
| `slug` | string | yes |  |
| `sku` | string | yes |  |
| `gtin` | string | no |  |
| `shortDescription` | string | yes |  |
| `description` | string | yes |  |
| `status` | [ProductStatus](#productstatus) | yes |  |
| `visibility` | [ProductVisibility](#productvisibility) | yes |  |
| `featured` | boolean | yes |  |
| `categoryIds` | string[] | yes |  |
| `tags` | string[] | yes | Tag names; unknown names create new tags. |
| `brandIds` | string[] | yes |  |
| `images` | [ProductImage](#productimage)[] | yes |  |
| `originCountry` | string | no |  |
| `unitLabel` | string | yes |  |
| `basePrice` | number | no |  |
| `salePrice` | number | no |  |
| `saleFrom` | string | no |  |
| `saleTo` | string | no |  |
| `taxStatus` | [TaxStatus](#taxstatus) | yes |  |
| `taxClass` | [TaxClass](#taxclass) | yes |  |
| `manageStock` | boolean | yes |  |
| `stockQuantity` | number | no |  |
| `stockStatus` | [StockStatus](#stockstatus) | yes |  |
| `backorders` | [BackorderPolicy](#backorderpolicy) | yes |  |
| `lowStockThreshold` | number | no |  |
| `soldIndividually` | boolean | yes |  |
| `initialStock` | number | no |  |
| `unitOfMeasure` | string | no |  |
| `weight` | [Weight](#weight) | yes |  |
| `dimensions` | [Dimensions](#dimensions) | no |  |
| `shippingClassId` | string | no |  |
| `isVariableWeight` | boolean | yes |  |
| `attributes` | [ProductAttribute](#productattribute)[] | yes |  |
| `defaultAttributes` | map of string | yes |  |
| `variations` | [VariationInput](#variationinput)[] | yes |  |
| `upsellIds` | string[] | yes |  |
| `crossSellIds` | string[] | yes |  |
| `purchaseNote` | string | no |  |
| `menuOrder` | number | yes |  |
| `reviewsEnabled` | boolean | yes |  |

### ProductPick

Minimal product reference for pickers (linked products, category assignment).

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `name` | string | yes |  |
| `sku` | string | yes |  |
| `type` | [ProductType](#producttype) | yes |  |
| `status` | [ProductStatus](#productstatus) | yes |  |
| `image` | [ProductImage](#productimage) | no |  |

### ProductStatus

Type: `draft` \| `published` \| `archived`

### ProductSummary

Lightweight shape for public listings; keeps list payloads small.

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes |  |
| `id` | string | yes |  |
| `slug` | string | yes |  |
| `sku` | string | yes |  |
| `shortDescription` | string | yes |  |
| `unitLabel` | string | yes | Selling unit shown to customers, e.g. "case", "bag", "pack". |
| `basePrice` | number | no | Simple products: admin responses only. |
| `stock` | [StockInfo](#stockinfo) | yes | Current stock; `status` is derived by the backend when the quantity is tracked. |
| `weight` | [Weight](#weight) | yes |  |
| `isVariableWeight` | boolean | yes | Priced per kg and adjusted after packing (e.g. fresh meat). Final amount can change. |
| `categoryIds` | string[] | yes |  |
| `image` | [ProductImage](#productimage) | no |  |
| `hasVariations` | boolean | yes |  |

### ProductType

Simple = one SKU/price/stock. Variable = options (e.g. size) with their own SKU/price/stock.

Type: `simple` \| `variable`

### ProductVariation

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `sku` | string | yes |  |
| `gtin` | string | no |  |
| `attributes` | map of string | yes | One value per variation attribute, e.g. { Size: "5 kg" }. |
| `status` | [VariationStatus](#variationstatus) | yes |  |
| `basePrice` | number | no | Admin responses only — customers get prices from the pricing endpoint. |
| `salePrice` | number | no |  |
| `saleFrom` | string | no | Optional sale schedule (calendar dates, store time zone). |
| `saleTo` | string | no |  |
| `image` | [ProductImage](#productimage) | no |  |
| `gallery` | [ProductImage](#productimage)[] | yes |  |
| `description` | string | no |  |
| `stockMode` | [VariationStockMode](#variationstockmode) | yes |  |
| `stock` | [StockInfo](#stockinfo) | yes | Effective stock (own, or the parent's when `stockMode` is "parent"). |
| `backorders` | `no` \\| `notify` \\| `allow` | no |  |
| `weight` | [Weight](#weight) | no |  |
| `dimensions` | [Dimensions](#dimensions) | no |  |
| `shippingClassId` | string | no |  |
| `taxClass` | `standard` \\| `reduced` \\| `exempt` | no |  |
| `quantityRule` | [QuantityRule](#quantityrule) | no |  |
| `legacyWooId` | number | no |  |

### ProductVisibility

Where a published product appears: everywhere, only when browsing the catalog, only in search results, or nowhere (reachable by direct link only).

Type: `visible` \| `catalog` \| `search` \| `hidden`

### QuantityLimitRule

Per-line minimum/maximum quantity. Category rules apply to each matching line, not the category total.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `name` | string | yes |  |
| `status` | [RuleStatus](#rulestatus) | yes |  |
| `target` | [RuleTarget](#ruletarget) | yes |  |
| `minQuantity` | number | no |  |
| `maxQuantity` | number | no |  |
| `priority` | number | yes | Tie-breaker within the same target level; higher wins. |
| `createdAt` | string | yes |  |
| `updatedAt` | string | yes |  |
| `legacyWooId` | number | no |  |

### QuantityLimitRuleInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes |  |
| `status` | [RuleStatus](#rulestatus) | yes |  |
| `minQuantity` | number | no |  |
| `maxQuantity` | number | no |  |
| `target` | [RuleTarget](#ruletarget) | yes |  |
| `priority` | number | yes | Tie-breaker within the same target level; higher wins. |

### QuantityLimits

| Field | Type | Required | Notes |
|---|---|---|---|
| `min` | number | yes |  |
| `max` | number | no |  |
| `rule` | [QuantityLimitRule](#quantitylimitrule) | no |  |
| `candidates` | { rule, outcome, reason }[] | yes |  |
| `explanation` | string | yes |  |

### QuantityRule

Per-product ordering settings. `step` (pack multiple) is still a product setting. `min`/`max` are LEGACY: per-line limits now come from quantity rules (QuantityLimitRule, resolved by src/lib/pricing/engine.ts); the seeded values were migrated there.

| Field | Type | Required | Notes |
|---|---|---|---|
| `min` | number | yes |  |
| `max` | number | no |  |
| `step` | number | yes |  |

### QuantityRuleListItem

| Field | Type | Required | Notes |
|---|---|---|---|
| `targetName` | string | yes |  |
| `conflicts` | [RuleConflictItem](#ruleconflictitem)[] | yes |  |
| `id` | string | yes |  |
| `name` | string | yes |  |
| `status` | [RuleStatus](#rulestatus) | yes |  |
| `target` | [RuleTarget](#ruletarget) | yes |  |
| `minQuantity` | number | no |  |
| `maxQuantity` | number | no |  |
| `priority` | number | yes | Tie-breaker within the same target level; higher wins. |
| `createdAt` | string | yes |  |
| `updatedAt` | string | yes |  |
| `legacyWooId` | number | no |  |

### QuickOrderLine

One orderable option (a simple product or one active variation) on the quick order sheet, priced for the customer at its minimum quantity. `error` = why it can't be ordered now (out of stock, no price…). Prices are absent for viewers who may not see wholesale prices.

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes |  |
| `image` | [ProductImage](#productimage) | no |  |
| `id` | string | yes | `${productId}:${variationId ?? ""}` — one line per product option. |
| `productId` | string | yes |  |
| `variationId` | string | no |  |
| `slug` | string | yes |  |
| `sku` | string | yes |  |
| `unitLabel` | string | yes |  |
| `minQuantity` | number | yes |  |
| `maxQuantity` | number | no |  |
| `variationLabel` | string | no |  |
| `pricedByWeight` | boolean | yes |  |
| `stockStatus` | [StockStatus](#stockstatus) | yes |  |
| `unitPrice` | number | no |  |
| `priceNote` | string | no | e.g. "Your price", "Sale price", a tier label. |
| `step` | number | yes |  |
| `error` | string | no | Set when this line can't be ordered as it is (quantity rule, stock, no price, removed product). |

### QuickOrderPage

A page of the quick order sheet. Pages count products; a variable product contributes one line per option.

| Field | Type | Required | Notes |
|---|---|---|---|
| `lines` | [QuickOrderLine](#quickorderline)[] | yes |  |
| `page` | number | yes |  |
| `totalPages` | number | yes |  |
| `totalProducts` | number | yes |  |

### Quotation

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `number` | string | yes |  |
| `customerId` | string | yes |  |
| `customerName` | string | yes |  |
| `status` | [QuotationStatus](#quotationstatus) | yes |  |
| `items` | [QuotationItem](#quotationitem)[] | yes |  |
| `customerNote` | string | no |  |
| `staffNote` | string | no | Shown to the customer with the quote. |
| `validUntil` | string | no | YYYY-MM-DD. After this the customer can no longer accept. |
| `orderId` | string | no | The order created when the customer accepted. |
| `orderNumber` | string | no |  |
| `history` | [QuotationEvent](#quotationevent)[] | yes |  |
| `createdAt` | string | yes |  |
| `updatedAt` | string | yes |  |

### QuotationEvent

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `status` | [QuotationStatus](#quotationstatus) | yes |  |
| `at` | string | yes |  |
| `byName` | string | yes |  |
| `note` | string | no |  |

### QuotationItem

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `productId` | string | yes |  |
| `variationId` | string | no |  |
| `name` | string | yes |  |
| `sku` | string | yes |  |
| `optionLabel` | string | no |  |
| `quantity` | number | yes |  |
| `quotedUnitPrice` | number | no | Set by staff when they send the quote. |

### QuotationQuoteInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `prices` | map of number | yes |  |
| `validUntil` | string | yes |  |
| `staffNote` | string | no |  |

### QuotationRequestInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `items` | [SavedListLineInput](#savedlistlineinput)[] | yes |  |
| `customerNote` | string | no |  |

### QuotationStatus

Type: `expired` \| `requested` \| `quoted` \| `accepted` \| `rejected` \| `declined`

### RankingItem

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `name` | string | yes |  |
| `detail` | string | no | Secondary text, e.g. "420 units" or a location. |
| `revenue` | number | yes |  |
| `previousRevenue` | number | no |  |

### RateTier

Rate tier: applies from `from` (inclusive) up to the next tier's `from` (exclusive). Tiers are strictly increasing and the first starts at 0, so there are no gaps or overlaps. Weight tiers use grams; subtotal tiers use the store currency.

| Field | Type | Required | Notes |
|---|---|---|---|
| `from` | number | yes |  |
| `cost` | number | yes |  |

### RecentOrderSummary

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `number` | string | yes |  |
| `customerName` | string | yes |  |
| `location` | string | yes |  |
| `total` | number | yes |  |
| `status` | [OrderStatus](#orderstatus) | yes |  |
| `placedAt` | string | yes |  |

### RecordPaymentInput

Admin records that payment was received outside the site (bank transfer, cash on delivery). Never charges anyone.

| Field | Type | Required | Notes |
|---|---|---|---|
| `reference` | string | no |  |

### Refund

A recorded refund. Processing happens in the payment backend; this only stores what happened. "order" refunds (items, shipping or a goodwill amount) lower the order value (`totals.refundedTotal`); "overpayment" refunds only return money paid above the current total and leave the order value as it is.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `method` | `manual` \\| `gateway` | no | Absent = "manual". |
| `kind` | `order` \\| `overpayment` | no | Absent = "order". |
| `amount` | number | yes |  |
| `reason` | string | yes |  |
| `at` | string | yes |  |
| `by` | [Actor](#actor) | yes |  |
| `status` | `recorded` \\| `processed` | yes | "recorded" = noted here only (demo, no money moved); "processed" = confirmed by the payment provider (backend). |
| `lines` | [RefundLine](#refundline)[] | no | Item quantities and amounts this refund covers. |
| `shipping` | number | no | Shipping amount included in `amount`. |
| `restock` | [RefundRestock](#refundrestock)[] | no | Stock returned to the catalog for refunded quantities. |

### RefundInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | [RefundKind](#refundkind) | yes |  |
| `method` | `manual` \\| `gateway` | no | Absent = "manual". |
| `lines` | { orderItemId, quantity, amount }[] | yes |  |
| `shipping` | number | yes |  |
| `other` | number | yes | An amount not tied to an item or shipping (e.g. goodwill, or the overpaid amount). |
| `reason` | string | yes |  |
| `restock` | boolean | yes | Return refunded quantities to stock (counted stock only). |

### RefundKind

Type: `order` \| `overpayment`

### RefundLine

| Field | Type | Required | Notes |
|---|---|---|---|
| `orderItemId` | string | yes |  |
| `name` | string | yes | Item name at the time (readable history). |
| `quantity` | number | yes | Units refunded (0 = an amount only, e.g. a price correction). |
| `amount` | number | yes |  |

### RefundRestock

| Field | Type | Required | Notes |
|---|---|---|---|
| `orderItemId` | string | yes |  |
| `quantity` | number | yes |  |
| `result` | `skipped` \\| `restocked` | yes | "skipped": stock is managed by status, or the product/option no longer exists. |
| `note` | string | no |  |

### RegistrationInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `companyName` | string | yes |  |
| `businessType` | string | yes |  |
| `contactName` | string | yes |  |
| `email` | string | yes |  |
| `phone` | string | yes |  |
| `tradeLicenseNumber` | string | no |  |
| `address` | { prefecture, city, area, postalCode, addressLine1 } | yes |  |
| `message` | string | no |  |
| `acceptTerms` | boolean | yes |  |
| `documents` | [DocumentUpload](#documentupload)[] | no | Optional copies: identity document (front / back) and business license. |

### Reminder

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `type` | [ReminderType](#remindertype) | yes |  |
| `channel` | [ReminderChannel](#reminderchannel) | yes |  |
| `customerId` | string | no | Targets one customer, a whole delivery route, or everyone when both are omitted. |
| `deliveryRouteId` | string | no |  |
| `schedule` | string | yes | Human-readable schedule until a scheduling format is agreed with the backend. |
| `message` | string | yes |  |
| `active` | boolean | yes |  |
| `lastSentAt` | string | no |  |

### ReminderCampaign

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `name` | string | yes |  |
| `deliveryRouteId` | string | yes |  |
| `leadDays` | number | yes | Days before the delivery date. |
| `sendTime` | string | yes | HH:mm in store time. |
| `enabled` | boolean | yes |  |
| `templateWithOrder` | [EmailTemplateKey](#emailtemplatekey) | yes | Group A: customers with an order for that date. |
| `templateWithoutOrder` | [EmailTemplateKey](#emailtemplatekey) | yes | Group B: customers without one. |
| `createdAt` | string | yes |  |
| `updatedAt` | string | yes |  |

### ReminderCampaignInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes |  |
| `enabled` | boolean | yes |  |
| `deliveryRouteId` | string | yes |  |
| `leadDays` | number | yes | Days before the delivery date. |
| `sendTime` | string | yes | HH:mm in store time. |
| `templateWithOrder` | [EmailTemplateKey](#emailtemplatekey) | yes | Group A: customers with an order for that date. |
| `templateWithoutOrder` | [EmailTemplateKey](#emailtemplatekey) | yes | Group B: customers without one. |

### ReminderChannel

Type: `email` \| `sms` \| `whatsapp`

### ReminderPreview

| Field | Type | Required | Notes |
|---|---|---|---|
| `campaign` | [ReminderCampaign](#remindercampaign) | yes |  |
| `route` | [DeliveryRoute](#deliveryroute) | yes |  |
| `next` | [DeliveryDate](#deliverydate) or null | yes |  |
| `sendOn` | string or null | yes | YYYY-MM-DD: when this reminder would go out. |
| `segments` | [Segments](#segments) | yes |  |
| `emails` | { withOrder, withoutOrder } or null | yes |  |

### ReminderType

Type: `reorder` \| `order_cutoff` \| `payment_due`

### ReportData

| Field | Type | Required | Notes |
|---|---|---|---|
| `summary` | [ReportSummary](#reportsummary) | yes |  |
| `topProducts` | [ReportRow](#reportrow)[] | yes |  |
| `categories` | [ReportRow](#reportrow)[] | yes |  |
| `topCustomers` | [ReportRow](#reportrow)[] | yes |  |
| `groups` | [ReportRow](#reportrow)[] | yes |  |
| `locations` | [ReportRow](#reportrow)[] | yes |  |
| `statuses` | { status, count }[] | yes |  |
| `monthly` | [ReportRow](#reportrow)[] | yes |  |

### ReportRow

| Field | Type | Required | Notes |
|---|---|---|---|
| `label` | string | yes |  |
| `orders` | number | no |  |
| `units` | number | no |  |
| `sales` | number | yes |  |

### ReportSummary

| Field | Type | Required | Notes |
|---|---|---|---|
| `totalSales` | number | yes |  |
| `netSales` | number | yes |  |
| `orders` | number | yes |  |
| `averageOrderValue` | number | yes |  |
| `customers` | number | yes |  |
| `newCustomers` | number | yes |  |
| `returningCustomers` | number | yes |  |
| `repeatOrders` | number | yes |  |
| `discounts` | number | yes |  |
| `couponDiscounts` | number | yes |  |
| `refunds` | number | yes |  |
| `shipping` | number | yes |  |
| `tax` | number | yes |  |

### ResolvedMenuItem

A menu item ready to render. Links to pages that are not live are left out.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `label` | string | yes |  |
| `href` | string | yes |  |
| `children` | [ResolvedMenuItem](#resolvedmenuitem)[] | yes |  |

### ResolvedPrice

Price for one customer / product option / quantity, with the rule that produced it.

| Field | Type | Required | Notes |
|---|---|---|---|
| `productId` | string | yes |  |
| `variationId` | string | no |  |
| `basePrice` | number | yes | Regular price. |
| `salePrice` | number | no | Active sale price, if any (the engine uses the lower of this and the rule price). |
| `unitPrice` | number | yes |  |
| `priceSource` | `rule` \\| `sale` \\| `regular` | yes |  |
| `appliedRuleId` | string | no |  |
| `appliedRuleName` | string | no |  |
| `appliedTier` | { minQuantity, maxQuantity } | no |  |

### Role

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `name` | string | yes |  |
| `description` | string | yes |  |
| `system` | boolean | yes | Built-in roles can't be deleted. |
| `capabilities` | string[] | yes | "module.action", see src/lib/auth/capabilities.ts. |
| `updatedAt` | string | yes |  |

### RoleInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `description` | string | yes |  |
| `name` | string | yes |  |
| `capabilities` | string[] | yes | "module.action", see src/lib/auth/capabilities.ts. |

### RuleAction

Type: { type, amount } or { type } or { type, amount, label } or { type, basis, tiers } or { type, methodType }

### RuleCondition

| Field | Type | Required | Notes |
|---|---|---|---|
| `field` | [ConditionField](#conditionfield) | yes |  |
| `op` | [ConditionOp](#conditionop) | yes |  |
| `value` | number or string[] | yes | Number fields: a number (weight in kg). List fields: the values to compare. |

### RuleConflictItem

A detected overlap with another rule, with its name for display.

| Field | Type | Required | Notes |
|---|---|---|---|
| `otherName` | string | yes |  |
| `ruleId` | string | yes |  |
| `otherId` | string | yes |  |
| `kind` | `conflict` \\| `overlap` | yes | conflict = same priority (decided by age); overlap = decided by priority. |

### RuledQuote

| Field | Type | Required | Notes |
|---|---|---|---|
| `charge` | [ChargeBreakdown](#chargebreakdown) | no | The selected method's charge in detail. |
| `rulesApplied` | string[] | yes | Rules that matched, in the order they ran. |
| `trace` | string[] | yes | One plain sentence per decision. |
| `match` | [ZoneMatch](#zonematch) | yes |  |
| `metrics` | [CartMetrics](#cartmetrics) | yes |  |
| `options` | [MethodQuote](#methodquote)[] | yes | Every method of the matched zone, in listed order. |
| `selected` | [MethodQuote](#methodquote) | no | Suggested delivery method (cheapest available, not pickup). |
| `explanation` | string | yes |  |

### RuleProductOption

One purchasable option for rule pickers.

| Field | Type | Required | Notes |
|---|---|---|---|
| `productId` | string | yes |  |
| `name` | string | yes |  |
| `unitLabel` | string | yes |  |
| `variations` | { id, label, sku, basePrice, status }[] | yes |  |
| `basePrice` | number | no |  |

### RuleStatus

Type: `active` \| `disabled`

### RuleTarget

What a rule applies to. Category rules include subcategories.

Type: { type } or { type, categoryIds } or { type, productIds } or { type, productId, variationIds }

### RuleTestQuery

| Field | Type | Required | Notes |
|---|---|---|---|
| `customerId` | string | no |  |
| `productId` | string | yes |  |
| `variationId` | string | no |  |
| `quantity` | number | yes |  |

### RuleTestResult

Everything the "Test rules" panel shows. DEMO calculation — the backend enforces the real one.

| Field | Type | Required | Notes |
|---|---|---|---|
| `customer` | { id, companyName, status, groupName } | no |  |
| `product` | { id, name, unitLabel, variationLabel } | yes |  |
| `price` | [PriceResolution](#priceresolution) | no | Undefined when no customer was given (quantity limits only). |
| `limits` | [QuantityLimits](#quantitylimits) | yes |  |
| `quantityError` | string | no |  |

### SavedList

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `customerId` | string | yes |  |
| `name` | string | yes |  |
| `items` | [SavedListItem](#savedlistitem)[] | yes |  |
| `createdAt` | string | yes |  |
| `updatedAt` | string | yes |  |

### SavedListDetail

| Field | Type | Required | Notes |
|---|---|---|---|
| `updatedAt` | string | yes |  |
| `name` | string | yes |  |
| `id` | string | yes |  |
| `createdAt` | string | yes |  |
| `customerId` | string | yes |  |
| `lines` | [SavedListLine](#savedlistline)[] | yes |  |

### SavedListItem

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `productId` | string | yes |  |
| `variationId` | string | no |  |
| `quantity` | number | yes |  |

### SavedListLine

A list line with live product details and this customer's current price.

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes |  |
| `sku` | string | yes |  |
| `optionLabel` | string | no |  |
| `unitLabel` | string | yes |  |
| `unitPrice` | number | no |  |
| `unavailable` | string | no | Why it can't be ordered right now. |
| `id` | string | yes |  |
| `productId` | string | yes |  |
| `variationId` | string | no |  |
| `quantity` | number | yes |  |

### SavedListLineInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `productId` | string | yes |  |
| `variationId` | string | no |  |
| `quantity` | number | yes |  |

### SegmentExclusion

| Field | Type | Required | Notes |
|---|---|---|---|
| `customerId` | string | yes |  |
| `name` | string | yes |  |
| `reason` | string | yes |  |

### SegmentRecipient

| Field | Type | Required | Notes |
|---|---|---|---|
| `customerId` | string | yes |  |
| `name` | string | yes |  |
| `email` | string | yes |  |
| `orderNumbers` | string[] | yes |  |

### Segments

| Field | Type | Required | Notes |
|---|---|---|---|
| `withOrder` | [SegmentRecipient](#segmentrecipient)[] | yes |  |
| `withoutOrder` | [SegmentRecipient](#segmentrecipient)[] | yes |  |
| `excluded` | [SegmentExclusion](#segmentexclusion)[] | yes |  |

### SeoFields

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | no | Falls back to the title. |
| `description` | string | no | Falls back to the excerpt. |
| `canonicalUrl` | string | no |  |
| `ogImage` | string | no | Social sharing image; falls back to the featured image. |

### SeriesPoint

| Field | Type | Required | Notes |
|---|---|---|---|
| `date` | string | yes | First day of the bucket. |
| `value` | number | yes |  |

### ShippingAddress

Address fields used for matching (customer and order addresses fit this shape).

| Field | Type | Required | Notes |
|---|---|---|---|
| `prefecture` | string | yes |  |
| `city` | string | yes |  |
| `postalCode` | string | no |  |

### ShippingCartLine

Cart line for a shipping quote.

| Field | Type | Required | Notes |
|---|---|---|---|
| `productId` | string | yes |  |
| `variationId` | string | no |  |
| `quantity` | number | yes |  |
| `unitPrice` | number | no | Agreed/rule unit price; when omitted the repository uses the customer or catalog price. |
| `discount` | number | no | Line discount (store currency); the shipping subtotal is after line discounts. |

### ShippingCharge

| Field | Type | Required | Notes |
|---|---|---|---|
| `label` | string | yes |  |
| `amount` | number | yes | The amount saved with the order. Never recalculated when shipping rules change. |
| `taxClass` | [TaxClass](#taxclass) | yes |  |
| `deliveryRouteId` | string | no |  |
| `decision` | [ShippingDecision](#shippingdecision) | no | Admin-created orders: whether staff used the suggested charge or agreed a manual one. |

### ShippingClass

References future shipping-rate settings; rates are not calculated in the frontend.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `name` | string | yes |  |
| `description` | string | no |  |
| `surcharge` | number | no | Added to the shipping charge when the cart has this class. |
| `surchargePer` | `order` \\| `unit` | no |  |

### ShippingClassInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `description` | string | no |  |
| `name` | string | yes |  |
| `surcharge` | number | no |  |
| `surchargePer` | `order` \\| `unit` | no |  |

### ShippingClassUsage

A shipping class with its fee and how many products use it.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `name` | string | yes |  |
| `description` | string | no |  |
| `surcharge` | number | no |  |
| `surchargePer` | `order` \\| `unit` | no |  |
| `products` | number | yes |  |

### ShippingDecision

How an admin-created order's shipping amount was decided (kept with the order).

| Field | Type | Required | Notes |
|---|---|---|---|
| `mode` | `suggested` \\| `manual` | yes |  |
| `suggestedAmount` | number | no | What the shipping rules suggested at the time (may be absent if nothing was available). |
| `zoneId` | string | no |  |
| `zoneName` | string | no |  |
| `methodId` | string | no |  |
| `methodName` | string | no |  |
| `reason` | string | no | Required for manual amounts. |

### ShippingGeneralSettings

| Field | Type | Required | Notes |
|---|---|---|---|
| `hidePaidWhenFree` | boolean | yes | When a delivery method is free, hide paid delivery methods. Pickup stays available. |
| `unavailableMessage` | string | yes | Shown at checkout when no method is available. |

### ShippingMethod

Type: { id, name, enabled, type, cost, classAdjustments } or { id, name, enabled, type, tiers, classAdjustments } or { id, name, enabled, type, tiers, classAdjustments } or { id, name, enabled, type, minSubtotal } or { id, name, enabled, type, cost, instructions, locationId }

### ShippingQuoteInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `address` | [ShippingAddress](#shippingaddress) | yes |  |
| `items` | [ShippingCartLine](#shippingcartline)[] | yes |  |
| `couponCode` | string | no |  |
| `customerGroupId` | string | no | Tester only: use this group instead of the customer's. |
| `grams` | number | no | Tester only: use these numbers instead of the cart's. |
| `subtotal` | number | no |  |
| `customerId` | string | no | Prices lines with this customer's rule/sale price when a line has no unitPrice. |

### ShippingQuoteLine

A cart line resolved for shipping: weight/class from the variation when it overrides the product.

| Field | Type | Required | Notes |
|---|---|---|---|
| `sku` | string | yes |  |
| `variationLabel` | string | no |  |
| `weightFrom` | `variation` \\| `product` | yes |  |
| `priceSource` | `rule` \\| `sale` \\| `regular` \\| `given` | yes |  |
| `productId` | string | yes |  |
| `variationId` | string | no |  |
| `name` | string | yes |  |
| `quantity` | number | yes |  |
| `unitPrice` | number | yes |  |
| `discount` | number | no | Line discount in the store currency (subtracted from the subtotal). |
| `unitGrams` | number | yes |  |
| `shippingClassId` | string | no |  |

### ShippingQuoteResult

DEMO calculation with sample rates; the backend must repeat it at cart, checkout and order creation.

| Field | Type | Required | Notes |
|---|---|---|---|
| `quote` | [RuledQuote](#ruledquote) | yes |  |
| `lines` | [ShippingQuoteLine](#shippingquoteline)[] | yes |  |
| `skipped` | string[] | yes | Lines that could not be resolved (unknown product/variation or no price). |

### ShippingRule

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `name` | string | yes |  |
| `enabled` | boolean | yes |  |
| `priority` | number | yes | Lower runs first. |
| `match` | `all` \\| `any` | yes | "all" = AND, "any" = OR. |
| `conditions` | [RuleCondition](#rulecondition)[] | yes |  |
| `action` | [RuleAction](#ruleaction) | yes |  |
| `zoneIds` | string[] | yes | Empty = every zone. |

### ShippingRuleInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes |  |
| `enabled` | boolean | yes |  |
| `priority` | number | yes | Lower runs first. |
| `match` | `all` \\| `any` | yes | "all" = AND, "any" = OR. |
| `conditions` | [RuleCondition](#rulecondition)[] | yes |  |
| `action` | [RuleAction](#ruleaction) | yes |  |
| `zoneIds` | string[] | yes | Empty = every zone. |

### ShippingZone

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `name` | string | yes |  |
| `locations` | [ZoneLocation](#zonelocation)[] | yes | Empty for the fallback zone. |
| `isFallback` | boolean | yes | Exactly one zone is the fallback: it matches any address no other zone matches. |
| `methods` | [ShippingMethod](#shippingmethod)[] | yes |  |
| `createdAt` | string | yes |  |
| `updatedAt` | string | yes |  |
| `legacyWooId` | number | no |  |

### ShippingZoneInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes |  |
| `locations` | [ZoneLocation](#zonelocation)[] | yes | Empty for the fallback zone. |
| `methods` | [ShippingMethod](#shippingmethod)[] | yes |  |

### ShippingZoneListItem

| Field | Type | Required | Notes |
|---|---|---|---|
| `locationSummary` | string | yes |  |
| `id` | string | yes |  |
| `name` | string | yes |  |
| `locations` | [ZoneLocation](#zonelocation)[] | yes | Empty for the fallback zone. |
| `isFallback` | boolean | yes | Exactly one zone is the fallback: it matches any address no other zone matches. |
| `methods` | [ShippingMethod](#shippingmethod)[] | yes |  |
| `createdAt` | string | yes |  |
| `updatedAt` | string | yes |  |
| `legacyWooId` | number | no |  |

### SiteContent

| Field | Type | Required | Notes |
|---|---|---|---|
| `topBar` | string | yes |  |
| `sections` | [HomeSection](#homesection)[] | yes |  |
| `about` | [AboutContent](#aboutcontent) | yes |  |
| `updatedAt` | string | yes |  |

### SiteContentInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `topBar` | string | yes |  |
| `sections` | [HomeSection](#homesection)[] | yes |  |
| `about` | [AboutContent](#aboutcontent) | yes |  |

### SiteImage

| Field | Type | Required | Notes |
|---|---|---|---|
| `src` | string | yes |  |
| `alt` | string | yes |  |
| `width` | number | yes |  |
| `height` | number | yes |  |

### SocialLink

| Field | Type | Required | Notes |
|---|---|---|---|
| `network` | [SocialNetwork](#socialnetwork) | yes |  |
| `url` | string | yes |  |

### SocialNetwork

Type: `facebook` \| `instagram` \| `x` \| `linkedin` \| `youtube` \| `tiktok` \| `line` \| `website`

### StaffInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes |  |
| `email` | string | yes |  |
| `roleId` | string | yes |  |
| `active` | boolean | yes |  |
| `invite` | boolean | no | New staff only: invite them to set a password. |

### StaffMember

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `name` | string | yes |  |
| `email` | string | yes |  |
| `roleId` | string | yes |  |
| `active` | boolean | yes |  |
| `invitedAt` | string | no | When an invitation was asked for. DEMO: nothing is sent; the backend sends it and clears this on acceptance. |
| `createdAt` | string | yes |  |

### StatusEvent

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `status` | [OrderStatus](#orderstatus) | yes |  |
| `at` | string | yes |  |
| `by` | [Actor](#actor) | yes |  |
| `note` | string | no | e.g. the cancellation reason. |

### StockChange

Stock changes allowed from an order page: a status for status-managed stock, a count for counted stock, or units added back (`delta`, counted stock only — e.g. a refund restock).

Type: { status } or { quantity } or { delta }

### StockChangeContext

Who/what changed stock, for the stock movement history.

| Field | Type | Required | Notes |
|---|---|---|---|
| `source` | [StockMovementSource](#stockmovementsource) | yes |  |
| `byName` | string | yes |  |
| `orderId` | string | no |  |
| `orderNumber` | string | no |  |
| `note` | string | no |  |

### StockInfo

| Field | Type | Required | Notes |
|---|---|---|---|
| `status` | [StockStatus](#stockstatus) | yes |  |
| `quantity` | number | no | Units available; omitted when not tracked or not exposed. |

### StockMovement

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `productId` | string | yes |  |
| `variationId` | string | no |  |
| `variationLabel` | string | no | e.g. "Size: 5 kg"; absent for the product itself. |
| `sku` | string | yes |  |
| `source` | [StockMovementSource](#stockmovementsource) | yes |  |
| `before` | [StockInfo](#stockinfo) | yes |  |
| `after` | [StockInfo](#stockinfo) | yes |  |
| `change` | number | no | Units added (positive) or removed (negative), when stock is counted. |
| `orderId` | string | no |  |
| `orderNumber` | string | no |  |
| `note` | string | no |  |
| `at` | string | yes |  |
| `byName` | string | yes |  |

### StockMovementSource

Where a stock change came from.

Type: `product_edit` \| `order_page` \| `refund_restock` \| `inventory_adjust`

### StockStatus

Type: `low_stock` \| `in_stock` \| `out_of_stock` \| `backorder`

### StoreAddress

Where the store ships from. Separate from a product's country of origin.

| Field | Type | Required | Notes |
|---|---|---|---|
| `addressLine1` | string | yes |  |
| `addressLine2` | string | no |  |
| `area` | string | no | Town (町域); optional. |
| `city` | string | yes |  |
| `prefecture` | string | yes |  |
| `postalCode` | string | yes |  |
| `country` | string | yes | ISO 3166-1 alpha-2; Japan in this version. |

### StoreSettings

Read-only view of the company settings for shipping, tax and invoices. Edited through `repositories.company`.

| Field | Type | Required | Notes |
|---|---|---|---|
| `storeName` | string | yes |  |
| `email` | string | no |  |
| `phone` | string | no |  |
| `address` | [StoreAddress](#storeaddress) | yes |  |
| `currency` | string | yes |  |
| `timeZone` | string | yes |  |
| `weightUnit` | `kg` \\| `g` | yes | Default units for new products and how weights are displayed. |
| `dimensionUnit` | [DimensionUnit](#dimensionunit) | yes |  |
| `updatedAt` | string | yes |  |

### SymbolPosition

Type: `before` \| `after`

### Tag

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `slug` | string | yes |  |
| `name` | string | yes |  |
| `legacyWooId` | number | no |  |

### TaxCalculation

| Field | Type | Required | Notes |
|---|---|---|---|
| `enabled` | boolean | yes |  |
| `pricesIncludeTax` | boolean | yes |  |
| `lines` | [TaxLineResult](#taxlineresult)[] | yes |  |
| `shipping` | { amount, taxable, rate, tax, note } | yes |  |
| `groups` | [TaxGroup](#taxgroup)[] | yes |  |
| `itemsSubtotal` | number | yes |  |
| `discountTotal` | number | yes |  |
| `itemsTotal` | number | yes | Items after discounts, as entered. |
| `itemsNet` | number | yes | Items after discounts, excluding tax — net sales. |
| `itemsTax` | number | yes |  |
| `shippingTotal` | number | yes |  |
| `shippingTax` | number | yes |  |
| `taxTotal` | number | yes |  |
| `total` | number | yes | Payable total. |
| `netTotal` | number | yes | Total excluding tax. |

### TaxClass

Tax class key. The classes and their rates are configured in the backend tax settings; these keys are placeholders until the store's VAT setup is agreed.

Type: `standard` \| `reduced` \| `exempt`

### TaxClassOption

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | [TaxClass](#taxclass) | yes |  |
| `name` | string | yes |  |

### TaxClassUsage

Tax class with how many products / variation overrides use it.

| Field | Type | Required | Notes |
|---|---|---|---|
| `products` | number | yes |  |
| `variationOverrides` | number | yes |  |
| `hasFallback` | boolean | yes | Has an enabled country-wide (fallback) rate. |
| `id` | [TaxClass](#taxclass) | yes |  |
| `name` | string | yes |  |

### TaxGroup

| Field | Type | Required | Notes |
|---|---|---|---|
| `rate` | [AppliedTaxRate](#appliedtaxrate) | yes |  |
| `taxableAmount` | number | yes | Amount the tax is calculated on, excluding tax (items + shipping at this rate). |
| `taxAmount` | number | yes |  |
| `itemsTax` | number | yes | Tax on the items at this rate (rounded once). |
| `shippingTax` | number | yes | Tax on shipping at this rate (rounded once). |
| `members` | string[] | yes | Lines (keys) and/or "shipping" in this group. |

### TaxLine

| Field | Type | Required | Notes |
|---|---|---|---|
| `taxClass` | [TaxClass](#taxclass) | yes |  |
| `rate` | number | yes | Rate as a percentage, as configured in the backend tax settings. |
| `taxableAmount` | number | yes | Amount taxed, excluding tax. |
| `taxAmount` | number | yes |  |
| `rateId` | string | no | Rate snapshot (orders created with tax settings); absent on older orders using placeholder class rates. |
| `rateName` | string | no |  |

### TaxLineResult

| Field | Type | Required | Notes |
|---|---|---|---|
| `amount` | number | yes | subtotal − discount, as entered (includes tax when prices include tax). |
| `tax` | number | yes | This line's share of its rate's item tax (largest-remainder allocation; shares add up exactly). |
| `net` | number | yes | Line amount excluding tax — the line's net sales. |
| `rate` | [AppliedTaxRate](#appliedtaxrate) | no |  |
| `note` | string | yes |  |
| `key` | string | yes |  |
| `label` | string | yes |  |
| `taxClass` | [TaxClass](#taxclass) | yes |  |
| `taxable` | boolean | yes | false for products whose tax status is "none" or "shipping only". |
| `subtotal` | number | yes | Before discount (as entered). |
| `discount` | number | yes |  |

### TaxLocation

Where a rate applies. Matching priority: postcode > city > prefecture > country (fallback).

Type: { type, country } or { type, prefecture } or { type, prefecture, city } or { type, postalCode }

### TaxPreviewInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `address` | [ShippingAddress](#shippingaddress) | yes |  |
| `customerId` | string | no |  |
| `lines` | [TaxPreviewLineInput](#taxpreviewlineinput)[] | yes |  |
| `shippingMethodId` | string | no | "auto" = suggested shipping method; "none" = no shipping; otherwise a method id of the matched zone. |
| `shippingAmount` | number | no | Overrides the shipping amount (e.g. an agreed charge on an admin order). |

### TaxPreviewLine

| Field | Type | Required | Notes |
|---|---|---|---|
| `productId` | string | yes |  |
| `variationId` | string | no |  |
| `name` | string | yes |  |
| `variationLabel` | string | no |  |
| `sku` | string | yes |  |
| `quantity` | number | yes |  |
| `unitPrice` | number | yes |  |
| `priceSource` | `rule` \\| `sale` \\| `regular` \\| `given` | yes |  |
| `taxClass` | [TaxClass](#taxclass) | yes |  |
| `classFrom` | `variation` \\| `product` | yes |  |
| `taxable` | boolean | yes |  |

### TaxPreviewLineInput

One line in a tax preview or order (amount after discount, as entered).

| Field | Type | Required | Notes |
|---|---|---|---|
| `productId` | string | yes |  |
| `variationId` | string | no |  |
| `quantity` | number | yes |  |
| `unitPrice` | number | no | Agreed unit price; omitted → the customer/catalog price. |
| `discount` | number | no |  |

### TaxPreviewResult

DEMO calculation with fictional rates; the backend performs the authoritative calculation.

| Field | Type | Required | Notes |
|---|---|---|---|
| `calc` | [TaxCalculation](#taxcalculation) | yes |  |
| `lines` | [TaxPreviewLine](#taxpreviewline)[] | yes |  |
| `shipping` | { zoneName, options, selectedId, amount } | yes |  |
| `snapshot` | [OrderTaxSnapshot](#ordertaxsnapshot) | yes |  |
| `matches` | { taxClass, explanation }[] | yes | Per-class matching explanation for this address. |
| `skipped` | string[] | yes |  |

### TaxRate

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes |  |
| `name` | string | yes |  |
| `percent` | number | yes | Percentage, 0–100 with up to 2 decimals. |
| `taxClass` | [TaxClass](#taxclass) | yes |  |
| `location` | [TaxLocation](#taxlocation) | yes |  |
| `enabled` | boolean | yes |  |
| `createdAt` | string | yes |  |
| `updatedAt` | string | yes |  |
| `legacyWooId` | number | no |  |

### TaxRateInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes |  |
| `enabled` | boolean | yes |  |
| `percent` | number | yes | Percentage, 0–100 with up to 2 decimals. |
| `location` | [TaxLocation](#taxlocation) | yes |  |
| `taxClass` | [TaxClass](#taxclass) | yes |  |

### TaxRateListItem

| Field | Type | Required | Notes |
|---|---|---|---|
| `locationLabel` | string | yes |  |
| `id` | string | yes |  |
| `name` | string | yes |  |
| `percent` | number | yes | Percentage, 0–100 with up to 2 decimals. |
| `taxClass` | [TaxClass](#taxclass) | yes |  |
| `location` | [TaxLocation](#taxlocation) | yes |  |
| `enabled` | boolean | yes |  |
| `createdAt` | string | yes |  |
| `updatedAt` | string | yes |  |
| `legacyWooId` | number | no |  |

### TaxRates

VAT rate per class as a percentage (may have decimals, e.g. 7.5). Placeholder until the tax module exists.

| Field | Type | Required | Notes |
|---|---|---|---|
| `standard` | number | yes |  |
| `reduced` | number | yes |  |
| `exempt` | number | yes |  |

### TaxSettings

| Field | Type | Required | Notes |
|---|---|---|---|
| `enabled` | boolean | yes | Off = no tax is calculated anywhere. |
| `pricesIncludeTax` | boolean | yes | true = entered catalog/agreed prices already include tax (tax is extracted); false = tax is added on top. |
| `shippingTaxable` | boolean | yes | Whether shipping charges are taxed. Not assumed. |
| `shippingTaxClass` | [TaxClass](#taxclass) | yes | Class whose matching rate applies to taxable shipping. |
| `updatedAt` | string | yes |  |

### TaxSettingsInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `enabled` | boolean | yes | Off = no tax is calculated anywhere. |
| `pricesIncludeTax` | boolean | yes | true = entered catalog/agreed prices already include tax (tax is extracted); false = tax is added on top. |
| `shippingTaxable` | boolean | yes | Whether shipping charges are taxed. Not assumed. |
| `shippingTaxClass` | [TaxClass](#taxclass) | yes | Class whose matching rate applies to taxable shipping. |

### TaxStatus

Whether the product, its shipping only, or nothing is taxable.

Type: `none` \| `taxable` \| `shipping`

### TermKind

Type: `tag` \| `category`

### TermUsage

A blog category or tag with the number of posts using it.

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes |  |
| `count` | number | yes |  |

### UpcomingDelivery

| Field | Type | Required | Notes |
|---|---|---|---|
| `date` | string | yes |  |
| `orderByDate` | string | yes |  |
| `orderByTime` | string | yes |  |

### VariationInput

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | no | Omitted for new variations. |
| `sku` | string | yes |  |
| `gtin` | string | no |  |
| `attributes` | map of string | yes |  |
| `status` | [VariationStatus](#variationstatus) | yes |  |
| `basePrice` | number | no |  |
| `salePrice` | number | no |  |
| `saleFrom` | string | no |  |
| `saleTo` | string | no |  |
| `image` | [ProductImage](#productimage) | no |  |
| `gallery` | [ProductImage](#productimage)[] | yes |  |
| `description` | string | no |  |
| `stockMode` | [VariationStockMode](#variationstockmode) | yes |  |
| `stockQuantity` | number | no | Used when `stockMode` is "track". |
| `stockStatus` | [StockStatus](#stockstatus) | yes | Used when `stockMode` is "status". |
| `backorders` | `no` \\| `notify` \\| `allow` | no |  |
| `weight` | [Weight](#weight) | no | Overrides; undefined = same as parent. |
| `dimensions` | [Dimensions](#dimensions) | no |  |
| `shippingClassId` | string | no |  |
| `taxClass` | `standard` \\| `reduced` \\| `exempt` | no |  |

### VariationStatus

Type: `active` \| `disabled`

### VariationStockMode

"parent" = uses the product-level stock; "track" = own quantity; "status" = own manual status.

Type: `status` \| `parent` \| `track`

### WalkInCustomer

Walk-in buyer details for an order without a registered account (only what staff entered).

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes |  |
| `companyName` | string | no |  |

### Weekday

Type: `mon` \| `tue` \| `wed` \| `thu` \| `fri` \| `sat` \| `sun`

### Weight

| Field | Type | Required | Notes |
|---|---|---|---|
| `value` | number | yes |  |
| `unit` | [WeightUnit](#weightunit) | yes |  |

### WeightUnit

Type: `kg` \| `g`

### ZoneLocation

One place a zone covers. Matching is by specificity: postcode > city > prefecture.

Type: { type, prefecture } or { type, prefecture, city } or { type, postalCode }

### ZoneMatch

| Field | Type | Required | Notes |
|---|---|---|---|
| `zone` | [ShippingZone](#shippingzone) | no |  |
| `level` | `prefecture` \\| `city` \\| `postcode` \\| `fallback` | no |  |
| `location` | { type, prefecture } or { type, prefecture, city } or { type, postalCode } | no |  |
| `explanation` | string | yes |  |

