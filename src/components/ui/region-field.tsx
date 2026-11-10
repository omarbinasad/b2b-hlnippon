"use client";

import { Input, Select } from "@/components/ui/field";
import { prefectureLabel, regionNames } from "@/lib/locations";
import type { ChangeEvent } from "react";

interface RegionFieldProps {
  id: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => void;
  /** Defaults to the store country. */
  country?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  className?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
}

/**
 * Top address level (prefecture, state, division…). A list for countries that have one, otherwise a text field.
 * A saved value that is not on the list stays selectable until it is changed.
 */
export function RegionField({ value, onChange, country, ...props }: RegionFieldProps) {
  const list = regionNames(country);
  if (!list.length) return <Input value={value} onChange={onChange} {...props} />;
  return (
    <Select value={value} onChange={onChange} {...props}>
      <option value="">Choose…</option>
      {value && !list.includes(value) && <option value={value}>{value}</option>}
      {list.map((r) => <option key={r} value={r}>{prefectureLabel(r)}</option>)}
    </Select>
  );
}
