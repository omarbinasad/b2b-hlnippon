import { DEMO_VIEW_COOKIE, DEMO_VIEWS, defaultDemoView, demoViewSwitcherEnabled } from "@/lib/auth/session";
import { DemoViewSelect } from "./demo-view-select";

/**
 * DEMO ONLY: floating control to preview the site as a guest, an applicant, an approved customer or an admin.
 * Every viewer-dependent part (prices, product cards, quick order, cart, checkout) follows it. Not a login.
 * Reads no request data, so static pages stay static; the browser reads the chosen view from its cookie.
 */
export function DemoViewSwitcher() {
  if (!demoViewSwitcherEnabled()) return null;
  return (
    <DemoViewSelect
      cookieName={DEMO_VIEW_COOKIE}
      fallback={defaultDemoView()}
      options={Object.entries(DEMO_VIEWS).map(([value, label]) => ({ value, label }))}
    />
  );
}
