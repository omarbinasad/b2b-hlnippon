"use client";

import { useState, useTransition } from "react";
import { createGroupAction, updateGroupAction } from "@/app/admin/customer-groups/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import type { CustomerGroup, FieldErrors } from "@/lib/types";

/** Create a group, or rename/describe an existing one (its id never changes). */
export function GroupForm({ group }: { group?: CustomerGroup }) {
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setStatus("");
          const result = group ? await updateGroupAction(group.id, name, description) : await createGroupAction(name, description);
          if (!result) return; // created → redirected
          if (result.ok) {
            setErrors({});
            setStatus("Saved.");
          } else {
            setErrors(result.errors);
            setStatus(result.message);
          }
        });
      }}
      className="space-y-4"
    >
      <Field id="group-name" label="Name" required error={errors.name}>
        <Input id="group-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "group-name-error" : undefined} />
      </Field>
      <Field id="group-description" label="Description" error={errors.description}>
        <Textarea id="group-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} className="min-h-20" />
      </Field>
      <div className="flex items-center justify-between gap-3">
        <p role="status" className="text-sm text-muted">{status}</p>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : group ? "Save" : "Create group"}</Button>
      </div>
    </form>
  );
}
