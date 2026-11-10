"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { removeStaffAction, saveStaffAction, setDemoRoleAction } from "@/app/admin/staff-actions";
import { useCan } from "@/components/admin/capabilities-context";
import { hasUnsavedChanges, useUnsavedGuard } from "@/components/admin/use-unsaved-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { Select as PlainSelect } from "@/components/ui/select";
import { ADMIN_ROLE_ID, ALL_CAPABILITIES } from "@/lib/auth/capabilities";
import { effectivePermissions } from "@/lib/auth/permission-catalog";
import { formatDateTime } from "@/lib/format";
import type { FieldErrors, Role, StaffMember } from "@/lib/types";

const CONFIRM_LEAVE = "You have unsaved changes on this page. Switching the preview may lose them. Continue?";

/** Demo: view the admin as another role. Top bar. This doesn't change any role or who has it. */
export function RolePreview({ roles, current }: { roles: { id: string; name: string }[]; current: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="flex min-w-0 items-center gap-2 text-sm text-muted">
      <span className="hidden sm:inline">Preview as</span>
      <span className="w-44 min-w-0">
        <PlainSelect
          aria-label="Preview as role"
          disabled={pending}
          value={current}
          onChange={(e) => {
            if (hasUnsavedChanges() && !window.confirm(CONFIRM_LEAVE)) return;
            const id = e.target.value;
            start(async () => { await setDemoRoleAction(id); router.refresh(); });
          }}
        >
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </PlainSelect>
      </span>
    </label>
  );
}

/** Top of every admin page while previewing a role, so it's never mistaken for your own access. */
export function PreviewBanner({ roleName }: { roleName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Notice tone="info">
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 flex-1 basis-56">You&apos;re previewing the admin as <strong>{roleName}</strong>. Menus and actions are limited to that role.</span>
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { await setDemoRoleAction(ADMIN_ROLE_ID); router.refresh(); })}>Back to Administrator</Button>
      </span>
    </Notice>
  );
}

/** Previews the admin as a role, then goes to its first page. */
export function PreviewRoleButton({ roleId, roleName, disabled, hint }: { roleId: string; roleName: string; disabled?: boolean; hint?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button size="sm" variant="secondary" disabled={disabled || pending} onClick={() => start(async () => { await setDemoRoleAction(roleId); router.push("/admin"); })}>
        <Icon name="eye" className="size-4" /> Preview the admin as {roleName}
      </Button>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </span>
  );
}

/** Everything a role lets someone do, read-only, grouped like the Role Editor. */
export function PermissionSummary({ capabilities }: { capabilities: string[] }) {
  const groups = effectivePermissions(capabilities);
  const known = capabilities.filter((c) => ALL_CAPABILITIES.includes(c)).length;
  if (!groups.length) return <p className="text-sm text-muted">This role has no permissions, so this person can&apos;t open anything in the admin.</p>;
  return (
    <>
      <p className="mb-3 text-sm text-muted">{known} of {ALL_CAPABILITIES.length} permissions.</p>
      <div className="space-y-2">
        {groups.map((g) => (
          <details key={g.key} className="rounded-ui border border-line">
            <summary className="flex list-none items-center justify-between gap-2 p-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
              {g.label} <Badge tone={g.permissions.length === g.total ? "success" : "info"}>{g.permissions.length} of {g.total}</Badge>
            </summary>
            <ul className="divide-y divide-line border-t border-line text-sm">
              {g.permissions.map((p) => (
                <li key={p.id} className="flex gap-2 p-3">
                  <Icon name="check" className="mt-0.5 size-4 shrink-0 text-success" />
                  <span className="min-w-0"><span className="block font-medium">{p.label}</span><span className="block text-xs text-muted">{p.description}</span></span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </>
  );
}

/** A role can only be assigned by someone who has all of its permissions. */
function roleOptions(roles: Role[], can: (c: string) => boolean) {
  return roles.map((r) => {
    const allowed = r.capabilities.every(can);
    return <option key={r.id} value={r.id} disabled={!allowed}>{allowed ? r.name : `${r.name} (more permissions than yours)`}</option>;
  });
}

/** Create or invite someone. DEMO: nothing is sent and no login exists. */
export function AddStaffButton({ roles }: { roles: Role[] }) {
  const router = useRouter();
  const can = useCan();
  const firstRole = roles.find((r) => r.id !== ADMIN_ROLE_ID && r.capabilities.every(can))?.id ?? "";
  const blank = { name: "", email: "", roleId: firstRole, active: true, invite: true };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(blank);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  if (!can("staff.manage")) return null;
  const close = () => { setOpen(false); setV(blank); setErrors({}); setMessage(""); };
  return (
    <>
      <Button onClick={() => setOpen(true)}><Icon name="plus" className="size-4" /> Add staff member</Button>
      <Dialog open={open} onClose={close} title="Add staff member" description="Demo account: no login is created and no email is sent.">
        <form
          noValidate
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveStaffAction(null, v);
              if (!r.ok) {
                setErrors(r.errors);
                setMessage(r.message);
                return;
              }
              close();
              router.push(`/admin/staff/${r.value.id}?notice=created` as Route);
            });
          }}
        >
          <Field id="st-name" label="Name" required error={errors.name}><Input id="st-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "st-name-error" : undefined} /></Field>
          <Field id="st-email" label="Email" required error={errors.email}><Input id="st-email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "st-email-error" : undefined} /></Field>
          <Field id="st-role" label="Role" error={errors.roleId}><Select id="st-role" value={v.roleId} onChange={(e) => setV({ ...v, roleId: e.target.value })}>{roleOptions(roles, can)}</Select></Field>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 size-4 accent-brand" checked={v.invite} onChange={(e) => setV({ ...v, invite: e.target.checked })} /><span>Invite them by email<span className="block text-xs text-muted">Demo: marks them as invited. Nothing is sent.</span></span></label>
          {message && <p role="alert" className="text-sm text-danger">{message}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add staff member"}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/** One staff member: their details, the role assigned to them, and what that role lets them do. */
export function StaffEditor({ member, roles, created }: { member: StaffMember; roles: Role[]; created?: boolean }) {
  const router = useRouter();
  const can = useCan();
  const initial = { name: member.name, email: member.email, roleId: member.roleId, active: member.active };
  const [saved, setSaved] = useState(initial);
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<{ tone: "success" | "warning" | "info"; text: string } | null>(created ? { tone: "success", text: member.invitedAt ? "Staff member added and marked as invited. No email was sent: this is a demo." : "Staff member added." } : null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [pending, start] = useTransition();

  const savedRole = roles.find((r) => r.id === saved.roleId);
  const role = roles.find((r) => r.id === v.roleId);
  // Someone with more permissions than you is out of your reach.
  const outOfReach = savedRole ? !savedRole.capabilities.every(can) : false;
  const editable = can("staff.manage") && !outOfReach;
  const dirty = editable && JSON.stringify(v) !== JSON.stringify(saved);
  const guard = useUnsavedGuard(dirty);
  const set = (patch: Partial<typeof v>) => { setV({ ...v, ...patch }); setNotice(null); };

  const save = () =>
    start(async () => {
      const r = await saveStaffAction(member.id, v);
      if (!r.ok) {
        setErrors(r.errors);
        setNotice({ tone: "warning", text: r.message });
        return;
      }
      setErrors({});
      setSaved(v);
      setNotice({ tone: "success", text: v.roleId !== saved.roleId ? `Saved. ${v.name} now has the ${role?.name ?? "new"} role.` : "Saved." });
      router.refresh();
    });

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); save(); }} className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-6">
        {outOfReach && <Notice title="View only">{saved.name} has permissions your role doesn&apos;t have, so you can&apos;t change this account.</Notice>}
        <Card title="Details">
          <div className="space-y-3">
            <Field id="st-name" label="Name" required error={errors.name}><Input id="st-name" value={v.name} disabled={!editable} onChange={(e) => set({ name: e.target.value })} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "st-name-error" : undefined} /></Field>
            <Field id="st-email" label="Email" required error={errors.email}><Input id="st-email" type="email" value={v.email} disabled={!editable} onChange={(e) => set({ email: e.target.value })} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "st-email-error" : undefined} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-brand" checked={v.active} disabled={!editable} onChange={(e) => set({ active: e.target.checked })} /> Active</label>
            {member.invitedAt && <p className="text-sm text-muted"><Badge tone="info">Invited</Badge> Marked as invited {formatDateTime(member.invitedAt)}. Demo: no email was sent.</p>}
          </div>
        </Card>

        <Card title="Assigned role" description="This chooses which role this person has. It doesn't change what the role itself can do.">
          <Field id="st-role" label="Role" error={errors.roleId}>
            <Select id="st-role" value={v.roleId} disabled={!editable} onChange={(e) => set({ roleId: e.target.value })}>{roleOptions(roles, can)}</Select>
          </Field>
          {role && <p className="mt-2 text-sm text-muted">{role.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {role && can("roles.view") && <Link href={`/admin/roles/${role.id}`} className="text-sm font-medium text-brand hover:underline">Change what {role.name} can do</Link>}
          </div>
        </Card>

        <div className="rounded-ui border border-line bg-surface p-3">
          {notice && <div role="status" className="mb-3"><Notice tone={notice.tone}>{notice.text}</Notice></div>}
          <div className="flex flex-wrap items-center gap-2">
            {editable && <Button type="submit" disabled={pending || !dirty}>{pending ? "Saving…" : "Save changes"}</Button>}
            {editable && <Button variant="secondary" disabled={pending || !dirty} onClick={() => { setV(saved); setErrors({}); setNotice({ tone: "info", text: "Changes discarded." }); }}>Discard changes</Button>}
            {editable && <span className={dirty ? "text-sm font-medium text-warning" : "text-sm text-muted"}>{dirty ? "Unsaved changes" : "All changes saved"}</span>}
            {editable && <Button variant="ghost" className="ml-auto text-danger hover:bg-danger-soft" onClick={() => { setRemoveError(""); setRemoving(true); }}>Remove</Button>}
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <Card title={v.roleId !== saved.roleId ? `What ${role?.name ?? "this role"} would let them do` : "What they can do"} description={v.roleId !== saved.roleId ? "Not saved yet. This is what they'd have with the role you've chosen." : `From the ${role?.name ?? "assigned"} role.`}>
          {role ? <PermissionSummary capabilities={role.capabilities} /> : <p className="text-sm text-muted">That role no longer exists.</p>}
          {savedRole && (
            <div className="mt-4 border-t border-line pt-4">
              <PreviewRoleButton roleId={savedRole.id} roleName={savedRole.name} disabled={dirty} hint={dirty ? "Save first: a preview shows the saved role." : undefined} />
            </div>
          )}
        </Card>
      </div>

      <Dialog open={removing} onClose={() => setRemoving(false)} title={`Remove ${saved.name}?`}>
        {removeError && <p role="alert" className="mb-3 text-sm text-danger">{removeError}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRemoving(false)}>Keep</Button>
          <Button variant="danger" disabled={pending} onClick={() => start(async () => { const r = await removeStaffAction(member.id); if (!r.ok) return setRemoveError(r.message); router.push("/admin/staff"); })}>Remove</Button>
        </div>
      </Dialog>
      {guard.dialog}
    </form>
  );
}
