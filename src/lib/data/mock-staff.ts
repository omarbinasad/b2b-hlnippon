import "server-only";

import { ADMIN_ROLE_ID, ALL_CAPABILITIES, DEFAULT_ROLES, escalatedCapabilities, roleDeleteError, roleEditError, staffChangeError, upgradeCapabilities, validateRole } from "@/lib/auth/capabilities";
import { isEmail } from "@/lib/customers/contact";
import type { FieldErrors, Role, StaffMember } from "@/lib/types";
import { clone, invalid, now } from "./mock-store-helpers";
import { matches, paginate, sortBy } from "./mock-utils";
import type { StaffRepository } from "./repositories";

const AT = "2026-01-01T00:00:00+09:00";

/* DEMO STORE: sample roles and staff in server memory. No logins exist; these drive the permission preview. */
const store = globalThis as typeof globalThis & { __mockStaff?: { roles: Role[]; staff: StaffMember[] }; __mockStaffCapsV2?: boolean };
store.__mockStaff ??= {
  roles: DEFAULT_ROLES.map((r) => ({ ...r, updatedAt: AT })),
  staff: [
    { id: "staff-1", name: "Demo admin", email: "admin@demo.test", roleId: ADMIN_ROLE_ID, active: true, createdAt: AT },
    { id: "staff-2", name: "Sample Manager", email: "manager@demo.test", roleId: "role-shop-manager", active: true, createdAt: AT },
    { id: "staff-3", name: "Sample Packer", email: "warehouse@demo.test", roleId: "role-warehouse", active: true, createdAt: AT },
    { id: "staff-4", name: "Sample Editor", email: "editor@demo.test", roleId: "role-content", active: true, createdAt: AT },
  ],
};
const db = store.__mockStaff;
// Once only, for a server already running with the older permissions (see upgradeCapabilities). Admin always has everything.
if (!store.__mockStaffCapsV2) {
  for (const r of db.roles) r.capabilities = r.id === ADMIN_ROLE_ID ? ALL_CAPABILITIES : upgradeCapabilities(r.capabilities);
  store.__mockStaffCapsV2 = true;
}
const fail = (message: string, errors: FieldErrors = {}) => ({ ok: false as const, errors, message });

export const mockStaffRepository: StaffRepository = {
  async roles() {
    return clone(db.roles);
  },
  async role(id) {
    const r = db.roles.find((x) => x.id === id);
    return r ? clone(r) : null;
  },
  async staffCounts() {
    return Object.fromEntries(db.roles.map((r) => [r.id, db.staff.filter((s) => s.roleId === r.id).length]));
  },
  async saveRole(id, input, actorCapabilities) {
    const name = input.name.trim();
    const errors = validateRole(input, (n) => db.roles.some((r) => r.id !== id && r.name.toLowerCase() === n.toLowerCase()));
    if (Object.keys(errors).length) return invalid(errors);
    if (id) {
      const lock = roleEditError(id, input.capabilities);
      if (lock) return fail(lock, { capabilities: lock });
    }
    const existing = id ? db.roles.find((r) => r.id === id) : undefined;
    if (id && !existing) return fail("That role no longer exists.");
    if (id === ADMIN_ROLE_ID && (name !== existing?.name || input.description.trim() !== existing?.description)) return fail("The Administrator role can't be renamed or changed.");
    // Only what this role gains counts: keeping a permission you lack yourself is not an escalation.
    const gained = input.capabilities.filter((c) => !existing?.capabilities.includes(c));
    const over = escalatedCapabilities(gained, actorCapabilities);
    if (over.length) return fail(`You can't grant permissions you don't have (${over.length}).`, { capabilities: `You can't grant permissions you don't have: ${over.slice(0, 3).join(", ")}${over.length > 3 ? "…" : ""}.` });
    const next: Role = { ...(existing ?? { id: `role-${crypto.randomUUID().slice(0, 8)}`, system: false }), name, description: input.description.trim(), capabilities: [...new Set(input.capabilities)], updatedAt: now() };
    if (existing) Object.assign(existing, next);
    else db.roles.push(next);
    return { ok: true, value: clone(next) };
  },
  async duplicateRole(id, actorCapabilities) {
    const r = db.roles.find((x) => x.id === id);
    if (!r) return fail("That role no longer exists.");
    let name = `${r.name} copy`;
    for (let i = 2; db.roles.some((x) => x.name === name); i++) name = `${r.name} copy ${i}`;
    return mockStaffRepository.saveRole(null, { name, description: r.description, capabilities: r.capabilities }, actorCapabilities);
  },
  async deleteRole(id) {
    const r = db.roles.find((x) => x.id === id);
    if (!r) return fail("That role no longer exists.");
    const message = roleDeleteError(r, db.staff.filter((s) => s.roleId === id).length);
    if (message) return fail(message);
    db.roles = db.roles.filter((x) => x.id !== id);
    return { ok: true, value: { id } };
  },
  async staff({ search, roleId, page, perPage } = {}) {
    const rows = db.staff.filter((s) => (!roleId || s.roleId === roleId) && matches(search, s.name, s.email));
    return clone(paginate(sortBy(rows, (s) => s.name), page, perPage));
  },
  async staffMember(id) {
    const s = db.staff.find((x) => x.id === id);
    return s ? clone(s) : null;
  },
  async saveStaff(id, input) {
    const errors: FieldErrors = {};
    if (input.name.trim().length < 2) errors.name = "Enter a name.";
    if (!isEmail(input.email)) errors.email = "Enter a valid email address.";
    else if (db.staff.some((s) => s.id !== id && s.email.toLowerCase() === input.email.trim().toLowerCase())) errors.email = "Another staff member uses this email.";
    if (!db.roles.some((r) => r.id === input.roleId)) errors.roleId = "Choose a role.";
    if (Object.keys(errors).length) return invalid(errors);
    const lock = id ? staffChangeError(db.staff, id, input) : undefined;
    if (lock) return fail(lock, { roleId: lock });
    const existing = id ? db.staff.find((s) => s.id === id) : undefined;
    if (id && !existing) return fail("That staff member no longer exists.");
    const next: StaffMember = { ...(existing ?? { id: `staff-${crypto.randomUUID().slice(0, 8)}`, createdAt: now() }), name: input.name.trim(), email: input.email.trim(), roleId: input.roleId, active: input.active, ...(!existing && input.invite ? { invitedAt: now() } : {}) };
    if (existing) Object.assign(existing, next);
    else db.staff.push(next);
    return { ok: true, value: clone(next) };
  },
  async removeStaff(id) {
    const lock = staffChangeError(db.staff, id, null);
    if (lock) return fail(lock);
    db.staff = db.staff.filter((s) => s.id !== id);
    return { ok: true, value: { id } };
  },
};
