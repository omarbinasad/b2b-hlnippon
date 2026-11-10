import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ADMIN_ROLE_ID, ALL_CAPABILITIES, canOpen, capabilityForPath, DEFAULT_ROLES, escalatedCapabilities, roleDeleteError, roleEditError, staffChangeError, validateRole } from "../src/lib/auth/capabilities.ts";
import { inRange, reportBreakdowns, reportSummary, toCsv, type ReportOrder } from "../src/lib/reports/aggregate.ts";

const role = (id: string) => DEFAULT_ROLES.find((r) => r.id === id)!;

describe("capabilities", () => {
  it("every default role uses known capabilities, and admin has them all", () => {
    for (const r of DEFAULT_ROLES) for (const c of r.capabilities) assert.ok(ALL_CAPABILITIES.includes(c), `${r.name}: ${c}`);
    assert.deepEqual(role(ADMIN_ROLE_ID).capabilities, ALL_CAPABILITIES);
  });
  it("the most specific route wins", () => {
    assert.equal(capabilityForPath("/admin/orders/new"), "orders_create.create");
    assert.equal(capabilityForPath("/admin/orders/ord-1"), "orders.view");
    assert.equal(capabilityForPath("/admin/customers/requests"), "customer_approval.view");
    assert.equal(capabilityForPath("/admin/customers/cus-1"), "customers.view");
    assert.equal(capabilityForPath("/admin"), "dashboard.view");
    assert.equal(capabilityForPath("/admin/orders?status=open"), "orders.view");
  });
  it("roles open only what they should", () => {
    const content = role("role-content").capabilities;
    assert.ok(canOpen(content, "/admin/pages") && !canOpen(content, "/admin/orders") && !canOpen(content, "/admin/settings"));
    const warehouse = role("role-warehouse").capabilities;
    assert.ok(canOpen(warehouse, "/admin/inventory") && canOpen(warehouse, "/admin/orders") && !canOpen(warehouse, "/admin/orders/new") && !canOpen(warehouse, "/admin/pricing"));
    const manager = role("role-shop-manager").capabilities;
    assert.ok(canOpen(manager, "/admin/pricing") && !canOpen(manager, "/admin/staff") && !canOpen(manager, "/admin/roles"));
  });
  it("keeps what each default role could do before the permissions were split", () => {
    const warehouse = role("role-warehouse").capabilities;
    assert.ok(warehouse.includes("delivered_weight.edit") && warehouse.includes("order_stock.edit"));
    assert.ok(!warehouse.includes("refunds.refund") && !warehouse.includes("order_prices.edit") && !warehouse.includes("order_status.edit"));
    const support = role("role-support").capabilities;
    assert.ok(support.includes("order_status.edit") && support.includes("order_addresses.edit") && !support.includes("order_prices.edit") && !support.includes("refunds.refund"));
  });
});

describe("role protections", () => {
  it("validates names and permissions", () => {
    const free = () => false;
    assert.ok(validateRole({ name: " ", capabilities: [] }, free).name);
    assert.ok(validateRole({ name: "Dup", capabilities: [] }, () => true).name);
    assert.ok(validateRole({ name: "OK", capabilities: ["made.up"] }, free).capabilities);
    assert.deepEqual(validateRole({ name: "OK", capabilities: ["orders.view"] }, free), {});
  });
  it("Administrator always keeps everything", () => {
    assert.ok(roleEditError(ADMIN_ROLE_ID, ["orders.view"]));
    assert.equal(roleEditError(ADMIN_ROLE_ID, ALL_CAPABILITIES), undefined);
    assert.equal(roleEditError("role-x", []), undefined);
  });
  it("built-in roles and roles in use can't be deleted", () => {
    assert.ok(roleDeleteError({ id: "a", system: true, name: "A" }, 0));
    assert.match(roleDeleteError({ id: "a", system: false, name: "A" }, 2)!, /2 staff/);
    assert.equal(roleDeleteError({ id: "a", system: false, name: "A" }, 0), undefined);
  });
  it("nobody can grant what they don't have", () => {
    assert.deepEqual(escalatedCapabilities(["a", "b"], ["a"]), ["b"]);
  });
  it("the last active administrator can't be removed, demoted or deactivated", () => {
    const staff = [{ id: "1", roleId: ADMIN_ROLE_ID, active: true }, { id: "2", roleId: "role-content", active: true }];
    assert.ok(staffChangeError(staff, "1", null));
    assert.ok(staffChangeError(staff, "1", { roleId: "role-content", active: true }));
    assert.ok(staffChangeError(staff, "1", { roleId: ADMIN_ROLE_ID, active: false }));
    assert.equal(staffChangeError(staff, "1", { roleId: ADMIN_ROLE_ID, active: true }), undefined);
    assert.equal(staffChangeError(staff, "2", null), undefined);
    assert.equal(staffChangeError([...staff, { id: "3", roleId: ADMIN_ROLE_ID, active: true }], "1", null), undefined);
  });
});

const order = (p: Partial<ReportOrder> = {}): ReportOrder => ({
  customerId: "c1",
  customerName: "One",
  status: "delivered",
  placedAt: "2026-06-10T10:00:00+09:00",
  items: [{ productId: "p1", name: "Rice", quantity: 2, lineTotal: 1000 }],
  totals: { total: 1200, itemsTotal: 1000, discountTotal: 100, refundedTotal: 0, netTotal: 1200, shippingTotal: 200, taxTotal: 0 },
  shippingAddress: { prefecture: "Tokyo" },
  ...p,
});
const JUNE = { from: "2026-06-01", to: "2026-06-30" };

describe("reports", () => {
  it("sums sales and leaves out cancelled orders", () => {
    const s = reportSummary([order(), order({ status: "cancelled" })], JUNE);
    assert.deepEqual([s.orders, s.totalSales, s.netSales, s.averageOrderValue, s.discounts, s.shipping], [1, 1200, 1000, 1000, 100, 200]);
  });
  it("keeps to the date range, inclusive", () => {
    assert.ok(inRange(order({ placedAt: "2026-06-30T23:00:00+09:00" }), JUNE));
    assert.ok(!inRange(order({ placedAt: "2026-07-01T00:00:00+09:00" }), JUNE));
    assert.equal(reportSummary([order({ placedAt: "2026-05-31T10:00:00+09:00" })], JUNE).orders, 0);
  });
  it("tells new customers from returning ones using earlier orders", () => {
    const earlier = order({ placedAt: "2026-05-01T10:00:00+09:00" });
    assert.deepEqual([reportSummary([order()], JUNE).newCustomers, reportSummary([order()], JUNE).returningCustomers], [1, 0]);
    const s = reportSummary([earlier, order()], JUNE);
    assert.deepEqual([s.newCustomers, s.returningCustomers, s.repeatOrders], [0, 1, 1]);
  });
  it("counts a second order in the range as a repeat, not a third customer", () => {
    const s = reportSummary([order(), order({ placedAt: "2026-06-20T10:00:00+09:00" })], JUNE);
    assert.deepEqual([s.orders, s.customers, s.newCustomers, s.repeatOrders], [2, 1, 1, 1]);
  });
  it("breakdowns add up to net sales", () => {
    const orders = [order(), order({ customerId: "c2", customerName: "Two", items: [{ productId: "p2", name: "Oil", quantity: 1, lineTotal: 500 }], totals: { ...order().totals, itemsTotal: 500 }, shippingAddress: { prefecture: "Osaka" } })];
    const b = reportBreakdowns(orders, JUNE, { categoryOf: (id) => (id === "p1" ? "Grain" : "Cooking"), groupOf: () => "Retail" });
    const total = reportSummary(orders, JUNE).netSales;
    for (const rows of [b.topProducts, b.categories, b.topCustomers, b.groups, b.locations, b.monthly]) assert.equal(rows.reduce((n, r) => n + r.sales, 0), total);
    assert.equal(b.topProducts[0].label, "Rice");
    assert.equal(b.topProducts[0].units, 2);
    assert.deepEqual(b.locations.map((l) => l.label), ["Tokyo", "Osaka"]);
  });
  it("counts cancelled orders only in the status report", () => {
    const b = reportBreakdowns([order({ status: "cancelled" })], JUNE, { categoryOf: () => "", groupOf: () => "" });
    assert.deepEqual(b.statuses, [{ status: "cancelled", count: 1 }]);
    assert.deepEqual(b.topProducts, []);
  });
});

describe("CSV", () => {
  it("quotes where needed", () => {
    assert.equal(toCsv(["a", "b"], [["x,y", 'q"r'], [1, undefined]]), 'a,b\r\n"x,y","q""r"\r\n1,');
  });
  it("neutralises spreadsheet formulas in text, not numbers", () => {
    assert.equal(toCsv(["a"], [["=SUM(A1)"]]).split("\r\n")[1], "'=SUM(A1)");
    assert.equal(toCsv(["a"], [["@cmd"]]).split("\r\n")[1], "'@cmd");
    assert.equal(toCsv(["a"], [[-5]]).split("\r\n")[1], "-5");
  });
});
