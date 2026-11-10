"use server";

/*
 * Brand management. DEMO: kept in server memory. TODO(auth): the capability comes from a demo cookie; the backend must
 * authorize every call.
 */
import { revalidatePath } from "next/cache";
import { getCapabilities } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import type { BrandInput, FieldErrors, SiteImage } from "@/lib/types";

export type BrandActionResult = { ok: true } | { ok: false; errors: FieldErrors; message: string };

const denied = { ok: false as const, errors: {}, message: "Your role can't do that (demo permission)." };
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

function logo(v: unknown): SiteImage | null {
  const o = obj(v);
  const src = str(o.src, 500);
  if (!src) return null;
  const size = (x: unknown, fallback: number) => (typeof x === "number" && x > 0 ? Math.round(x) : fallback);
  return { src, alt: str(o.alt, 200), width: size(o.width, 240), height: size(o.height, 120) };
}

/** The shop, the home section and product forms all show brands. */
const refresh = () => revalidatePath("/", "layout");

export async function saveBrandAction(id: string | null, raw: unknown): Promise<BrandActionResult> {
  if (!(await getCapabilities()).includes("products.edit")) return denied;
  const v = obj(raw);
  const input: BrandInput = { name: str(v.name, 200), logo: logo(v.logo), showOnHome: v.showOnHome === true, displayOrder: typeof v.displayOrder === "number" ? v.displayOrder : Number.NaN };
  const r = await repositories.catalogSettings.saveBrand(id === null ? null : str(id, 100), input);
  if (!r.ok) return { ok: false, errors: r.errors, message: r.message ?? "Some fields need attention." };
  refresh();
  return { ok: true };
}

export async function deleteBrandAction(name: string): Promise<BrandActionResult> {
  if (!(await getCapabilities()).includes("products.delete")) return denied;
  const r = await repositories.catalogSettings.deleteBrand(str(name, 200));
  if (!r.ok) return { ok: false, errors: r.errors, message: r.message ?? "That couldn't be deleted." };
  refresh();
  return { ok: true };
}
