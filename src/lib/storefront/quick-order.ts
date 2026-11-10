import "server-only";

import { canSeeWholesalePrices, getViewer, type Viewer } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { STANDARD_PRICING_ID } from "@/lib/pricing/standard";
import type { Category, QuickOrderPage } from "@/lib/types";

/** Who is looking — decides prices, ordering and the message shown on the quick order sheet. */
export type QuickOrderAccess = "guest" | "pending" | "approved" | "admin";

export interface QuickOrderSheetData {
  initial: QuickOrderPage;
  categories: { slug: string; name: string }[];
  access: QuickOrderAccess;
}

export const quickOrderAccess = (viewer: Viewer): QuickOrderAccess =>
  viewer.kind === "admin" ? "admin" : viewer.kind === "customer" ? (canSeeWholesalePrices(viewer) ? "approved" : "pending") : "guest";

/** Active categories as "Parent" / "— Child" options, parents first (two levels). */
function categoryOptions(categories: Category[]) {
  const byName = (a: Category, b: Category) => a.name.localeCompare(b.name);
  const ids = new Set(categories.map((c) => c.id));
  const roots = categories.filter((c) => !c.parentId || !ids.has(c.parentId)).sort(byName);
  return roots.flatMap((root) => [
    { slug: root.slug, name: root.name },
    ...categories.filter((c) => c.parentId === root.id).sort(byName).map((c) => ({ slug: c.slug, name: `— ${c.name}` })),
  ]);
}

/**
 * First page, category options and viewer access for the quick order sheet (Home and /account/quick-order).
 * Prices are resolved on the server: an approved customer's own, or the standard price for staff.
 */
export async function loadQuickOrderSheet(): Promise<QuickOrderSheetData> {
  const viewer = await getViewer();
  const access = quickOrderAccess(viewer);
  const customerId = access === "approved" && viewer.kind === "customer" ? viewer.customerId : access === "admin" ? STANDARD_PRICING_ID : null;
  const [initial, categories] = await Promise.all([repositories.cart.quickOrder(customerId, {}), repositories.products.listCategories()]);
  return { initial, categories: categoryOptions(categories), access };
}
