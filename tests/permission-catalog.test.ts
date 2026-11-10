import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ADMIN_ROLE_ID, ALL_CAPABILITIES, capabilityForPath, DEFAULT_ROLES, selfLockoutError, staffTargetError, upgradeCapabilities, writeCapabilityForPath } from "../src/lib/auth/capabilities.ts";
import { effectivePermissions, PERMISSION_GROUPS, permissionWarnings, requirementsFor } from "../src/lib/auth/permission-catalog.ts";

const ids = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.id));

describe("permission catalog", () => {
  it("lists every capability exactly once", () => {
    assert.deepEqual([...ids].sort(), [...ALL_CAPABILITIES].sort());
    assert.equal(new Set(ids).size, ids.length);
  });
  it("has the groups the Role Editor promises, in order", () => {
    assert.deepEqual(PERMISSION_GROUPS.map((g) => g.label), ["Dashboard", "Orders", "Products", "Inventory", "Customers", "Wholesale Pricing", "Coupons", "Quotations", "Website Pages", "Blog Posts", "Media Library", "Header/Footer Menus", "Homepage Builder", "Shipping", "Delivery Schedules", "Reminders", "Taxes", "Payments", "Invoices", "Email Templates", "Reports", "Company Settings", "Staff & Roles"]);
  });
  it("gives every order action its own permission", () => {
    const orders = PERMISSION_GROUPS.find((g) => g.key === "orders")!.permissions.map((p) => p.label);
    for (const label of ["View orders", "Create orders", "Edit orders", "Delete eligible orders", "Add or remove order products", "Change order quantities", "Change order prices", "Apply order discounts", "Adjust delivered weights", "Update order status", "Change billing and shipping information", "Change global product stock from order details", "Process refunds", "Export orders"]) assert.ok(orders.includes(label), label);
  });
  it("explains every permission", () => {
    for (const g of PERMISSION_GROUPS) for (const p of g.permissions) assert.ok(p.label.length > 3 && p.description.length > 15, p.id);
  });
  it("only requires permissions that exist", () => {
    for (const id of ids) for (const r of requirementsFor(id)) assert.ok(ALL_CAPABILITIES.includes(r), `${id} needs ${r}`);
  });
});

describe("permission warnings", () => {
  it("warns when a permission's dependency is off, and offers the fix", () => {
    const w = permissionWarnings(["dashboard.view", "refunds.refund"]);
    const refund = w.find((x) => x.id === "refunds.refund")!;
    assert.equal(refund.tone, "dependency");
    assert.deepEqual([...refund.fix!].sort(), ["orders.view", "refunds.view"]);
  });
  it("is quiet once the dependency is on", () => {
    assert.deepEqual(permissionWarnings(["dashboard.view", "orders.view", "refunds.view", "refunds.refund"]), []);
  });
  it("flags an empty role and a missing dashboard", () => {
    assert.match(permissionWarnings([])[0].message, /no permissions/);
    assert.ok(permissionWarnings(["orders.view"]).some((w) => w.id === "dashboard.view"));
  });
  it("flags changing site-wide stock from an order without inventory rights", () => {
    assert.ok(permissionWarnings(["dashboard.view", "orders.view", "order_stock.edit"]).some((w) => w.tone === "conflict" && w.id === "order_stock.edit"));
  });
  it("the default templates need no warnings apart from known combinations", () => {
    for (const r of DEFAULT_ROLES) assert.deepEqual(permissionWarnings(r.capabilities).filter((w) => w.tone === "dependency"), [], r.name);
  });
});

describe("upgrading stored roles", () => {
  it("hands out the finer permissions a broad one already covered", () => {
    const up = upgradeCapabilities(["orders.view", "orders_edit.edit", "inventory.edit"]);
    for (const c of ["order_items.edit", "order_quantities.edit", "order_status.edit", "order_addresses.edit", "order_stock.edit", "quotations.view", "quotations.edit", "invoices.view"]) assert.ok(up.includes(c), c);
  });
  it("doesn't widen a narrow role", () => {
    assert.deepEqual(upgradeCapabilities(["pages.view"]), ["pages.view"]);
  });
  it("drops a retired permission", () => {
    assert.ok(!upgradeCapabilities(["pricing.view", "pricing.delete"]).includes("pricing.delete"));
  });
  it("only produces known permissions", () => {
    for (const c of upgradeCapabilities(ALL_CAPABILITIES)) assert.ok(ALL_CAPABILITIES.includes(c), c);
  });
});

describe("safeguards", () => {
  it("stops you removing Manage roles from the role you're using", () => {
    assert.ok(selfLockoutError("r1", ["orders.view"], "r1"));
    assert.equal(selfLockoutError("r1", ["roles.manage"], "r1"), undefined);
    assert.equal(selfLockoutError("r1", ["orders.view"], "r2"), undefined);
  });
  it("stops you changing someone with more permissions than you", () => {
    assert.ok(staffTargetError(["a", "b"], ["a"]));
    assert.equal(staffTargetError(["a"], ["a", "b"]), undefined);
  });
  it("Administrator has everything, new permissions included", () => {
    const admin = DEFAULT_ROLES.find((r) => r.id === ADMIN_ROLE_ID)!;
    for (const c of ["orders.delete", "order_status.edit", "quotations.edit"]) assert.ok(admin.capabilities.includes(c));
  });
});

describe("routes", () => {
  it("guards create and edit pages, not only the list", () => {
    assert.equal(capabilityForPath("/admin/products/sp-1/edit"), "products.edit");
    assert.equal(capabilityForPath("/admin/products/new"), "products.create");
    assert.equal(capabilityForPath("/admin/products"), "products.view");
    assert.equal(capabilityForPath("/admin/orders/ord-1/invoice"), "invoices.view");
    assert.equal(capabilityForPath("/admin/customers/cus-1/edit"), "customers.edit");
    assert.equal(capabilityForPath("/admin/quotations"), "quotations.view");
    assert.equal(capabilityForPath("/admin/staff/staff-1"), "staff.view");
  });
  it("marks read-only form pages, but never lists or testers", () => {
    assert.equal(writeCapabilityForPath("/admin/shipping/classes"), "shipping.manage");
    assert.equal(writeCapabilityForPath("/admin/pages/p-1"), "pages.edit");
    assert.equal(writeCapabilityForPath("/admin/pricing/quantity/q-1"), "pricing.edit");
    assert.equal(writeCapabilityForPath("/admin/homepage"), "homepage.edit");
    assert.equal(writeCapabilityForPath("/admin/pricing/quantity"), undefined);
    assert.equal(writeCapabilityForPath("/admin/pricing/test"), undefined);
    assert.equal(writeCapabilityForPath("/admin/shipping/preview"), undefined);
    assert.equal(writeCapabilityForPath("/admin/emails/logs"), undefined);
    assert.equal(writeCapabilityForPath("/admin/pages/new"), undefined);
    assert.equal(writeCapabilityForPath("/admin/orders"), undefined);
  });
});

describe("effective permissions", () => {
  it("groups what's on and leaves out empty groups", () => {
    const e = effectivePermissions(["orders.view", "refunds.refund", "pages.view"]);
    assert.deepEqual(e.map((g) => g.key), ["orders", "pages"]);
    assert.deepEqual(e[0].permissions.map((p) => p.id), ["orders.view", "refunds.refund"]);
  });
});
