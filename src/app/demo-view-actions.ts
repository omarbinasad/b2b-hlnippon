"use server";

/*
 * DEMO ONLY: switches which viewer the site is previewed as (guest, applicant, approved customer, admin).
 * It is not a login and grants nothing — remove it (or set DEMO_VIEW_SWITCHER=off) once real authentication exists.
 */
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { DEMO_VIEW_COOKIE, DEMO_VIEWS, demoViewSwitcherEnabled } from "@/lib/auth/session";

export async function setDemoViewAction(view: unknown): Promise<{ ok: boolean }> {
  if (!demoViewSwitcherEnabled() || typeof view !== "string" || !Object.hasOwn(DEMO_VIEWS, view)) return { ok: false };
  // Readable by the switcher in the browser: a demo preference, not a credential.
  (await cookies()).set(DEMO_VIEW_COOKIE, view, { httpOnly: false, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  // Prices, buttons and messages differ per viewer on every page.
  revalidatePath("/", "layout");
  return { ok: true };
}
