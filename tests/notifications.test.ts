import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { placeholdersIn, renderTemplate, validateTemplate } from "../src/lib/email/render.ts";
import { segmentRecipients } from "../src/lib/reminders/segment.ts";

const customer = (id: string, prefecture: string, extra = {}) => ({ id, companyName: id, email: `${id}@x.test`, status: "approved", addresses: [{ type: "shipping", prefecture, city: "City" }], ...extra });
const order = (customerId: string, prefecture: string, extra = {}) => ({ id: "o", number: `N-${customerId}`, customerId, status: "preparing" as const, paymentStatus: "unpaid" as const, requestedDeliveryDate: "2026-12-01T00:00:00+09:00", shippingAddress: { prefecture, city: "City" }, ...extra });
const DATE = "2026-12-01";

describe("reminder segments", () => {
  it("splits an area's customers by whether they have an order for that date", () => {
    const s = segmentRecipients([customer("a", "Tokyo"), customer("b", "Tokyo")], [order("a", "Tokyo")], ["Tokyo"], DATE);
    assert.deepEqual(s.withOrder.map((r) => r.customerId), ["a"]);
    assert.deepEqual(s.withOrder[0].orderNumbers, ["N-a"]);
    assert.deepEqual(s.withoutOrder.map((r) => r.customerId), ["b"]);
  });
  it("leaves out customers in other areas entirely", () => {
    const s = segmentRecipients([customer("osaka", "Osaka")], [order("osaka", "Osaka")], ["Tokyo"], DATE);
    assert.deepEqual([s.withOrder, s.withoutOrder, s.excluded], [[], [], []]);
  });
  it("sends one reminder when a customer has several addresses in the area", () => {
    const c = customer("a", "Tokyo", { addresses: [{ type: "shipping", prefecture: "Tokyo", city: "A" }, { type: "shipping", prefecture: "Tokyo", city: "B" }] });
    const s = segmentRecipients([c], [], ["Tokyo"], DATE);
    assert.equal(s.withoutOrder.length, 1);
  });
  it("uses delivery addresses, not billing ones", () => {
    const c = customer("a", "Tokyo", { addresses: [{ type: "billing", prefecture: "Tokyo", city: "A" }] });
    assert.equal(segmentRecipients([c], [], ["Tokyo"], DATE).withoutOrder.length, 0);
  });
  it("an order for another date, or a finished one, doesn't qualify", () => {
    assert.equal(segmentRecipients([customer("a", "Tokyo")], [order("a", "Tokyo", { requestedDeliveryDate: "2026-12-08T00:00:00+09:00" })], ["Tokyo"], DATE).withoutOrder.length, 1);
    assert.equal(segmentRecipients([customer("a", "Tokyo")], [order("a", "Tokyo", { status: "delivered" })], ["Tokyo"], DATE).withoutOrder.length, 1);
    assert.equal(segmentRecipients([customer("a", "Tokyo")], [order("a", "Tokyo", { status: "cancelled" })], ["Tokyo"], DATE).withoutOrder.length, 1);
  });
  it("an order with no date yet counts, so nobody is told they have no order", () => {
    assert.equal(segmentRecipients([customer("a", "Tokyo")], [order("a", "Tokyo", { requestedDeliveryDate: undefined })], ["Tokyo"], DATE).withOrder.length, 1);
  });
  it("an order going to a different area doesn't qualify", () => {
    assert.equal(segmentRecipients([customer("a", "Tokyo")], [order("a", "Osaka")], ["Tokyo"], DATE).withoutOrder.length, 1);
  });
  it("respects opt-out, missing email and account status", () => {
    const s = segmentRecipients([customer("out", "Tokyo", { remindersOptOut: true }), customer("none", "Tokyo", { email: undefined }), customer("pending", "Tokyo", { status: "pending" })], [], ["Tokyo"], DATE);
    assert.deepEqual(s.excluded.map((x) => x.reason), ["Turned off reminders", "No email address"]);
    assert.deepEqual([s.withOrder, s.withoutOrder], [[], []]);
  });
});

describe("email templates", () => {
  it("fills placeholders and leaves unknown ones visible", () => {
    assert.equal(renderTemplate("Hi {{ name }}, {{other}}", { name: "A" }), "Hi A, {{other}}");
  });
  it("escapes values in a message body, so customer data can't add markup", () => {
    assert.equal(renderTemplate("<p>{{name}}</p>", { name: "<script>x</script>" }, { html: true }), "<p>&lt;script&gt;x&lt;/script&gt;</p>");
  });
  it("lists placeholders once", () => {
    assert.deepEqual(placeholdersIn("{{a}} {{ b }} {{a}}"), ["a", "b"]);
  });
  it("refuses empty text and unknown placeholders", () => {
    assert.ok(validateTemplate({ subject: "", bodyHtml: "ok ok" }, []).subject);
    assert.match(validateTemplate({ subject: "Hi {{nope}}", bodyHtml: "ok" }, ["a"]).subject, /nope/);
    assert.match(validateTemplate({ subject: "Hi", bodyHtml: "{{nope}}" }, ["a"]).bodyHtml, /nope/);
    assert.deepEqual(validateTemplate({ subject: "Hi {{a}}", bodyHtml: "{{a}}" }, ["a"]), {});
  });
});
