"use server";

/*
 * Roles and staff. DEMO: server memory; no logins exist. The checks here protect the demo's screens only. TODO(auth): the
 * backend must authorize every call against the signed-in user, not a cookie.
 */
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { escalatedCapabilities, selfLockoutError, staffTargetError } from "@/lib/auth/capabilities";
import { DEMO_ROLE_COOKIE, getAdminRole, getCapabilities } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import type { FieldErrors } from "@/lib/types";

export type StaffResult<T = { id: string }> = { ok: true; value: T } | { ok: false; errors: FieldErrors; message: string };

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const denied = { ok: false as const, errors: {}, message: "Your role can't do that (demo permission)." };
const refresh = () => revalidatePath("/admin", "layout");
const out = <T,>(r: { ok: true; value: T } | { ok: false; errors: FieldErrors; message?: string }): StaffResult<T> => {
  if (!r.ok) return { ok: false, errors: r.errors, message: r.message ?? "Some fields need attention." };
  refresh();
  return r;
};

async function targetError(id: string, caps: string[]) {
  const member = await repositories.staff.staffMember(id);
  const role = member ? await repositories.staff.role(member.roleId) : null;
  return role ? staffTargetError(role.capabilities, caps) : undefined;
}

export async function setDemoRoleAction(roleId: string) {
  const role = await repositories.staff.role(str(roleId, 100));
  if (!role) return;
  (await cookies()).set(DEMO_ROLE_COOKIE, role.id, { httpOnly: false, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  revalidatePath("/", "layout");
}

export async function saveRoleAction(id: string | null, raw: unknown): Promise<StaffResult> {
  const caps = await getCapabilities();
  if (!caps.includes("roles.manage")) return denied;
  const v = obj(raw);
  const capabilities = Array.isArray(v.capabilities) ? v.capabilities.filter((x): x is string => typeof x === "string").slice(0, 500) : [];
  const lockout = id ? selfLockoutError(id, capabilities, (await getAdminRole())?.id) : undefined;
  if (lockout) return { ok: false, errors: { capabilities: lockout }, message: lockout };
  return out(await repositories.staff.saveRole(id, { name: str(v.name, 100), description: str(v.description, 300), capabilities }, caps));
}

export async function duplicateRoleAction(id: string): Promise<StaffResult> {
  const caps = await getCapabilities();
  if (!caps.includes("roles.manage")) return denied;
  return out(await repositories.staff.duplicateRole(String(id), caps));
}

export async function deleteRoleAction(id: string): Promise<StaffResult> {
  if (!(await getCapabilities()).includes("roles.manage")) return denied;
  return out(await repositories.staff.deleteRole(String(id)));
}

export async function saveStaffAction(id: string | null, raw: unknown): Promise<StaffResult> {
  const caps = await getCapabilities();
  if (!caps.includes("staff.manage")) return denied;
  const v = obj(raw);
  const role = await repositories.staff.role(str(v.roleId, 100));
  if (role && escalatedCapabilities(role.capabilities, caps).length) return { ok: false, errors: { roleId: "This role has permissions you don't have." }, message: "You can't assign a role with more permissions than your own." };
  const target = id ? await targetError(id, caps) : undefined;
  if (target) return { ok: false, errors: {}, message: target };
  return out(await repositories.staff.saveStaff(id, { name: str(v.name, 100), email: str(v.email).trim(), roleId: str(v.roleId, 100), active: v.active !== false, invite: v.invite === true }));
}

export async function removeStaffAction(id: string): Promise<StaffResult> {
  const caps = await getCapabilities();
  if (!caps.includes("staff.manage")) return denied;
  const target = await targetError(String(id), caps);
  if (target) return { ok: false, errors: {}, message: target };
  return out(await repositories.staff.removeStaff(String(id)));
}
