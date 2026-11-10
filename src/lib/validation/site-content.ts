/** Homepage and About content validation, shared by the admin form and the mock. */
import type { CtaLink, HomeSection, SiteContentInput } from "../types/content.ts";

type Errors = Record<string, string>;

const SAFE_LINK = /^(?:https?:\/\/\S+|\/(?!\/)\S*|#\S*)$/;

function cta(errors: Errors, key: string, link: CtaLink) {
  if (!link.label.trim()) errors[`${key}.label`] = "Enter the button text.";
  if (!SAFE_LINK.test(link.href.trim())) errors[`${key}.href`] = "Use a link like /shop or https://example.com.";
}

function section(errors: Errors, s: HomeSection) {
  const k = `section.${s.id}`;
  const need = (field: string, value: string) => {
    if (!value.trim()) errors[`${k}.${field}`] = "This can't be empty.";
  };
  switch (s.type) {
    case "hero":
      if (s.enabled && !s.slides.length) errors[`${k}.slides`] = "Add at least one slide, or turn this section off.";
      s.slides.forEach((slide, i) => {
        need(`slides.${i}.title`, slide.title);
        cta(errors, `${k}.slides.${i}.cta`, slide.cta);
        if (slide.secondaryCta) cta(errors, `${k}.slides.${i}.secondaryCta`, slide.secondaryCta);
      });
      return;
    case "categories":
    case "featuredProducts":
    case "journal":
    case "brands":
      need("title", s.title);
      if (!Number.isInteger(s.max) || s.max < 1 || s.max > 24) errors[`${k}.max`] = "Show between 1 and 24.";
      return;
    case "business":
    case "promo":
      need("title", s.title);
      cta(errors, `${k}.cta`, s.cta);
      return;
    case "contact":
      need("title", s.title);
      cta(errors, `${k}.cta`, s.cta);
      return;
    case "quickOrder":
    case "delivery":
    case "steps":
      need("title", s.title);
      return;
    case "benefits":
      return;
  }
}

export function validateSiteContent(input: SiteContentInput): Errors {
  const errors: Errors = {};
  if (input.topBar.length > 120) errors.topBar = "Keep it under 120 characters.";
  const ids = new Set<string>();
  for (const s of input.sections) {
    if (ids.has(s.id)) errors.sections = "Each section can appear once.";
    ids.add(s.id);
    section(errors, s);
  }
  if (!input.about.title.trim()) errors["about.title"] = "Enter a heading.";
  return errors;
}
