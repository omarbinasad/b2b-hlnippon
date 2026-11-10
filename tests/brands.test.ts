import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateBrand } from "../src/lib/validation/brand.ts";

const valid = { name: "Example", logo: null, showOnHome: true, displayOrder: 10 };
const free = () => false;

describe("brand validation", () => {
  it("accepts a brand with or without a logo", () => {
    assert.deepEqual(validateBrand(valid, free), {});
    assert.deepEqual(validateBrand({ ...valid, logo: { src: "/media/abc", alt: "", width: 10, height: 10 } }, free), {});
  });
  it("needs a unique name of a sensible length", () => {
    assert.ok(validateBrand({ ...valid, name: "  " }, free).name);
    assert.ok(validateBrand({ ...valid, name: "x".repeat(61) }, free).name);
    assert.ok(validateBrand(valid, () => true).name);
  });
  it("refuses unsafe logo addresses", () => {
    for (const src of ["javascript:alert(1)", "//evil.example/x.png", "http://example.com/x.png"]) {
      assert.ok(validateBrand({ ...valid, logo: { src, alt: "", width: 1, height: 1 } }, free).logo, src);
    }
  });
  it("needs a whole display order in range", () => {
    for (const displayOrder of [Number.NaN, -1, 1.5, 10000]) assert.ok(validateBrand({ ...valid, displayOrder }, free).displayOrder, String(displayOrder));
  });
});
