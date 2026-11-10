# Demo mode guide

For anyone trying the demo: the owner, testers, a client or the backend developer.

**This is a demonstration.** Nothing here is real: no real sign-in, payments, refunds or emails, and no permanent data. Don't enter real personal or card details.

## Starting it

```
npm install
npm run dev
```

Open http://localhost:3000. No database or other service is needed.

## Signing in

The login page lists these accounts, all with the password `demo1234`:

| Email | You see |
|---|---|
| `customer@demo.test` | The customer portal, as an approved customer with wholesale prices |
| `applicant@demo.test` | The "application pending" view: no prices, no ordering |
| `admin@demo.test` | The admin panel. In the store, standard wholesale prices on cards, product pages and quick order, with Create order instead of a cart |

The password check is only for show. The **Demo view** switcher on screen moves between guest, customer, applicant and admin at any time, and in the admin you can also preview each staff role. It's turned off with `DEMO_VIEW_SWITCHER=off`.

## The sample company

HL Nippon is a sample, shown as a wholesale store in Japan: yen, Tokyo time and Japanese addresses. All of it can be changed under **Company settings** or the **Setup wizard**, including switching to another country and currency, and it can be put back with the reset option in settings. Sample policy pages are marked as demonstration content and need legal review before any real use.

Sample product, customer and order details are invented. The tax rates are fictional and aren't legal rates. Tax is off until you turn it on.

## Things to try

Sample coupons, for an approved customer at the cart: `WELCOME10`, `SAVE500`, `SPICE100`. `SUMMER2025` is deliberately expired.

| Try this | Where |
|---|---|
| Browse as a guest (no prices), then as a customer | `/shop`, Demo view |
| Quick order, cart, coupon, checkout | `/shop`, `/cart` |
| Saved lists, quotations, deliveries, invoices | `/account` |
| Approve a registration | `/admin/customers/requests` |
| Create an order, including a walk-in | `/admin/orders/new` |
| Move an order through its statuses, adjust a delivered weight, issue an invoice, record a refund | Any order in `/admin/orders` |
| Build a price rule and test it | `/admin/pricing`, `/admin/pricing/test` |
| Build a shipping zone and rule, then see the explanation | `/admin/shipping`, `/admin/shipping/preview` |
| Edit a page, menu or the homepage | `/admin/pages`, `/admin/menus`, `/admin/homepage` |
| Change the logo, colours or currency | `/admin/settings/company`, `/admin/settings` |
| See a reminder's recipients and simulate sending | `/admin/reminders` |
| Edit an email template and see the log | `/admin/emails` |
| Decide exactly what a role can do | `/admin/roles`, then choose a role |
| Add a person, give them a role, see what they can do | `/admin/staff` |
| Preview the admin as a role such as Warehouse Staff | "Preview as" at the top of the admin, or the preview button on a role or staff member |
| Reports and CSV export | `/admin/reports` |
| Upload brand logos and choose which show on the homepage | `/admin/brands` |

## What's simulated

| Looks like | What actually happens |
|---|---|
| Signing in | A cookie picks the view. Anyone can pick any view |
| Roles and permissions | Change what's shown and what the demo accepts. They aren't security |
| Inviting staff | Marks the person as invited. No email is sent and no login exists |
| Export CSV | Created on the demo server from sample data |
| Placing an order | Saved in the server's memory. Nothing is charged |
| Payment method | A label on the order. Selecting one never marks it paid, and no card details are ever collected |
| Refund | A record on the order. No money moves |
| Emails and reminders | A log row saying "simulated". Nothing is sent |
| Print or save invoice | The browser's print view, not a server-generated PDF |
| File uploads | Held in memory and gone on restart |
| Forgot password | Shows the screens. No message is sent |
| Stock | Not reserved or reduced when an order is placed |

## When data disappears

Everything you change lives in the running server's memory:

- Restarting the server puts everything back to the sample data.
- On Vercel or similar serverless hosting, changes can vanish or differ between requests, so edit demos work best on a single running server.
- Nothing is shared with any other deployment.

## Before any real use

The demo isn't ready for real customers until a backend exists. Turn off the demo switcher, replace sample content and policies, and work through [BACKEND-PENDING-FEATURES.md](BACKEND-PENDING-FEATURES.md).
