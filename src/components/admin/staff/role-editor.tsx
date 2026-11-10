"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { deleteRoleAction, duplicateRoleAction, saveRoleAction } from "@/app/admin/staff-actions";
import { useCan } from "@/components/admin/capabilities-context";
import { useUnsavedGuard } from "@/components/admin/use-unsaved-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { ACTION_LABELS, ACTIONS, ADMIN_ROLE_ID, DEFAULT_ROLES, MODULES, selfLockoutError } from "@/lib/auth/capabilities";
import { PERMISSION_GROUPS, permissionLabel, permissionWarnings, type PermissionDefinition } from "@/lib/auth/permission-catalog";
import { cx } from "@/lib/cx";
import type { FieldErrors, Role } from "@/lib/types";
import { PreviewRoleButton } from "./staff-forms";

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
const DEFAULT_OPEN = ["orders"];

interface RoleEditorProps {
  /** Absent when creating a role. */
  role?: Role;
  roles: { id: string; name: string }[];
  /** The role the admin is currently being viewed as: not the role being edited. */
  actingRole: { id: string; name: string };
  staffCount?: number;
  created?: boolean;
}

export function RoleEditor({ role, roles, actingRole, staffCount = 0, created }: RoleEditorProps) {
  const router = useRouter();
  const can = useCan();
  const canManage = can("roles.manage");
  const locked = role?.id === ADMIN_ROLE_ID;
  const readOnly = locked || !canManage;

  const initial = { name: role?.name ?? "", description: role?.description ?? "", capabilities: role?.capabilities ?? [] };
  const [saved, setSaved] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [caps, setCaps] = useState<string[]>(initial.capabilities);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string[]>(DEFAULT_OPEN);
  const [advanced, setAdvanced] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<{ tone: "success" | "warning" | "info"; text: string } | null>(created ? { tone: "success", text: "Role created." } : null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, start] = useTransition();

  const dirty = !readOnly && (name !== saved.name || description !== saved.description || !sameSet(caps, saved.capabilities));
  const guard = useUnsavedGuard(dirty);

  const has = (c: string) => caps.includes(c);
  // Nobody can hand out what they don't have themselves. Keeping what the role already has is fine.
  const grantable = (c: string) => can(c) || saved.capabilities.includes(c);
  const change = (next: string[]) => {
    setCaps(next);
    setNotice(null);
  };
  const toggle = (c: string, on: boolean) => change(on ? [...caps, c] : caps.filter((x) => x !== c));
  const allow = (ids: string[]) => change([...new Set([...caps, ...ids.filter(grantable)])]);
  const remove = (ids: string[]) => change(caps.filter((c) => !ids.includes(c)));

  const term = search.trim().toLowerCase();
  const matchesSearch = (group: string, p: PermissionDefinition) => !term || `${group} ${p.label} ${p.description} ${p.id}`.toLowerCase().includes(term);
  const groups = useMemo(() => PERMISSION_GROUPS.map((g) => ({ ...g, shown: g.permissions.filter((p) => matchesSearch(g.label, p)) })).filter((g) => g.shown.length), [term]); // eslint-disable-line react-hooks/exhaustive-deps

  const warnings = useMemo(() => permissionWarnings(caps), [caps]);
  const lockout = role ? selfLockoutError(role.id, caps, actingRole.id) : undefined;

  const applyTemplate = (id: string) => {
    const template = DEFAULT_ROLES.find((r) => r.id === id);
    if (!template) return;
    const usable = template.capabilities.filter(grantable);
    setCaps(usable);
    const left = template.capabilities.length - usable.length;
    setNotice({ tone: "info", text: `Loaded the ${template.name} template.${left ? ` ${left} of its permissions were left out because your role doesn't have them.` : ""} Nothing is saved until you press Save role.` });
  };

  const discard = () => {
    setName(saved.name);
    setDescription(saved.description);
    setCaps(saved.capabilities);
    setErrors({});
    setNotice({ tone: "info", text: "Changes discarded." });
  };

  const save = () =>
    start(async () => {
      const r = await saveRoleAction(role?.id ?? null, { name, description, capabilities: caps });
      if (!r.ok) {
        setErrors(r.errors);
        setNotice({ tone: "warning", text: r.message });
        return;
      }
      setErrors({});
      if (!role) {
        router.replace(`/admin/roles/${r.value.id}?notice=created` as Route);
        return;
      }
      setSaved({ name, description, capabilities: caps });
      const who = staffCount === 0 ? "No staff have this role yet." : `${staffCount} staff member${staffCount === 1 ? " has" : "s have"} the new permissions now.`;
      setNotice({ tone: "success", text: `Saved. ${who}` });
      router.refresh();
    });

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Card title={role ? "Choose a role" : "New role"}>
        {role ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-72">
              <Field id="role-select" label="Role you're editing">
                <Select id="role-select" value={role.id} onChange={(e) => guard.navigate(`/admin/roles/${e.target.value}`)}>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Select>
              </Field>
            </div>
            {canManage && <Link href="/admin/roles/new" className="pb-2.5 text-sm font-medium text-brand hover:underline">Create a new role</Link>}
          </div>
        ) : (
          <p className="text-sm text-muted">Give the role a name, start from a template if you like, then choose what it can do.</p>
        )}
        {role && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-ui bg-surface-muted p-3 text-sm">
            <p className="min-w-0 flex-1 basis-64">
              You&apos;re editing <strong>{saved.name}</strong>. You&apos;re viewing the admin as <strong>{actingRole.name}</strong>
              {actingRole.id === role.id ? ", which is this role, so saving changes your own view too." : ". Editing a role doesn't change your own view."}
            </p>
            {actingRole.id !== role.id && <PreviewRoleButton roleId={role.id} roleName={saved.name} disabled={dirty} hint={dirty ? "Save first: a preview shows the saved permissions." : undefined} />}
          </div>
        )}
      </Card>

      <Card title="Name and description">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="role-name" label="Role name" required error={errors.name}>
            <Input id="role-name" value={name} disabled={readOnly} onChange={(e) => { setName(e.target.value); setNotice(null); }} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "role-name-error" : undefined} />
          </Field>
          <Field id="role-description" label="Description" hint="What this person does, in a few words.">
            <Input id="role-description" value={description} disabled={readOnly} onChange={(e) => { setDescription(e.target.value); setNotice(null); }} />
          </Field>
        </div>
        {!readOnly && (
          <div className="mt-4 sm:max-w-sm">
            <Field id="role-template" label={role?.system ? "Load a template or go back to defaults" : "Start from a template"} hint="Replaces the permissions below. Nothing is saved until you press Save role.">
              <Select id="role-template" value="" onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">Choose a template…</option>
                {DEFAULT_ROLES.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </Field>
          </div>
        )}
      </Card>

      {locked && <Notice title="The Administrator role is protected">It always keeps every permission and can&apos;t be renamed, so nobody gets locked out. To make a smaller version, duplicate it.</Notice>}
      {!locked && !canManage && <Notice title="View only">Your role can see this role but can&apos;t change it. That needs the &quot;Manage roles&quot; permission.</Notice>}

      <Card
        title="What this role can do"
        description={`${caps.length} of ${PERMISSION_GROUPS.reduce((n, g) => n + g.permissions.length, 0)} permissions on. These control what the demo shows and accepts; the backend must check them on every action.`}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="min-w-48 flex-1 basis-64"><Input aria-label="Search permissions" placeholder="Search permissions, such as refund" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          {!advanced && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setOpen(PERMISSION_GROUPS.map((g) => g.key))}>Expand all</Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen([])}>Collapse all</Button>
            </>
          )}
          <Button size="sm" variant="secondary" aria-pressed={advanced} onClick={() => setAdvanced(!advanced)}>{advanced ? "Simple view" : "Advanced view"}</Button>
        </div>

        {errors.capabilities && <p role="alert" className="mb-3 text-sm text-danger">{errors.capabilities}</p>}

        {!readOnly && (lockout || warnings.length > 0) && (
          <div role="status" className="mb-4 rounded-ui border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
            <p className="font-semibold">Check before saving</p>
            <ul className="scrollbar-thin mt-1 max-h-56 space-y-2 overflow-y-auto">
              {lockout && <li>{lockout}</li>}
              {warnings.map((w) => (
                <li key={`${w.id}-${w.tone}`} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 basis-56">{w.message}</span>
                  {w.fix && <Button size="sm" variant="secondary" onClick={() => allow(w.fix ?? [])} aria-label={`Turn on ${w.fix.map(permissionLabel).join(" and ")}`}>Turn on</Button>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {advanced ? (
          <PermissionMatrix caps={caps} term={term} disabled={(c) => readOnly || (!grantable(c) && !has(c))} onToggle={toggle} onAll={(ids, on) => (on ? allow(ids) : remove(ids))} />
        ) : groups.length === 0 ? (
          <p className="rounded-ui border border-dashed border-line p-6 text-center text-sm text-muted">No permissions match that search.</p>
        ) : (
          <div className="space-y-2">
            {groups.map((g) => {
              const expanded = Boolean(term) || open.includes(g.key);
              const ids = (term ? g.shown : g.permissions).map((p) => p.id);
              const onCount = g.permissions.filter((p) => has(p.id)).length;
              const panel = `perm-group-${g.key}`;
              return (
                <section key={g.key} aria-label={g.label} className="rounded-ui border border-line">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 p-2 sm:p-3">
                    <button type="button" aria-expanded={expanded} aria-controls={panel} disabled={Boolean(term)} onClick={() => setOpen(expanded ? open.filter((k) => k !== g.key) : [...open, g.key])} className="flex min-w-0 flex-1 basis-56 items-center gap-2 rounded-ui p-1 text-left disabled:cursor-default">
                      <Icon name="chevronRight" className={cx("size-4 shrink-0 text-muted transition-transform", expanded && "rotate-90")} />
                      <span className="min-w-0">
                        <span className="block font-medium">{g.label}</span>
                        <span className="block text-xs text-muted">{g.description}</span>
                      </span>
                    </button>
                    <Badge tone={onCount === g.permissions.length ? "success" : onCount ? "info" : "neutral"}>{onCount} of {g.permissions.length}</Badge>
                    {!readOnly && (
                      <span className="flex gap-1">
                        <Button size="sm" variant="ghost" aria-label={`Allow all: ${g.label}`} onClick={() => allow(ids)}>{term ? "Allow shown" : "Allow all"}</Button>
                        <Button size="sm" variant="ghost" aria-label={`Remove all: ${g.label}`} onClick={() => remove(ids)}>{term ? "Remove shown" : "Remove all"}</Button>
                      </span>
                    )}
                  </div>
                  {expanded && (
                    <ul id={panel} className="divide-y divide-line border-t border-line">
                      {g.shown.map((p) => {
                        const off = readOnly || (!grantable(p.id) && !has(p.id));
                        return (
                          <li key={p.id}>
                            <label className={cx("flex gap-3 p-3 text-sm", off ? "text-muted" : "hover:bg-surface-muted")}>
                              <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-brand" checked={has(p.id)} disabled={off} onChange={(e) => toggle(p.id, e.target.checked)} />
                              <span className="min-w-0">
                                <span className="flex flex-wrap items-center gap-2 font-medium">{p.label}{p.sensitive && <Badge tone="warning">Sensitive</Badge>}</span>
                                <span className="mt-0.5 block text-xs text-muted">{p.description}</span>
                                {!readOnly && !grantable(p.id) && <span className="mt-0.5 block text-xs text-muted">Your own role doesn&apos;t have this, so you can&apos;t grant it.</span>}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </Card>

      <div className="sticky bottom-2 z-10 rounded-ui border border-line bg-surface p-3 shadow-sm">
        {notice && (
          <div role="status" className="mb-3"><Notice tone={notice.tone}>{notice.text}</Notice></div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && <Button type="submit" disabled={pending || !dirty && Boolean(role)}>{pending ? "Saving…" : "Save role"}</Button>}
          {!readOnly && <Button variant="secondary" disabled={pending || !dirty} onClick={discard}>Discard changes</Button>}
          {!readOnly && <span className={cx("text-sm", dirty ? "font-medium text-warning" : "text-muted")}>{dirty ? "Unsaved changes" : role ? "All changes saved" : "Not saved yet"}</span>}
          <span className="ml-auto flex flex-wrap gap-2">
            {role && canManage && (
              <Button variant="secondary" disabled={pending || dirty} title={dirty ? "Save or discard your changes first" : undefined} onClick={() => start(async () => { const r = await duplicateRoleAction(role.id); if (r.ok) router.push(`/admin/roles/${r.value.id}?notice=created` as Route); else setNotice({ tone: "warning", text: r.message }); })}>
                <Icon name="copy" className="size-4" /> Duplicate
              </Button>
            )}
            {role && !role.system && canManage && <Button variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => { setErrors({}); setConfirmingDelete(true); }}>Delete</Button>}
          </span>
        </div>
      </div>

      <Dialog open={confirmingDelete} onClose={() => setConfirmingDelete(false)} title={`Delete "${saved.name}"?`}>
        {errors.delete && <p role="alert" className="mb-3 text-sm text-danger">{errors.delete}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>Keep it</Button>
          <Button variant="danger" disabled={pending} onClick={() => start(async () => { if (!role) return; const r = await deleteRoleAction(role.id); if (!r.ok) return setErrors({ delete: r.message }); setSaved({ name, description, capabilities: caps }); router.push("/admin/roles"); })}>Delete</Button>
        </div>
      </Dialog>
      {guard.dialog}
    </form>
  );
}

/** The whole model as one table, for people who prefer it. Same state as the simple view. */
function PermissionMatrix({ caps, term, disabled, onToggle, onAll }: { caps: string[]; term: string; disabled: (c: string) => boolean; onToggle: (c: string, on: boolean) => void; onAll: (ids: string[], on: boolean) => void }) {
  const visible = MODULES.filter((m) => !term || m.label.toLowerCase().includes(term) || m.group.toLowerCase().includes(term));
  const groups = [...new Set(visible.map((m) => m.group))];
  return (
    <div className="overflow-x-auto rounded-ui border border-line">
      <table className="w-full min-w-[46rem] text-sm">
        <caption className="sr-only">Permissions by module</caption>
        <thead className="bg-surface-muted text-xs">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">Module</th>
            {ACTIONS.map((a) => <th key={a} scope="col" className="px-2 py-2 text-center font-medium">{ACTION_LABELS[a]}</th>)}
            <th scope="col" className="px-2 py-2 text-center font-medium">All</th>
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g}>
            <tr><th scope="rowgroup" colSpan={ACTIONS.length + 2} className="border-t border-line bg-surface-muted/50 px-3 py-1.5 text-left text-xs font-semibold tracking-wide text-muted uppercase">{g}</th></tr>
            {visible.filter((m) => m.group === g).map((m) => {
              const keys = m.actions.map((a) => `${m.key}.${a}`);
              return (
                <tr key={m.key} className="border-t border-line">
                  <th scope="row" className="px-3 py-2 text-left font-normal">{m.label}</th>
                  {ACTIONS.map((a) => (
                    <td key={a} className="px-2 py-2 text-center">
                      {m.actions.includes(a) && <input type="checkbox" aria-label={`${m.label}: ${ACTION_LABELS[a]}`} className="size-4 accent-brand" disabled={disabled(`${m.key}.${a}`)} checked={caps.includes(`${m.key}.${a}`)} onChange={(e) => onToggle(`${m.key}.${a}`, e.target.checked)} />}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center"><input type="checkbox" aria-label={`${m.label}: all`} className="size-4 accent-brand" disabled={keys.every(disabled)} checked={keys.every((k) => caps.includes(k))} onChange={(e) => onAll(keys, e.target.checked)} /></td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}
