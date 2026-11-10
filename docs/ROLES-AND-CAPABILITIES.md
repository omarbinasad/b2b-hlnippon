# Roles and capabilities

For the backend developer and whoever sets up staff accounts.

**In the demo, none of this is security.** A cookie picks the role being previewed, nobody signs in, and the checks only decide what the screens show and what the demo's actions accept. The backend must check the signed-in user's capabilities on every protected call.

Source of truth:

| What | Where | Tests |
|---|---|---|
| Capabilities, templates, route rules, safeguards | `src/lib/auth/capabilities.ts` | `tests/roles-reports.test.ts`, `tests/permission-catalog.test.ts` |
| Plain-language catalog and warnings | `src/lib/auth/permission-catalog.ts` | `tests/permission-catalog.test.ts` |
| Hiding and disabling on screen | `src/components/admin/capabilities-context.tsx`, `route-guard.tsx` | Browser only |
| Role Editor, Staff screens | `src/components/admin/staff/` | Browser only |

## The model

A capability is `module.action`, for example `orders.view` or `refunds.refund`. A role is a named set of capabilities. Each staff member has one role. Customers aren't staff: they use the customer portal and have no admin capabilities.

Editing a role and assigning a role are separate. **Roles** decides what a role can do. **Staff** decides who has which role.

## Capabilities

The Role Editor shows these with the labels and explanations in `permission-catalog.ts`. A test checks every capability appears there exactly once.

| Group | Capability | In the Role Editor |
|---|---|---|
| Dashboard | `dashboard.view` | Open the dashboard |
| Orders | `orders.view` | View orders |
| Orders | `orders_create.create` | Create orders |
| Orders | `orders_edit.edit` | Edit orders: delivery date, shipping charge, notes, recorded payments |
| Orders | `orders.delete` | Delete eligible orders |
| Orders | `order_items.edit` | Add or remove order products |
| Orders | `order_quantities.edit` | Change order quantities |
| Orders | `order_prices.edit` | Change order prices |
| Orders | `order_discounts.edit` | Apply order discounts |
| Orders | `delivered_weight.edit` | Adjust delivered weights |
| Orders | `order_status.edit` | Update order status |
| Orders | `order_addresses.edit` | Change billing and shipping information |
| Orders | `order_stock.edit` | Change global product stock from order details |
| Orders | `refunds.view`, `refunds.refund` | See refunds, Process refunds |
| Orders | `orders.export` | Export orders |
| Products | `products.view`, `.create`, `.edit`, `.delete`, `.export` | Includes categories and brands. `.delete` archives products and deletes brands |
| Inventory | `inventory.view`, `.edit` | View inventory, Adjust stock |
| Customers | `customers.view`, `.create`, `.edit`, `.delete`, `.export` | Includes addresses and groups |
| Customers | `customer_approval.view`, `.approve` | See registration requests, Approve or reject customers |
| Wholesale Pricing | `pricing.view`, `.create`, `.edit` | Price rules and quantity limits |
| Coupons | `coupons.view`, `.create`, `.edit`, `.delete` | |
| Quotations | `quotations.view`, `.edit` | View quotations, Reply to quotations |
| Website Pages | `pages.view`, `.create`, `.edit`, `.delete` | |
| Blog Posts | `posts.view`, `.create`, `.edit`, `.delete` | `.edit` includes categories and tags |
| Media Library | `media.view`, `.create`, `.edit`, `.delete` | Browse, Upload, Edit file details, Delete |
| Header/Footer Menus | `menus.view`, `.edit` | |
| Homepage Builder | `homepage.view`, `.edit` | |
| Shipping | `shipping.view`, `.manage` | |
| Delivery Schedules | `delivery.view`, `.manage` | |
| Reminders | `reminders.view`, `.manage` | |
| Taxes | `taxes.view`, `.manage` | |
| Payments | `payments.view`, `.manage` | |
| Invoices | `invoices.view`, `.create`, `.manage` | View, Issue, Change invoice settings |
| Email Templates | `emails.view`, `.manage` | |
| Reports | `reports.view`, `.export` | |
| Company Settings | `company.view`, `.manage` | |
| Staff & Roles | `staff.view`, `.manage`, `roles.view`, `.manage` | |

## New and changed capabilities

The older model had one broad permission for most order changes. These were added so each action can be turned on or off alone. Identifiers already in use weren't renamed.

| New capability | Split from | Covers |
|---|---|---|
| `order_items.edit` | `orders_edit.edit` | Add, remove, replace a product on an order |
| `order_quantities.edit` | `orders_edit.edit` | Line quantity |
| `order_status.edit` | `orders_edit.edit` | Status changes and cancelling |
| `order_addresses.edit` | `orders_edit.edit` | Billing and shipping addresses |
| `order_stock.edit` | `inventory.edit` | Site-wide stock change from an order page |
| `orders.delete` | None | Deleting an eligible order |
| `quotations.view` | `orders.view` | Quotation list and detail |
| `quotations.edit` | `orders_edit.edit` | Sending or declining a quote |

**Removed:** `pricing.delete`. Nothing used it: rules are switched off, not deleted.

**`invoices.view` is now enforced.** The invoice page used to open with `orders.view`.

### Upgrading stored roles

`upgradeCapabilities` gives a stored role the finer capabilities its broad ones already covered, so nothing changes for anyone on the day of the upgrade:

| A role with | Also gets |
|---|---|
| `orders_edit.edit` | `order_items.edit`, `order_quantities.edit`, `order_status.edit`, `order_addresses.edit`, `quotations.edit` |
| `inventory.edit` | `order_stock.edit` |
| `orders.view` | `quotations.view`, `invoices.view` |

**Run it once per stored role, as a data migration.** Running it again would undo an administrator's later choice to turn one off. `orders.delete` isn't handed out: it's a new power, granted on purpose. `invoices.create` wasn't handed to Customer Support, who could only issue invoices before because of a coarse check; the documented rule was always `invoices.create`.

The demo does this once for a server that's already running, in `src/lib/data/mock-staff.ts`.

## Default templates

Six built-in roles double as templates. They can be edited (except Administrator) and duplicated, and new roles can start from any of them. Choosing a role's own template in the editor puts it back to its defaults. They can't be deleted.

| Role | What it covers |
|---|---|
| Administrator | Everything. Always keeps every capability. Can't be renamed. |
| Shop Manager | Everything except staff, roles and company settings. |
| Order Manager | Every order permission except site-wide stock. Views customers, products and inventory. Views and issues invoices. Replies to quotations. |
| Warehouse Staff | Views orders and products, records delivered weight, changes stock in Inventory and from orders. Views invoices and quotations. Can't change prices, status or items. |
| Content Editor | Pages, posts, media, menus and homepage. |
| Customer Support | Views and edits orders, including status, products, quantities and addresses, but not prices, discounts or refunds. Sees refunds. Views and edits customers, approves customers, views email logs. Replies to quotations. |

**B2B Customer** isn't a staff role. It's listed so the model covers everyone.

## Rules the backend must enforce

| Rule | Function | Behaviour |
|---|---|---|
| No privilege escalation | `escalatedCapabilities` | You can't grant a capability you don't have, in a role or by assigning a role to someone. Keeping one the role already has is fine. |
| Nobody above you | `staffTargetError` | You can't change or remove someone whose role has permissions you lack. |
| Administrator is protected | `roleEditError`, plus the check in `saveRole` | Refuse removing anything from it, renaming it, or changing its description. |
| No locking yourself out | `selfLockoutError` | Refuse removing `roles.manage` from the role the user has. |
| Built-in and used roles stay | `roleDeleteError` | Built-in roles can't be deleted. A role with staff can't be deleted until they move. |
| Always one administrator | `staffChangeError` | Refuse any edit or removal leaving no active administrator. |
| Unique role names | `validateRole` | Compared case-insensitively. |
| Eligible orders only | `orderDeleteError` | Cancelled, with no payment, refund or invoice. |
| Customers without orders only | `customers.remove` in `mock-customers.ts` | Otherwise suspend them. |

## Which capability an order change needs

The demo does this in `actorForEdit` in `src/app/admin/orders/actions.ts`. The backend must do the same, field by field. A single request changing several fields needs all of the matching capabilities.

| Change | Capability |
|---|---|
| Delivered weight | `delivered_weight.edit` |
| Agreed unit price | `order_prices.edit` |
| Quantity | `order_quantities.edit` |
| Order discount | `order_discounts.edit` |
| Add, remove, replace a product | `order_items.edit` |
| Billing or shipping address | `order_addresses.edit` |
| Delivery date, shipping charge, notes, recorded payment | `orders_edit.edit` |
| Status, cancel | `order_status.edit` |
| Site-wide stock from the order page | `order_stock.edit` |
| Refund | `refunds.refund` |
| Issue invoice | `invoices.create` |
| Delete | `orders.delete` |

**Creating an order doesn't by itself allow setting a price.** With `orders_create.create` alone, the line price must equal the quoted price and the discount must be zero. A different price needs `order_prices.edit`; a discount needs `order_discounts.edit`.

## API contract

Full request and response shapes are in `API-CONTRACTS.md` and `openapi.yaml`, generated from the code.

| Call | Capability | Notes |
|---|---|---|
| `GET /auth/me` | Signed in | Staff get their `capabilities`. The frontend uses this list in place of the demo cookie |
| `GET /admin/roles` | `roles.view` | |
| `GET /admin/roles/{id}` | `roles.view` | |
| `GET /admin/roles/staff-counts` | `roles.view` | |
| `POST /admin/roles` | `roles.manage` | Body: `RoleInput`. Refuse escalation |
| `PUT /admin/roles/{id}` | `roles.manage` | Refuse escalation, changes to Administrator, self-lockout |
| `POST /admin/roles/{id}/duplicate` | `roles.manage` | Refuse escalation |
| `DELETE /admin/roles/{id}` | `roles.manage` | Refuse built-in roles and roles in use |
| `GET /admin/staff` | `staff.view` | Query: `search`, `roleId`, paging |
| `GET /admin/staff/{id}` | `staff.view` | |
| `POST /admin/staff` | `staff.manage` | Body: `StaffInput`. `invite: true` emails an invitation and sets `invitedAt` |
| `PUT /admin/staff/{id}` | `staff.manage` | Refuse escalation, changing someone above you, leaving no administrator |
| `DELETE /admin/staff/{id}` | `staff.manage` | Refuse someone above you, or the last administrator |
| `POST /auth/staff-invitations/accept` | Public | Single-use token sets the password, then clears `invitedAt` |

**Errors:** 403 `forbidden` when the capability is missing; 422 with a `message` when a rule refuses it, such as the last administrator.

**The list of capabilities is shared by agreement.** The frontend ships the labels, explanations and templates. The backend needs the same identifiers: seed them from `ALL_CAPABILITIES` and `DEFAULT_ROLES`. An unknown identifier must be refused with 422. There's deliberately no endpoint for the catalog, because the frontend doesn't read one.

## What the screens do

| Behaviour | Where |
|---|---|
| Sidebar shows only modules the role can open | `AdminShell`, `canOpen` |
| Opening a restricted URL shows Access denied | `RouteGuard`, `capabilityForPath`. Create and edit pages have their own capability, not only the list |
| A form page the role can read but not change is disabled, with a "View only" note | `RouteGuard`, `writeCapabilityForPath` |
| List pages keep search and filters, and hide their write buttons | `Can` |
| One form on an otherwise open page is disabled | `WriteGuard` |
| A link to another module is plain text if the role can't open it | `AllowedLink` |
| Notifications show only what the role works with | `notificationsFor` in `admin-shell.tsx` |
| Every server action checks its own capability | `actorWith` in `session.ts` |
| Downloads check too: exports and identity documents | The route handlers under `src/app/admin` |

**Preview as** in the top bar changes the role the admin is viewed as. It never changes a role or who has it. While previewing, a banner says so and offers the way back. The Role Editor states both the role being edited and the role being viewed as. Saved changes apply at once, including to a preview in progress.

## Known gaps

- Read-only lookups used inside forms (customer and product search on the order form, for example) aren't checked by capability in the demo. The backend must check them.
- Each staff member has one role. Several roles per person isn't modelled: make a custom role that combines them.
- There are no staff logins. Adding someone records them and, if asked, marks them as invited. No email is sent.
- The unsaved-changes warning covers links in the app, closing or reloading the tab, the role switcher and "Preview as". The browser's back button isn't covered: the app router has no way to intercept it.
- Change history and notes on orders show the demo actor's name, because nobody signs in.
