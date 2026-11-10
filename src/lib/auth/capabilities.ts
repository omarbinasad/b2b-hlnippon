/**
 * Roles and capabilities. Pure and tested.
 *
 * IMPORTANT: on the frontend these only decide what the screen shows and what the demo's server actions accept. They are
 * not security. The backend must check the signed-in user's capabilities on every protected operation.
 */
export const ACTIONS = ["view", "create", "edit", "delete", "approve", "export", "refund", "manage"] as const;
export type CapabilityAction = (typeof ACTIONS)[number];

export const ACTION_LABELS: Record<CapabilityAction, string> = { view: "View", create: "Create", edit: "Edit", delete: "Delete", approve: "Approve", export: "Export", refund: "Refund", manage: "Manage settings" };

export interface CapabilityModule {
  key: string;
  label: string;
  group: string;
  actions: CapabilityAction[];
}

const CRUD: CapabilityAction[] = ["view", "create", "edit", "delete"];

export const MODULES: CapabilityModule[] = [
  { key: "dashboard", label: "Dashboard", group: "Dashboard", actions: ["view"] },
  { key: "orders", label: "Orders", group: "Orders", actions: ["view", "export", "delete"] },
  { key: "orders_create", label: "Create orders", group: "Orders", actions: ["create"] },
  { key: "orders_edit", label: "Edit orders", group: "Orders", actions: ["edit"] },
  { key: "order_items", label: "Order products", group: "Orders", actions: ["edit"] },
  { key: "order_quantities", label: "Order quantities", group: "Orders", actions: ["edit"] },
  { key: "order_prices", label: "Order prices", group: "Orders", actions: ["edit"] },
  { key: "order_discounts", label: "Order discounts", group: "Orders", actions: ["edit"] },
  { key: "delivered_weight", label: "Delivered weight", group: "Orders", actions: ["edit"] },
  { key: "order_status", label: "Order status", group: "Orders", actions: ["edit"] },
  { key: "order_addresses", label: "Billing and shipping information", group: "Orders", actions: ["edit"] },
  { key: "order_stock", label: "Stock from order details", group: "Orders", actions: ["edit"] },
  { key: "refunds", label: "Refunds", group: "Orders", actions: ["view", "refund"] },
  { key: "products", label: "Products", group: "Products", actions: [...CRUD, "export"] },
  { key: "inventory", label: "Inventory", group: "Inventory", actions: ["view", "edit"] },
  { key: "customers", label: "Customers", group: "Customers", actions: [...CRUD, "export"] },
  { key: "customer_approval", label: "Customer approval", group: "Customers", actions: ["view", "approve"] },
  { key: "pricing", label: "Pricing rules", group: "Wholesale Pricing", actions: ["view", "create", "edit"] },
  { key: "coupons", label: "Coupons", group: "Coupons", actions: CRUD },
  { key: "quotations", label: "Quotations", group: "Quotations", actions: ["view", "edit"] },
  { key: "pages", label: "Pages", group: "Website Pages", actions: CRUD },
  { key: "posts", label: "Posts", group: "Blog Posts", actions: CRUD },
  { key: "media", label: "Media", group: "Media Library", actions: CRUD },
  { key: "menus", label: "Navigation menus", group: "Header/Footer Menus", actions: ["view", "edit"] },
  { key: "homepage", label: "Homepage builder", group: "Homepage Builder", actions: ["view", "edit"] },
  { key: "shipping", label: "Shipping", group: "Shipping", actions: ["view", "manage"] },
  { key: "delivery", label: "Delivery schedules", group: "Delivery Schedules", actions: ["view", "manage"] },
  { key: "reminders", label: "Reminders", group: "Reminders", actions: ["view", "manage"] },
  { key: "taxes", label: "Taxes", group: "Taxes", actions: ["view", "manage"] },
  { key: "payments", label: "Payments", group: "Payments", actions: ["view", "manage"] },
  { key: "invoices", label: "Invoices", group: "Invoices", actions: ["view", "create", "manage"] },
  { key: "emails", label: "Email templates", group: "Email Templates", actions: ["view", "manage"] },
  { key: "reports", label: "Reports", group: "Reports", actions: ["view", "export"] },
  { key: "company", label: "Company settings", group: "Company Settings", actions: ["view", "manage"] },
  { key: "staff", label: "Staff", group: "Staff & Roles", actions: ["view", "manage"] },
  { key: "roles", label: "Roles and permissions", group: "Staff & Roles", actions: ["view", "manage"] },
];

export const ALL_CAPABILITIES = MODULES.flatMap((m) => m.actions.map((a) => `${m.key}.${a}`));
const cap = (module: string, ...actions: CapabilityAction[]) => actions.map((a) => `${module}.${a}`);
const allOf = (...modules: string[]) => modules.flatMap((k) => MODULES.find((m) => m.key === k)!.actions.map((a) => `${k}.${a}`));

export const ADMIN_ROLE_ID = "role-administrator";

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  /** Built-in roles can't be deleted. */
  system: boolean;
  capabilities: string[];
}

/**
 * Older roles used one broad permission for several things. These rules hand a stored role the finer permissions it
 * already effectively had, so nothing changes for it. Run them ONCE per stored role (see the mock store and
 * docs/ROLES-AND-CAPABILITIES.md): running them again would undo an administrator's later choice to turn one off.
 */
const SPLIT_FROM: Record<string, string[]> = {
  "orders_edit.edit": ["order_items.edit", "order_quantities.edit", "order_status.edit", "order_addresses.edit", "quotations.edit"],
  "inventory.edit": ["order_stock.edit"],
  "orders.view": ["quotations.view", "invoices.view"],
};
/** Never did anything: rules are switched off, not deleted. */
const RETIRED = new Set(["pricing.delete"]);

export function upgradeCapabilities(capabilities: Iterable<string>) {
  const list = [...capabilities];
  return [...new Set([...list.filter((c) => !RETIRED.has(c)), ...list.flatMap((c) => SPLIT_FROM[c] ?? [])])];
}

/** The six default templates. Built-in roles can be edited (except Administrator), and these are their defaults. */
export const DEFAULT_ROLES: RoleDefinition[] = [
  { id: ADMIN_ROLE_ID, name: "Administrator", description: "Everything, including staff and settings.", system: true, capabilities: ALL_CAPABILITIES },
  { id: "role-shop-manager", name: "Shop Manager", description: "Runs the shop day to day, without staff or company settings.", system: true, capabilities: ALL_CAPABILITIES.filter((c) => !/^(staff|roles|company)\./.test(c)) },
  { id: "role-order-manager", name: "Order Manager", description: "Creates and edits orders, including refunds.", system: true, capabilities: upgradeCapabilities([...cap("dashboard", "view"), ...allOf("orders", "orders_create", "orders_edit", "order_prices", "order_discounts", "delivered_weight", "refunds"), ...cap("customers", "view"), ...cap("products", "view"), ...cap("inventory", "view"), ...cap("invoices", "view", "create")]) },
  { id: "role-warehouse", name: "Warehouse Staff", description: "Sees orders, updates stock and delivered weights.", system: true, capabilities: upgradeCapabilities([...cap("dashboard", "view"), ...cap("orders", "view"), ...cap("delivered_weight", "edit"), ...cap("products", "view"), ...allOf("inventory")]) },
  { id: "role-content", name: "Content Editor", description: "Pages, posts, media, menus and the homepage.", system: true, capabilities: [...cap("dashboard", "view"), ...allOf("pages", "posts", "media", "menus", "homepage")] },
  { id: "role-support", name: "Customer Support", description: "Helps customers: orders, accounts, approvals.", system: true, capabilities: upgradeCapabilities([...cap("dashboard", "view"), ...cap("orders", "view"), ...cap("orders_edit", "edit"), ...cap("refunds", "view"), ...cap("customers", "view", "edit"), ...allOf("customer_approval"), ...cap("emails", "view")]) },
];

/**
 * The B2B Customer role is not a staff role: customers use the portal, never the admin. It is listed so the capability
 * model covers everyone, and has no admin capabilities.
 */
export const CUSTOMER_ROLE = { name: "B2B Customer", description: "Uses the customer portal only. No admin access." };

/** Capability needed to open a route. `*` stands for one path segment (an id). The most specific match wins. */
const ROUTES: [string, string][] = [
  ["/admin/orders/new", "orders_create.create"],
  ["/admin/orders/*/invoice", "invoices.view"],
  ["/admin/orders", "orders.view"],
  ["/admin/quotations", "quotations.view"],
  ["/admin/products/new", "products.create"],
  ["/admin/products/*/edit", "products.edit"],
  ["/admin/products", "products.view"],
  ["/admin/categories/new", "products.edit"],
  ["/admin/categories/*/edit", "products.edit"],
  ["/admin/categories", "products.view"],
  ["/admin/brands", "products.view"],
  ["/admin/inventory", "inventory.view"],
  ["/admin/customers/requests", "customer_approval.view"],
  ["/admin/customers/new", "customers.create"],
  ["/admin/customers/*/edit", "customers.edit"],
  ["/admin/customers", "customers.view"],
  ["/admin/customer-groups/new", "customers.edit"],
  ["/admin/customer-groups", "customers.view"],
  ["/admin/pricing/new", "pricing.create"],
  ["/admin/pricing/quantity/new", "pricing.create"],
  ["/admin/pricing", "pricing.view"],
  ["/admin/coupons/new", "coupons.create"],
  ["/admin/coupons", "coupons.view"],
  ["/admin/pages/new", "pages.create"],
  ["/admin/pages", "pages.view"],
  ["/admin/posts/new", "posts.create"],
  ["/admin/posts", "posts.view"],
  ["/admin/media", "media.view"],
  ["/admin/menus/new", "menus.edit"],
  ["/admin/menus", "menus.view"],
  ["/admin/homepage", "homepage.view"],
  ["/admin/shipping/new", "shipping.manage"],
  ["/admin/shipping/rules/new", "shipping.manage"],
  ["/admin/shipping", "shipping.view"],
  ["/admin/delivery/new", "delivery.manage"],
  ["/admin/delivery", "delivery.view"],
  ["/admin/tax/rates/new", "taxes.manage"],
  ["/admin/tax", "taxes.view"],
  ["/admin/payments", "payments.view"],
  ["/admin/reminders/new", "reminders.manage"],
  ["/admin/reminders", "reminders.view"],
  ["/admin/emails", "emails.view"],
  ["/admin/reports", "reports.view"],
  ["/admin/settings/invoices", "invoices.manage"],
  ["/admin/settings", "company.view"],
  ["/admin/setup", "company.manage"],
  ["/admin/staff", "staff.view"],
  ["/admin/roles/new", "roles.manage"],
  ["/admin/roles", "roles.view"],
  ["/admin", "dashboard.view"],
];

const segments = (path: string) => path.split("?")[0].split("/").filter(Boolean);
const matches = (pattern: string[], path: string[], exact: boolean) => (exact ? path.length === pattern.length : path.length >= pattern.length) && pattern.every((p, i) => p === "*" || p === path[i]);

export function capabilityForPath(path: string) {
  const parts = segments(path);
  return ROUTES.map(([p, c]) => [segments(p), c] as const).filter(([p]) => matches(p, parts, false)).sort((a, b) => b[0].length - a[0].length)[0]?.[1];
}

export const canOpen = (capabilities: Iterable<string>, path: string) => {
  const needed = capabilityForPath(path);
  return !needed || new Set(capabilities).has(needed);
};

/**
 * Form pages a role can open to read but not change: without this capability the whole page is shown disabled. List
 * pages aren't here: their search and filters must keep working, so they hide their own write buttons. `null` marks a
 * page under a pattern that has nothing to save (a tester, for example).
 */
const WRITE_ROUTES: [string, string | null][] = [
  ["/admin/pages/*", "pages.edit"],
  ["/admin/posts/*", "posts.edit"],
  ["/admin/coupons/*", "coupons.edit"],
  ["/admin/pricing/test", null],
  ["/admin/pricing/quantity", null],
  ["/admin/pricing/*", "pricing.edit"],
  ["/admin/pricing/quantity/*", "pricing.edit"],
  ["/admin/menus/*", "menus.edit"],
  ["/admin/homepage", "homepage.edit"],
  ["/admin/shipping/preview", null],
  ["/admin/shipping/rules", null],
  ["/admin/shipping/*", "shipping.manage"],
  ["/admin/shipping/rules/*", "shipping.manage"],
  ["/admin/delivery/*", "delivery.manage"],
  ["/admin/reminders/*", "reminders.manage"],
  ["/admin/emails/logs", null],
  ["/admin/emails/*", "emails.manage"],
  ["/admin/tax/preview", null],
  ["/admin/tax/rates/*", "taxes.manage"],
  ["/admin/payments/*", "payments.manage"],
  ["/admin/settings", "company.manage"],
  ["/admin/settings/company", "company.manage"],
];

/** The capability that makes this form page editable, if it is one. A "new" page has its own create capability. */
export function writeCapabilityForPath(path: string) {
  const parts = segments(path);
  if (parts.at(-1) === "new") return undefined;
  const found = WRITE_ROUTES.map(([p, c]) => [segments(p), c] as const).filter(([p]) => matches(p, parts, true));
  // A literal match beats one with a wildcard.
  const best = found.find(([p]) => !p.includes("*")) ?? found[0];
  return best?.[1] ?? undefined;
}

// --- Rules that protect against lockout and privilege escalation ------------------------------

export function validateRole(input: { name: string; capabilities: string[] }, takenName: (name: string) => boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = input.name.trim();
  if (name.length < 2) errors.name = "Enter a role name.";
  else if (name.length > 60) errors.name = "Keep it under 60 characters.";
  else if (takenName(name)) errors.name = "Another role already uses this name.";
  if (input.capabilities.some((c) => !ALL_CAPABILITIES.includes(c))) errors.capabilities = "Unknown permission.";
  return errors;
}

/** You can't hand out a capability you don't have yourself, in a role or by assigning a role to someone. */
export const escalatedCapabilities = (wanted: string[], actor: Iterable<string>) => {
  const have = new Set(actor);
  return wanted.filter((c) => !have.has(c));
};

export function roleEditError(roleId: string, next: string[]) {
  if (roleId === ADMIN_ROLE_ID && ALL_CAPABILITIES.some((c) => !next.includes(c))) return "The Administrator role always keeps every permission.";
  return undefined;
}

/** Saving your own role without "Manage roles" would lock you out of the screen you'd need to undo it. */
export function selfLockoutError(roleId: string, next: string[], actorRoleId: string | undefined) {
  if (roleId === actorRoleId && !next.includes("roles.manage")) return "You're using this role right now. Removing \"Manage roles\" would lock you out of this screen, so it can't be saved. Ask an administrator to change it.";
  return undefined;
}

/** You can't change or remove someone who has more permissions than you. */
export function staffTargetError(targetCapabilities: string[], actor: Iterable<string>) {
  return escalatedCapabilities(targetCapabilities, actor).length ? "This person has permissions you don't have, so you can't change their account." : undefined;
}

export function roleDeleteError(role: { id: string; system: boolean; name: string }, staffUsing: number) {
  if (role.system) return "Built-in roles can't be deleted. Duplicate one to make your own.";
  if (staffUsing > 0) return `${staffUsing} staff member${staffUsing === 1 ? " has" : "s have"} this role. Change ${staffUsing === 1 ? "it" : "them"} first.`;
  return undefined;
}

/** A change that would leave no active administrator is refused. */
export function staffChangeError(staff: { id: string; roleId: string; active: boolean }[], id: string | null, next: { roleId: string; active: boolean } | null) {
  const admins = staff.filter((s) => s.roleId === ADMIN_ROLE_ID && s.active && s.id !== id);
  const staysAdmin = next && next.roleId === ADMIN_ROLE_ID && next.active;
  if (!admins.length && !staysAdmin) return "There must always be at least one active administrator.";
  return undefined;
}
