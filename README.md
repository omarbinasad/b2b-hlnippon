# b2b-commerce

Next.js frontend for a B2B wholesale store (mock defaults: Bangladesh, BDT, Asia/Dhaka): public storefront, customer portal and admin panel.
The backend (Laravel or Django) is not connected yet — all data comes from mock repositories.

## Requirements

- Node.js 20.9+ (tested with 22)
- npm

## Setup

```bash
npm install
cp .env.example .env.local   # optional
npm run dev                  # http://localhost:3000
```

## Scripts

| Command             | Purpose                        |
| ------------------- | ------------------------------ |
| `npm run dev`       | Start the dev server           |
| `npm run lint`      | ESLint                         |
| `npm run typecheck` | Generate route types + `tsc`   |
| `npm run build`     | Production build               |
| `npm start`         | Serve the production build     |

## Areas

| Area              | Routes                                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| Storefront        | `/`, `/shop`, `/shop/[slug]`, `/about`, `/contact`, `/cart`, `/checkout` |
| Account access    | `/login`, `/register`, `/application-pending`                         |
| Customer portal   | `/account`, `/account/orders`, `/account/orders/[id]`, `/account/quick-order`, `/account/profile`, `/account/addresses`, `/account/notifications` |
| Admin             | `/admin`, `/admin/products`, `/admin/orders`, `/admin/customers`, `/admin/customer-groups`, `/admin/pricing`, `/admin/delivery`, `/admin/reminders`, `/admin/settings` |

## Branding

- Store name, logo, contact details and navigation: `src/config/site.ts`
- Colors and radius: CSS variables at the top of `src/app/globals.css` (light values in `:root`, dark in `[data-theme="dark"]`)
- Light/dark mode follows the system until the user picks one with the theme switch; the choice is saved in the browser

## Media files

Files in `public/` are served from the site root (`public/brand/logo.svg` → `/brand/logo.svg`).

| Folder | For |
| ------ | --- |
| `public/brand/` | Logo and brand marks. Set `logo.src` in `src/config/site.ts` (e.g. `"/brand/logo.svg"`) to replace the text placeholder. |
| `public/images/` | Fixed site images (homepage banner, About page photos). Render with `next/image`. |

Product photos do **not** go in the repo. They will be uploaded through the admin and served by the backend's
media host (`NEXT_PUBLIC_MEDIA_HOST` in `.env.local`).

## Connecting a backend

The API contract (endpoints, JSON examples, auth and roles, mock-only features) is in
[docs/backend-api.md](docs/backend-api.md).

Pages only use `repositories` from `@/lib/data`. To connect Laravel or Django:

1. Implement the interfaces in `src/lib/data/repositories.ts` with API calls (e.g. `src/lib/data/api-repositories.ts`).
2. Select that implementation in `src/lib/data/index.ts`.
3. Replace the mock viewer in `src/lib/auth/session.ts` with a real session check.

## Not real yet

Authentication, price access control, cart, checkout, payments and all admin editing are placeholders.
`MOCK_VIEWER` only switches what the UI shows for preview purposes; it provides no security.
