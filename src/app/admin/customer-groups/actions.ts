"use server";

/*
 * Customer group mutations. DEMO: kept in server memory only. Group ids are
 * stable so future price and quantity rules can target them; renaming keeps the id.
 * TODO(auth): permissions are mocked — the backend must enforce them.
 */
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminActor } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import type { FieldErrors } from "@/lib/types";

export type GroupActionResult = { ok: true } | { ok: false; errors: FieldErrors; message: string };

const str = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : "");
const ids = (v: unknown) => (Array.isArray(v) ? v.slice(0, 100).map((x) => str(x, 100)).filter(Boolean) : []);

async function actor() {
  const a = await getAdminActor();
  return a.permissions.includes("customer-groups.manage") ? { id: a.id, name: a.name, role: a.role } : null;
}

const denied: GroupActionResult = { ok: false, errors: {}, message: "You don't have permission to manage groups (mock permissions)." };

function refresh(id?: string) {
  revalidatePath("/admin/customer-groups");
  if (id) revalidatePath(`/admin/customer-groups/${id}`);
  revalidatePath("/admin/customers", "layout");
}

export async function createGroupAction(name: string, description: string): Promise<GroupActionResult> {
  const by = await actor();
  if (!by) return denied;
  const result = await repositories.customers.createGroup({ name: str(name, 100), description: str(description).trim() || undefined }, by);
  if (!result.ok) return { ok: false, errors: result.errors, message: result.message ?? "The group could not be created." };
  refresh(result.value.id);
  redirect(`/admin/customer-groups/${result.value.id}?notice=created` as Route);
}

export async function updateGroupAction(id: string, name: string, description: string): Promise<GroupActionResult> {
  const by = await actor();
  if (!by) return denied;
  const groupId = str(id, 100);
  const result = await repositories.customers.updateGroup(groupId, { name: str(name, 100), description: str(description).trim() || undefined }, by);
  if (!result.ok) return { ok: false, errors: result.errors, message: result.message ?? "The group could not be saved." };
  refresh(groupId);
  return { ok: true };
}

export async function assignGroupMembersAction(id: string, add: unknown, remove: unknown): Promise<GroupActionResult> {
  const by = await actor();
  if (!by) return denied;
  const groupId = str(id, 100);
  const result = await repositories.customers.assignGroupMembers(groupId, { add: ids(add), remove: ids(remove) }, by);
  if (!result.ok) return { ok: false, errors: result.errors, message: result.message ?? "Members could not be updated." };
  refresh(groupId);
  return { ok: true };
}

/** Server-side customer search for the "Add members" picker (excludes current members). */
export async function searchGroupCandidatesAction(groupId: string, term: string) {
  return repositories.customers.search(str(term, 100), { excludeGroupId: str(groupId, 100), limit: 10 });
}
