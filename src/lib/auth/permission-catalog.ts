/**
 * The Role Editor's plain-language view of capabilities: every capability once, grouped by module, with an explanation a
 * non-technical administrator can act on. Pure and tested (tests/permission-catalog.test.ts).
 */
import { ALL_CAPABILITIES } from "./capabilities.ts";

export interface PermissionDefinition {
  id: string;
  label: string;
  description: string;
  /** Needed for this one to be useful. A module's "view" permission is added automatically. */
  requires?: string[];
  /** Money, personal data, or control over other staff. Shown with a badge so nobody ticks it by accident. */
  sensitive?: boolean;
}

export interface PermissionGroup {
  key: string;
  label: string;
  description: string;
  permissions: PermissionDefinition[];
}

const needsOrders = ["orders.view"];

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "The admin home page.",
    permissions: [{ id: "dashboard.view", label: "Open the dashboard", description: "See the admin home page. Sales figures on it also need \"View reports\"." }],
  },
  {
    key: "orders",
    label: "Orders",
    description: "Viewing, changing and refunding orders. Each permission works on its own.",
    permissions: [
      { id: "orders.view", label: "View orders", description: "See the orders list and open any order." },
      { id: "orders_create.create", label: "Create orders", description: "Place a new order for a customer or a walk-in buyer from the admin.", requires: needsOrders },
      { id: "orders_edit.edit", label: "Edit orders", description: "Change an order's delivery date and shipping charge, add notes, and record payments received.", requires: needsOrders },
      { id: "orders.delete", label: "Delete eligible orders", description: "Permanently delete a cancelled order with no payment, refund or invoice on it. Other orders can't be deleted.", requires: needsOrders, sensitive: true },
      { id: "order_items.edit", label: "Add or remove order products", description: "Add, remove or replace products on an order.", requires: needsOrders },
      { id: "order_quantities.edit", label: "Change order quantities", description: "Change how many of a product are on an order.", requires: needsOrders },
      { id: "order_prices.edit", label: "Change order prices", description: "Set the agreed unit price on an order line. The catalog price stays the same.", requires: needsOrders, sensitive: true },
      { id: "order_discounts.edit", label: "Apply order discounts", description: "Add, change or remove a discount on a whole order.", requires: needsOrders, sensitive: true },
      { id: "delivered_weight.edit", label: "Adjust delivered weights", description: "Record the weight actually packed, which can change what the customer pays.", requires: needsOrders },
      { id: "order_status.edit", label: "Update order status", description: "Move an order to its next status, or cancel it.", requires: needsOrders },
      { id: "order_addresses.edit", label: "Change billing and shipping information", description: "Edit the billing and delivery addresses saved on an order.", requires: needsOrders },
      { id: "order_stock.edit", label: "Change global product stock from order details", description: "Change a product's stock from an order page. This updates stock across the whole site, not only this order.", requires: needsOrders, sensitive: true },
      { id: "refunds.view", label: "See refunds", description: "See the refunds recorded on an order.", requires: needsOrders },
      { id: "refunds.refund", label: "Process refunds", description: "Record a refund on an order. In this demo no money moves; a real payment backend would return it.", requires: needsOrders, sensitive: true },
      { id: "orders.export", label: "Export orders", description: "Download the orders list as a spreadsheet. It contains customer names and contact details.", sensitive: true },
    ],
  },
  {
    key: "products",
    label: "Products",
    description: "The product catalog, categories and brands.",
    permissions: [
      { id: "products.view", label: "View products", description: "See products, categories and brands in the admin." },
      { id: "products.create", label: "Add products", description: "Create new products, or duplicate existing ones." },
      { id: "products.edit", label: "Edit products", description: "Change product details, prices, photos, categories and brands." },
      { id: "products.delete", label: "Archive products", description: "Hide products from the store (history is kept) and delete brands." },
      { id: "products.export", label: "Export products", description: "Download the product list as a spreadsheet." },
    ],
  },
  {
    key: "inventory",
    label: "Inventory",
    description: "Stock levels and stock history.",
    permissions: [
      { id: "inventory.view", label: "View inventory", description: "See stock levels and the history of stock changes." },
      { id: "inventory.edit", label: "Adjust stock", description: "Change stock levels from the Inventory screen." },
    ],
  },
  {
    key: "customers",
    label: "Customers",
    description: "Customer accounts, groups and registration approval.",
    permissions: [
      { id: "customers.view", label: "View customers", description: "See customer accounts, their addresses and their customer groups." },
      { id: "customers.create", label: "Add customers", description: "Create a new customer account." },
      { id: "customers.edit", label: "Edit customers", description: "Change customer details and addresses, and manage customer groups." },
      { id: "customers.delete", label: "Delete customers", description: "Permanently delete a customer who has never placed an order. Others can only be suspended.", sensitive: true },
      { id: "customers.export", label: "Export customers", description: "Download the customer list as a spreadsheet. It contains personal contact details.", sensitive: true },
      { id: "customer_approval.view", label: "See registration requests", description: "See who has applied for a wholesale account, and open the identity documents they uploaded.", sensitive: true },
      { id: "customer_approval.approve", label: "Approve or reject customers", description: "Approve, reject, suspend or reinstate accounts. Approved customers can see wholesale prices.", sensitive: true },
    ],
  },
  {
    key: "pricing",
    label: "Wholesale Pricing",
    description: "Price rules and quantity limits. Rules are switched off rather than deleted.",
    permissions: [
      { id: "pricing.view", label: "View pricing rules", description: "See price rules and quantity limits, and use the price tester." },
      { id: "pricing.create", label: "Add pricing rules", description: "Create new price rules and quantity limits." },
      { id: "pricing.edit", label: "Edit pricing rules", description: "Change rules and switch them on or off. This changes what customers pay.", sensitive: true },
    ],
  },
  {
    key: "coupons",
    label: "Coupons",
    description: "Codes customers enter at the cart.",
    permissions: [
      { id: "coupons.view", label: "View coupons", description: "See coupons and how often they've been used." },
      { id: "coupons.create", label: "Add coupons", description: "Create new coupon codes." },
      { id: "coupons.edit", label: "Edit coupons", description: "Change coupons and switch them on or off." },
      { id: "coupons.delete", label: "Delete coupons", description: "Permanently delete coupons.", requires: ["coupons.edit"] },
    ],
  },
  {
    key: "quotations",
    label: "Quotations",
    description: "Price requests from customers.",
    permissions: [
      { id: "quotations.view", label: "View quotations", description: "See quotation requests and the quotes sent." },
      { id: "quotations.edit", label: "Reply to quotations", description: "Send prices to a customer, or decline a request." },
    ],
  },
  {
    key: "pages",
    label: "Website Pages",
    description: "Pages such as About or policies.",
    permissions: [
      { id: "pages.view", label: "View pages", description: "See the list of website pages and open them." },
      { id: "pages.create", label: "Add pages", description: "Create new pages." },
      { id: "pages.edit", label: "Edit and publish pages", description: "Change, publish or schedule pages." },
      { id: "pages.delete", label: "Delete pages", description: "Move pages to the trash, restore them, or delete them for good." },
    ],
  },
  {
    key: "posts",
    label: "Blog Posts",
    description: "Blog posts, categories and tags.",
    permissions: [
      { id: "posts.view", label: "View posts", description: "See the list of blog posts and open them." },
      { id: "posts.create", label: "Add posts", description: "Create new blog posts." },
      { id: "posts.edit", label: "Edit and publish posts", description: "Change, publish or schedule posts, and manage categories and tags." },
      { id: "posts.delete", label: "Delete posts", description: "Move posts to the trash, restore them, or delete them for good." },
    ],
  },
  {
    key: "media",
    label: "Media Library",
    description: "Uploaded images and documents.",
    permissions: [
      { id: "media.view", label: "Browse media", description: "See the media library and pick files from it." },
      { id: "media.create", label: "Upload files", description: "Add new images and documents." },
      { id: "media.edit", label: "Edit file details", description: "Change a file's title and description." },
      { id: "media.delete", label: "Delete files", description: "Remove files from the library." },
    ],
  },
  {
    key: "menus",
    label: "Header/Footer Menus",
    description: "The site's navigation menus.",
    permissions: [
      { id: "menus.view", label: "View menus", description: "See the header and footer menus." },
      { id: "menus.edit", label: "Edit menus", description: "Add, change, reorder and delete menus and their links." },
    ],
  },
  {
    key: "homepage",
    label: "Homepage Builder",
    description: "The sections on the home page.",
    permissions: [
      { id: "homepage.view", label: "View the homepage builder", description: "See the home page sections and their content." },
      { id: "homepage.edit", label: "Edit the homepage", description: "Change, reorder, show or hide home page sections." },
    ],
  },
  {
    key: "shipping",
    label: "Shipping",
    description: "Zones, rates, rules and pickup points.",
    permissions: [
      { id: "shipping.view", label: "View shipping", description: "See zones, rates and rules, and use the shipping calculator." },
      { id: "shipping.manage", label: "Change shipping", description: "Change zones, rates, rules, classes, pickup points and shipping settings." },
    ],
  },
  {
    key: "delivery",
    label: "Delivery Schedules",
    description: "Which days each area gets deliveries.",
    permissions: [
      { id: "delivery.view", label: "View delivery schedules", description: "See delivery days and order cut-offs." },
      { id: "delivery.manage", label: "Change delivery schedules", description: "Add, change and delete delivery schedules." },
    ],
  },
  {
    key: "reminders",
    label: "Reminders",
    description: "Messages to customers before delivery days.",
    permissions: [
      { id: "reminders.view", label: "View reminders", description: "See reminder campaigns and who they'd go to." },
      { id: "reminders.manage", label: "Change reminders", description: "Add, change and delete campaigns, and run a simulated send." },
    ],
  },
  {
    key: "taxes",
    label: "Taxes",
    description: "Tax settings and rates.",
    permissions: [
      { id: "taxes.view", label: "View taxes", description: "See tax settings and rates, and use the tax preview." },
      { id: "taxes.manage", label: "Change taxes", description: "Turn tax on or off, and change rates. This changes what customers pay.", sensitive: true },
    ],
  },
  {
    key: "payments",
    label: "Payments",
    description: "Which payment methods customers can choose.",
    permissions: [
      { id: "payments.view", label: "View payment settings", description: "See the payment methods and how they're set up." },
      { id: "payments.manage", label: "Change payment settings", description: "Turn payment methods on or off and change their details.", sensitive: true },
    ],
  },
  {
    key: "invoices",
    label: "Invoices",
    description: "Invoices on orders, and how they look.",
    permissions: [
      { id: "invoices.view", label: "View invoices", description: "Open and print the invoice for an order.", requires: needsOrders },
      { id: "invoices.create", label: "Issue invoices", description: "Issue an invoice, a revised invoice or a credit note for an order.", requires: needsOrders },
      { id: "invoices.manage", label: "Change invoice settings", description: "Change invoice numbering and what invoices show." },
    ],
  },
  {
    key: "emails",
    label: "Email Templates",
    description: "The emails the store would send, and the log of them.",
    permissions: [
      { id: "emails.view", label: "View email templates and logs", description: "See email templates and the log of simulated emails." },
      { id: "emails.manage", label: "Change email templates", description: "Change templates and the sender details, and retry failed emails." },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    description: "Sales and business reports.",
    permissions: [
      { id: "reports.view", label: "View reports", description: "See sales, customer and product reports, and sales figures on the dashboard.", sensitive: true },
      { id: "reports.export", label: "Export reports", description: "Download reports as spreadsheets.", sensitive: true },
    ],
  },
  {
    key: "company",
    label: "Company Settings",
    description: "Company details, branding and store settings.",
    permissions: [
      { id: "company.view", label: "View company settings", description: "See the company details, branding and store settings." },
      { id: "company.manage", label: "Change company settings", description: "Change the company's details, logo, colours, currency and store settings, and run the setup wizard.", sensitive: true },
    ],
  },
  {
    key: "staff",
    label: "Staff & Roles",
    description: "Who works in the admin, and what they can do.",
    permissions: [
      { id: "staff.view", label: "View staff", description: "See staff accounts and the role each person has." },
      { id: "staff.manage", label: "Manage staff", description: "Add and remove staff, and assign roles. You can't assign a role with more permissions than your own.", requires: ["roles.view"], sensitive: true },
      { id: "roles.view", label: "View roles", description: "See roles and what each one can do." },
      { id: "roles.manage", label: "Manage roles", description: "Create, edit and delete roles. You can't grant a permission you don't have yourself.", sensitive: true },
    ],
  },
];

const BY_ID = new Map(PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => [p.id, p] as const)));

export const permissionById = (id: string) => BY_ID.get(id);
export const permissionLabel = (id: string) => BY_ID.get(id)?.label ?? id;

/** What must also be on for this permission to be useful: its own requirements, plus its module's "view" permission. */
export function requirementsFor(id: string): string[] {
  const dot = id.lastIndexOf(".");
  const view = `${id.slice(0, dot)}.view`;
  const own = id !== view && ALL_CAPABILITIES.includes(view) ? [view] : [];
  return [...new Set([...own, ...(BY_ID.get(id)?.requires ?? [])])];
}

export interface PermissionWarning {
  /** The permission it's about, or the whole role. */
  id: string;
  tone: "dependency" | "conflict";
  message: string;
  /** Permissions that would resolve it. */
  fix?: string[];
}

/** Dependencies and odd combinations, in plain language. They warn but don't stop the save: the administrator decides. */
export function permissionWarnings(capabilities: Iterable<string>): PermissionWarning[] {
  const on = new Set(capabilities);
  if (!on.size) return [{ id: "role", tone: "conflict", message: "This role has no permissions, so staff with it can't open anything in the admin." }];
  const warnings: PermissionWarning[] = [];
  for (const group of PERMISSION_GROUPS) {
    for (const p of group.permissions) {
      if (!on.has(p.id)) continue;
      const missing = requirementsFor(p.id).filter((r) => !on.has(r));
      if (missing.length) warnings.push({ id: p.id, tone: "dependency", message: `"${p.label}" also needs ${missing.map((m) => `"${permissionLabel(m)}"`).join(" and ")}, or staff won't be able to reach it.`, fix: missing });
    }
  }
  if (on.has("order_stock.edit") && !on.has("inventory.edit")) warnings.push({ id: "order_stock.edit", tone: "conflict", message: `This role can't adjust stock in Inventory, but "${permissionLabel("order_stock.edit")}" still lets it change stock across the site from an order.` });
  if (!on.has("dashboard.view")) warnings.push({ id: "dashboard.view", tone: "conflict", message: "Without the dashboard, staff see Access denied on the admin home page and have to start from the sidebar.", fix: ["dashboard.view"] });
  return warnings;
}

/** Permissions on, per group, in catalog order: what a staff member can do. */
export function effectivePermissions(capabilities: Iterable<string>) {
  const on = new Set(capabilities);
  return PERMISSION_GROUPS.map((g) => ({ ...g, permissions: g.permissions.filter((p) => on.has(p.id)), total: g.permissions.length })).filter((g) => g.permissions.length);
}
