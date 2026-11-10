"use client";

/** A category checkbox that applies the filter as soon as it changes (the form's Apply button covers no-JavaScript). */
export function CategoryCheckbox({ name, value, label, checked }: { name: string; value: string; label: string; checked: boolean }) {
  return (
    <label className="flex items-center gap-2.5 rounded-ui px-2 py-1.5 text-sm hover:bg-surface-muted">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="size-4 shrink-0 accent-brand" />
      <span className="min-w-0">{label}</span>
    </label>
  );
}
