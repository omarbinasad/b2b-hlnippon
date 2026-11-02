import "server-only";

import { cookies } from "next/headers";
import type { AccountStatus, ID } from "@/lib/types";

/**
 * MOCK ONLY — there is no authentication yet.
 *
 * The viewer is chosen by the on-screen demo view switcher (`demo-view` cookie), falling back to the MOCK_VIEWER
 * env var, so the UI can be previewed as a guest, an applicant, an approved customer or an admin. This provides NO security:
 * price visibility and account/admin access must be enforced by the backend
 * (and a real session check here) before launch.
 *
 * Both helpers read request cookies (where the real session will live), which
 * makes every page using them render per request — personalized pages are
 * never prerendered or served from a shared cache.
 */
export type Viewer =
  | { kind: "guest" }
  | { kind: "customer"; customerId: ID; status: AccountStatus }
  | { kind: "admin"; userId: ID };

/** Demo customer used to preview the customer portal. */
export const DEMO_CUSTOMER_ID = "cus-001";

/** Demo views offered by the switcher (MOCK — replaced by real sign-in). */
export const DEMO_VIEWS = {
  guest: "Guest (not logged in)",
  "customer-pending": "Applicant (awaiting approval)",
  customer: "Approved customer (logged in)",
  admin: "Admin",
} as const;
export type DemoView = keyof typeof DEMO_VIEWS;

export const DEMO_VIEW_COOKIE = "demo-view";

/** The switcher is on unless DEMO_VIEW_SWITCHER=off (turn it off, or remove it, once real authentication exists). */
export const demoViewSwitcherEnabled = () => process.env.DEMO_VIEW_SWITCHER !== "off";

const isDemoView = (v: unknown): v is DemoView => typeof v === "string" && Object.hasOwn(DEMO_VIEWS, v);

/** View used when the switcher has not been used: MOCK_VIEWER, else guest. */
export const defaultDemoView = (): DemoView => (isDemoView(process.env.MOCK_VIEWER) ? process.env.MOCK_VIEWER : "guest");

/** The active demo view: the switcher's cookie when enabled and valid, else the default. */
export async function getDemoView(): Promise<DemoView> {
  const chosen = (await cookies()).get(DEMO_VIEW_COOKIE)?.value;
  return demoViewSwitcherEnabled() && isDemoView(chosen) ? chosen : defaultDemoView();
}

export async function getViewer(): Promise<Viewer> {
  switch (await getDemoView()) {
    case "customer":
      return { kind: "customer", customerId: DEMO_CUSTOMER_ID, status: "approved" };
    case "customer-pending":
      // Demo applicant awaiting approval: sees approval messages, never wholesale prices.
      return { kind: "customer", customerId: "cus-003", status: "pending" };
    case "admin":
      return { kind: "admin", userId: "admin-1" };
    default:
      return { kind: "guest" };
  }
}

/**
 * Customer whose portal is shown. MOCK: always the demo customer so the portal
 * can be previewed; the real version must derive this from the session.
 */
export async function getPortalCustomerId(): Promise<ID> {
  await cookies();
  return DEMO_CUSTOMER_ID;
}

/** True when the viewer may see wholesale prices (UI hint only, not enforcement). */
export function canSeeWholesalePrices(viewer: Viewer) {
  return viewer.kind === "admin" || (viewer.kind === "customer" && viewer.status === "approved");
}

/**
 * MOCK: the admin performing an action, for history and audit records.
 * The real version must come from the authenticated session, and the backend
 * must check these permissions on every mutation.
 */
export async function getAdminActor(): Promise<{ id: ID; name: string; role: "admin"; permissions: string[] }> {
  await cookies();
  return { id: "admin-1", name: "Demo admin", role: "admin", permissions: ["orders.create", "orders.update", "orders.adjust", "orders.refund", "products.stock", "customers.manage", "customers.approve", "customer-groups.manage", "pricing.manage", "settings.manage", "shipping.manage", "tax.manage", "payments.manage"] };
}

/**
 * Customer who may shop (cart, checkout, reorder): an approved customer viewer, else null.
 * MOCK: from the demo view; the backend must check the session and the account status on every cart/checkout call.
 */
export async function getShoppingCustomerId(): Promise<ID | null> {
  const viewer = await getViewer();
  return viewer.kind === "customer" && viewer.status === "approved" ? viewer.customerId : null;
}
