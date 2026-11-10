import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { company, setCompany } from "../src/config/runtime.ts";
import { SAMPLE_COMPANY } from "../src/config/sample-company.ts";
import { brandCss, contrastOn } from "../src/lib/branding/css.ts";
import { isPhone, isPostcode, normalizePostcode } from "../src/lib/customers/contact.ts";
import { applyCountry } from "../src/lib/locale-presets.ts";
import { addressLabels, isKnownRegion, regionNames } from "../src/lib/locations.ts";
import { fromMinor, toMinor } from "../src/lib/orders/calc.ts";
import type { CompanySettings, CompanySettingsInput } from "../src/lib/types/company.ts";
import { validateCompanySettings } from "../src/lib/validation/company.ts";

const withLocale = (locale: Partial<CompanySettings["locale"]>): CompanySettings => ({ ...SAMPLE_COMPANY, locale: { ...SAMPLE_COMPANY.locale, ...locale } });
const input = (patch: Partial<CompanySettingsInput> = {}): CompanySettingsInput => {
  return { ...SAMPLE_COMPANY, ...patch };
};

afterEach(() => setCompany(SAMPLE_COMPANY));

describe("company validation", () => {
  it("accepts the sample company", () => {
    assert.deepEqual(validateCompanySettings(input()), {});
  });
  it("requires names and a valid contact", () => {
    const e = validateCompanySettings(input({ companyName: " ", storeName: "", contact: { ...SAMPLE_COMPANY.contact, email: "nope", phone: "abc" } }));
    assert.ok(e.companyName && e.storeName && e["contact.email"] && e["contact.phone"]);
  });
  it("rejects a color that is not #rrggbb, which would reach a style tag", () => {
    const e = validateCompanySettings(input({ branding: { ...SAMPLE_COMPANY.branding, primaryColor: "red;}body{display:none" } }));
    assert.ok(e["branding.primaryColor"]);
  });
  it("rejects fonts off the list, bad time zones and insecure social links", () => {
    const e = validateCompanySettings(
      input({
        branding: { ...SAMPLE_COMPANY.branding, bodyFont: "Comic" },
        locale: { ...SAMPLE_COMPANY.locale, timeZone: "Mars/Olympus" },
        contact: { ...SAMPLE_COMPANY.contact, social: [{ network: "x", url: "javascript:alert(1)" }] },
      }),
    );
    assert.ok(e["branding.bodyFont"] && e["locale.timeZone"] && e["contact.social.0"]);
  });
  it("checks the address against the country being saved", () => {
    const bd = input({
      locale: { ...SAMPLE_COMPANY.locale, country: "BD" },
      contact: { ...SAMPLE_COMPANY.contact, phone: "01712-345678", address: { ...SAMPLE_COMPANY.contact.address, prefecture: "Dhaka", postalCode: "1207", country: "BD" } },
    });
    assert.deepEqual(validateCompanySettings(bd), {});
    const stillJapan = input({ locale: { ...SAMPLE_COMPANY.locale, country: "BD" } });
    const e = validateCompanySettings(stillJapan);
    assert.ok(e["contact.phone"] && e["contact.address.prefecture"] && e["contact.address.postalCode"]);
  });
});

describe("address rules follow the store country", () => {
  it("uses Japanese rules for the sample", () => {
    assert.equal(addressLabels().region, "Prefecture");
    assert.equal(regionNames().length, 47);
    assert.ok(isPhone("03-1234-5678") && !isPhone("+1 555 123 4567"));
    assert.equal(normalizePostcode("1000001"), "100-0001");
  });
  it("switches when the country changes", () => {
    setCompany(withLocale({ country: "BD" }));
    assert.equal(addressLabels().region, "Division");
    assert.ok(regionNames().includes("Dhaka"));
    assert.ok(isPostcode("1207") && !isPostcode("100-0001"));
    assert.ok(isPhone("01712-345678") && !isPhone("03-1234-5678"));
    assert.equal(normalizePostcode("1207"), "1207");
  });
  it("a country without a list takes free text and generic formats", () => {
    setCompany(withLocale({ country: "DE" }));
    assert.equal(regionNames().length, 0);
    assert.ok(isKnownRegion("Bavaria") && !isKnownRegion(" "));
    assert.ok(isPhone("+49 30 123456") && isPostcode("10115"));
  });
});

describe("money follows the configured decimals", () => {
  it("rounds to whole yen by default", () => {
    assert.equal(fromMinor(toMinor(1234.5)), 1235);
  });
  it("keeps two decimals for a two-decimal currency", () => {
    setCompany(withLocale({ currencyCode: "USD", currencySymbol: "$", currencyDigits: 2 }));
    assert.equal(toMinor(12.345), 1235);
    assert.equal(fromMinor(1235), 12.35);
  });
});

describe("country presets", () => {
  it("fills suggestions without touching other settings", () => {
    const l = applyCountry(SAMPLE_COMPANY.locale, "BD");
    assert.equal(l.currencyCode, "BDT");
    assert.equal(l.currencyDigits, 2);
    assert.equal(l.timeZone, "Asia/Dhaka");
    assert.equal(l.weightUnit, SAMPLE_COMPANY.locale.weightUnit);
  });
  it("keeps current values for a country without a preset", () => {
    const l = applyCountry(SAMPLE_COMPANY.locale, "DE");
    assert.equal(l.country, "DE");
    assert.equal(l.currencyCode, "JPY");
  });
});

describe("branding CSS", () => {
  it("emits nothing for the sample, so the tuned theme stays exact", () => {
    assert.equal(brandCss(SAMPLE_COMPANY.branding), "");
  });
  it("overrides only what changed, in both themes", () => {
    const css = brandCss({ ...SAMPLE_COMPANY.branding, primaryColor: "#1d4ed8" });
    assert.match(css, /:root:not\(\[data-theme="dark"\]\)\{--brand:#1d4ed8/);
    assert.match(css, /:root\[data-theme="dark"\]\{--brand:color-mix/);
    assert.ok(!css.includes("--sidebar") && !css.includes("--cta-from"));
  });
  it("drops an invalid color rather than writing it", () => {
    const css = brandCss({ ...SAMPLE_COMPANY.branding, primaryColor: "</style><script>" });
    assert.ok(!css.includes("script"));
  });
  it("sets font and button overrides", () => {
    const css = brandCss({ ...SAMPLE_COMPANY.branding, bodyFont: "Poppins", headingFont: "Merriweather", buttonStyle: "pill" });
    assert.match(css, /--font-body:var\(--font-poppins\)/);
    assert.match(css, /--font-heading:var\(--font-merriweather\)/);
    assert.match(css, /--button-radius:9999px/);
  });
  it("picks readable text", () => {
    assert.equal(contrastOn("#000000"), "#ffffff");
    assert.equal(contrastOn("#ffffff"), "#000000");
  });
});

describe("runtime", () => {
  it("starts from the sample company", () => {
    assert.equal(company().locale.currencyCode, "JPY");
  });
});
