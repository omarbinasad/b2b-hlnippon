"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, Input, Select } from "@/components/ui/field";
import { siteConfig } from "@/config/site";
import { cx } from "@/lib/cx";
import type { FieldErrors } from "@/lib/types";

/** Stable DOM id for an error path: "variations.2.sku" → "pf-variations-2-sku". */
export const fieldId = (path: string) => `pf-${path.replace(/\./g, "-")}`;

/** Accessibility props linking a control to its error and hint. */
export function a11y(path: string, errors: FieldErrors, hasHint = false) {
  const id = fieldId(path);
  const describedBy = [errors[path] && `${id}-error`, hasHint && `${id}-hint`].filter(Boolean).join(" ");
  return { id, "aria-invalid": errors[path] ? true : undefined, "aria-describedby": describedBy || undefined } as const;
}

interface BaseProps {
  path: string;
  label: string;
  errors: FieldErrors;
  hint?: string;
  required?: boolean;
  className?: string;
}

export function TextField({
  path,
  label,
  errors,
  hint,
  required,
  className,
  value,
  onChange,
  ...rest
}: BaseProps & { value: string; onChange: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "id">) {
  return (
    <div className={className}>
      <Field id={fieldId(path)} label={label} hint={hint} error={errors[path]} required={required}>
        <Input {...rest} {...a11y(path, errors, Boolean(hint))} value={value} onChange={(e) => onChange(e.target.value)} />
      </Field>
    </div>
  );
}

/** Amount input with the store currency symbol (at most STORE_CURRENCY.minorDigits decimals — whole yen for JPY). */
export function MoneyField({ path, label, errors, hint, required, className, value, onChange }: BaseProps & { value: string; onChange: (v: string) => void }) {
  return (
    <div className={className}>
      <Field id={fieldId(path)} label={label} hint={hint} error={errors[path]} required={required}>
        <div className="relative">
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-muted">
            {siteConfig.currencySymbol}
          </span>
          <Input
            {...a11y(path, errors, Boolean(hint))}
            inputMode="decimal"
            autoComplete="off"
            className="pl-7 tabular-nums"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </Field>
    </div>
  );
}

export function SelectField({
  path,
  label,
  errors,
  hint,
  required,
  className,
  value,
  onChange,
  children,
}: BaseProps & { value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <div className={className}>
      <Field id={fieldId(path)} label={label} hint={hint} error={errors[path]} required={required}>
        <Select {...a11y(path, errors, Boolean(hint))} value={value} onChange={(e) => onChange(e.target.value)}>
          {children}
        </Select>
      </Field>
    </div>
  );
}

export function Checkbox({ id, label, hint, checked, onChange }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
      />
      <div>
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        {hint && <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}

/** Titled form section. */
export function Section({ title, description, id, children, className }: { title: string; description?: string; id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} tabIndex={id ? -1 : undefined} aria-labelledby={id ? `${id}-title` : undefined} className={cx("rounded-ui border border-line bg-surface p-4 sm:p-5", className)}>
      <h2 id={id ? `${id}-title` : undefined} className="text-base font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** Inline error for a group (no single control), e.g. "Add at least one variation". */
export function GroupError({ path, errors }: { path: string; errors: FieldErrors }) {
  if (!errors[path]) return null;
  return (
    <p id={`${fieldId(path)}-error`} className="text-sm font-medium text-danger">
      {errors[path]}
    </p>
  );
}

/** Calendar-date field ("YYYY-MM-DD") using the shared date picker. */
export function DateField({
  path,
  label,
  errors,
  value,
  onChange,
  min,
  max,
  rangeStart,
  rangeEnd,
}: Omit<BaseProps, "hint" | "required" | "className"> & {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  rangeStart?: string;
  rangeEnd?: string;
}) {
  return (
    <Field id={fieldId(path)} label={label} error={errors[path]}>
      <DatePicker
        id={fieldId(path)}
        value={value || undefined}
        onChange={(v) => onChange(v ?? "")}
        min={min || undefined}
        max={max || undefined}
        rangeStart={rangeStart || undefined}
        rangeEnd={rangeEnd || undefined}
        placeholder="No date"
      />
    </Field>
  );
}

/** Length × width × height with a unit; all empty = no dimensions. */
export function DimensionsFields({
  path,
  errors,
  value,
  onChange,
  legend = "Dimensions (L × W × H)",
}: {
  path: string;
  errors: FieldErrors;
  value: { length: string; width: string; height: string; unit: "cm" | "mm" | "m" };
  onChange: (v: { length: string; width: string; height: string; unit: "cm" | "mm" | "m" }) => void;
  legend?: string;
}) {
  const id = fieldId(path);
  const invalid = errors[path] ? true : undefined;
  const box = "h-10 w-full rounded-ui border border-line bg-surface px-2 text-base tabular-nums aria-invalid:border-danger sm:text-sm";
  return (
    <fieldset id={id} tabIndex={-1} aria-describedby={invalid ? `${id}-error` : undefined}>
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-[1fr_1fr_1fr_4.5rem] gap-2">
        {(["length", "width", "height"] as const).map((k) => (
          <div key={k}>
            <label htmlFor={`${id}-${k}`} className="sr-only">{k}</label>
            <input
              id={`${id}-${k}`}
              inputMode="decimal"
              placeholder={k[0].toUpperCase()}
              value={value[k]}
              aria-invalid={invalid}
              onChange={(e) => onChange({ ...value, [k]: e.target.value })}
              className={box}
            />
          </div>
        ))}
        <div>
          <label htmlFor={`${id}-unit`} className="sr-only">Unit</label>
          <select id={`${id}-unit`} value={value.unit} onChange={(e) => onChange({ ...value, unit: e.target.value as "cm" })} className={box}>
            <option value="cm">cm</option>
            <option value="mm">mm</option>
            <option value="m">m</option>
          </select>
        </div>
      </div>
      {invalid && <p id={`${id}-error`} className="mt-1.5 text-xs text-danger">{errors[path]}</p>}
    </fieldset>
  );
}

/** Free-text values as removable chips (Enter or comma adds; Backspace on empty removes the last). */
export function ChipsInput({
  id,
  values,
  onChange,
  itemLabel,
  invalid,
  describedBy,
  suggestions,
  placeholder = "Type and press Enter",
}: {
  id: string;
  values: string[];
  onChange: (values: string[]) => void;
  /** Used in remove-button labels, e.g. "tag". */
  itemLabel: string;
  invalid?: boolean;
  describedBy?: string;
  suggestions?: string[];
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const next = [...values];
    for (const part of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (!next.some((v) => v.toLowerCase() === part.toLowerCase())) next.push(part);
    }
    if (next.length !== values.length) onChange(next);
    setText("");
  };
  const listId = suggestions?.length ? `${id}-suggestions` : undefined;
  return (
    <div className={cx("flex min-h-10 flex-wrap items-center gap-1.5 rounded-ui border bg-surface px-2 py-1.5", invalid ? "border-danger" : "border-line")}>
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-0.5 pr-1 pl-2.5 text-sm text-brand">
          {v}
          <button
            type="button"
            onClick={() => onChange(values.filter((x) => x !== v))}
            className="grid size-5 place-items-center rounded-full hover:bg-brand hover:text-brand-contrast"
            aria-label={`Remove ${itemLabel} ${v}`}
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </span>
      ))}
      <input
        id={id}
        list={listId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(text);
          } else if (e.key === "Backspace" && !text && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={() => text.trim() && add(text)}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="h-7 min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
      />
      {listId && (
        <datalist id={listId}>
          {suggestions!.filter((s) => !values.includes(s)).map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
    </div>
  );
}
