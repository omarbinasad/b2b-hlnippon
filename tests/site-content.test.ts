import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PRODUCT_BADGE_LIMIT, validateSiteContent } from "../src/lib/validation/site-content.ts";
import type { SiteContentInput } from "../src/lib/types/index.ts";

const base = (over: Partial<SiteContentInput> = {}): SiteContentInput =>
  ({ topBar: "Welcome", sections: [], about: { title: "About us" }, ...over }) as unknown as SiteContentInput;

describe("product page badges", () => {
  it("are optional", () => {
    assert.deepEqual(validateSiteContent(base()), {});
    assert.deepEqual(validateSiteContent(base({ productBadges: [] })), {});
  });
  it("accept an icon with a short label", () => {
    assert.deepEqual(validateSiteContent(base({ productBadges: [{ icon: "truck", label: "Safe shipping" }] })), {});
  });
  it("need text, under 40 characters", () => {
    const e = validateSiteContent(base({ productBadges: [{ icon: "truck", label: " " }, { icon: "award", label: "x".repeat(41) }] }));
    assert.match(e["productBadges.0.label"], /Enter the text/);
    assert.match(e["productBadges.1.label"], /under 40/);
  });
  it(`allow at most ${PRODUCT_BADGE_LIMIT}`, () => {
    const many = Array.from({ length: PRODUCT_BADGE_LIMIT + 1 }, (_, i) => ({ icon: "truck", label: `Badge ${i}` }));
    assert.match(validateSiteContent(base({ productBadges: many })).productBadges, /at most/);
    assert.deepEqual(validateSiteContent(base({ productBadges: many.slice(0, PRODUCT_BADGE_LIMIT) })), {});
  });
});
