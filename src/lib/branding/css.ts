/**
 * Turns company branding into CSS variable overrides for the design tokens in globals.css. Pure and tested.
 * A value left at the sample default emits nothing, so the hand-tuned default theme stays exact. Colors are validated
 * before saving and re-checked here, because the result is written into a <style> tag.
 */
import { SAMPLE_COMPANY } from "../../config/sample-company.ts";
import type { CompanyBranding } from "../types/company.ts";

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Fonts loaded by the root layout, with the CSS variable each one sets. */
export const FONT_OPTIONS = [
  { name: "Inter", variable: "--font-inter" },
  { name: "Roboto", variable: "--font-roboto" },
  { name: "Poppins", variable: "--font-poppins" },
  { name: "Merriweather", variable: "--font-merriweather" },
  { name: "Noto Sans JP", variable: "--font-noto-jp" },
] as const;

const BUTTON_RADIUS: Record<CompanyBranding["buttonStyle"], string> = { rounded: "var(--radius)", pill: "9999px", square: "0.25rem" };

function luminance(hex: string) {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Black or white, whichever reads better on the color. */
export const contrastOn = (hex: string) => (luminance(hex) > 0.179 ? "#000000" : "#ffffff");

const mix = (a: string, percent: number, b: string) => `color-mix(in srgb, ${a} ${percent}%, ${b})`;
const block = (selector: string, vars: Record<string, string>) => {
  const entries = Object.entries(vars);
  return entries.length ? `${selector}{${entries.map(([k, v]) => `${k}:${v}`).join(";")}}` : "";
};
const font = (name: string) => FONT_OPTIONS.find((f) => f.name === name)?.variable;

export function brandCss(b: CompanyBranding): string {
  const base = SAMPLE_COMPANY.branding;
  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};

  if (HEX_COLOR.test(b.primaryColor) && b.primaryColor.toLowerCase() !== base.primaryColor) {
    const c = b.primaryColor;
    Object.assign(light, {
      "--brand": c,
      "--brand-hover": mix(c, 80, "black"),
      "--brand-soft": mix(c, 12, "white"),
      "--brand-contrast": contrastOn(c),
      "--chart-current": c,
      "--status-delivered": c,
    });
    // A dark page needs a lighter version of the color to stay readable.
    const lifted = mix(c, 60, "white");
    Object.assign(dark, {
      "--brand": lifted,
      "--brand-hover": mix(c, 40, "white"),
      "--brand-soft": mix(c, 25, "#0a0f0e"),
      "--brand-contrast": "#000000",
      "--chart-current": lifted,
      "--status-delivered": lifted,
    });
  }
  if (HEX_COLOR.test(b.secondaryColor) && b.secondaryColor.toLowerCase() !== base.secondaryColor) {
    const c = b.secondaryColor;
    const text = contrastOn(c);
    const surfaces = {
      "--sidebar": c,
      "--sidebar-foreground": mix(text, 78, c),
      "--sidebar-active": mix(c, 78, text),
      "--sidebar-active-foreground": text,
      "--hero-from": mix(c, 85, text),
      "--hero-to": mix(c, 70, "black"),
      "--hero-text": text,
      "--hero-muted": mix(text, 80, "transparent"),
      "--hero-tile": mix(text, 10, "transparent"),
    };
    Object.assign(light, surfaces);
    Object.assign(dark, { ...surfaces, "--sidebar": mix(c, 40, "#0a0f0e"), "--sidebar-active": mix(c, 70, "#0a0f0e"), "--sidebar-foreground": "#d5dcd9", "--sidebar-active-foreground": "#ffffff" });
  }
  if (HEX_COLOR.test(b.accentColor) && b.accentColor.toLowerCase() !== base.accentColor) {
    const c = b.accentColor;
    Object.assign(light, { "--cta-from": c, "--cta-to": mix(c, 50, "black"), "--hero-accent": mix(c, 45, "white") });
    Object.assign(dark, { "--cta-from": c, "--cta-to": mix(c, 50, "black"), "--hero-accent": mix(c, 45, "white") });
  }

  // Theme-independent values go on :root, which also wins over the base rule.
  const common: Record<string, string> = {};
  const bodyFont = font(b.bodyFont);
  const headingFont = font(b.headingFont);
  if (bodyFont && b.bodyFont !== base.bodyFont) common["--font-body"] = `var(${bodyFont})`;
  if (headingFont && b.headingFont !== base.headingFont) {
    common["--font-heading"] = `var(${headingFont})`;
    // The large display headings (home hero, About, articles) use the serif utility.
    common["--font-serif"] = `var(${headingFont})`;
  }
  if (b.buttonStyle !== base.buttonStyle && BUTTON_RADIUS[b.buttonStyle]) common["--button-radius"] = BUTTON_RADIUS[b.buttonStyle];

  return [
    block(":root", common),
    block(`:root:not([data-theme="dark"])`, light),
    block(`:root[data-theme="dark"]`, dark),
  ].join("");
}
