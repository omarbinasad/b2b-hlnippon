"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Icon } from "@/components/ui/icons";
import { Popover } from "@/components/ui/popover";
import {
  compareModes,
  compareRange,
  dashboardSearch,
  MAX_RANGE_DAYS,
  presetRange,
  rangePresets,
  validRange,
  type CompareMode,
  type RangePreset,
} from "@/lib/date-range";
import { formatDateRange as rangeText } from "@/lib/format";
import type { DateRange } from "@/lib/types";


const triggerClass =
  "flex h-11 w-full items-center gap-2 rounded-ui border border-line bg-surface px-3 text-left text-sm font-medium hover:bg-surface-muted";

interface FiltersProps {
  today: string;
  range: DateRange;
  preset: RangePreset;
  compareMode: CompareMode;
  compare?: DateRange;
  /** Trigger labels are formatted on the server so server and browser markup match. */
  rangeLabel: string;
  compareLabel: string;
}

/** Date range + comparison controls. Changes update the URL; the server recomputes the dashboard. */
export function DashboardFilters({ today, range, preset, compareMode, compare, rangeLabel, compareLabel }: FiltersProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const apply = (next: { range: DateRange; compareMode: CompareMode; compare?: DateRange }) =>
    startTransition(() => router.push(`/admin?${dashboardSearch(next)}` as Route, { scroll: false }));

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch" aria-busy={pending}>
      <div className="sm:w-72">
        <Popover
          label="Choose date range"
          triggerClassName={triggerClass}
          trigger={
            <>
              <Icon name="calendar" className="size-5 shrink-0 text-muted" />
              <span className="sr-only">Date range: </span>
              <span className="min-w-0 flex-1 truncate">{rangeLabel}</span>
              <Icon name="chevronDown" className="size-4 shrink-0 text-muted" />
            </>
          }
        >
          {(close) => (
            <RangeForm
              today={today}
              initialPreset={preset}
              initialRange={range}
              onCancel={close}
              onApply={(r) => {
                close();
                apply({ range: r, compareMode, compare: compareMode === "custom" ? compare : undefined });
              }}
            />
          )}
        </Popover>
      </div>

      <div className="sm:w-64">
        <Popover
          label="Choose comparison period"
          triggerClassName={`${triggerClass} h-auto min-h-11 py-1.5`}
          trigger={
            <>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-normal text-muted">Compare with</span>
                <span className="block truncate">{compareLabel}</span>
              </span>
              <Icon name="chevronDown" className="size-4 shrink-0 text-muted" />
            </>
          }
        >
          {(close) => (
            <CompareForm
              today={today}
              range={range}
              initialMode={compareMode}
              initialCustom={compareMode === "custom" ? compare : undefined}
              onCancel={close}
              onApply={(mode, custom) => {
                close();
                apply({ range, compareMode: mode, compare: custom });
              }}
            />
          )}
        </Popover>
      </div>

      <p role="status" className="sr-only">
        {pending ? "Updating dashboard…" : ""}
      </p>
      {pending && (
        <span aria-hidden className="self-center text-xs text-muted">
          Updating…
        </span>
      )}
    </div>
  );
}

function DateInputs({ value, onChange, today }: { value: DateRange; onChange: (r: DateRange) => void; today: string }) {
  const id = useId();
  const pickerProps = { max: today, rangeStart: value.from, rangeEnd: value.to };
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <div>
        <label htmlFor={`${id}-from`} className="mb-1 block text-xs font-medium text-muted">From</label>
        <DatePicker id={`${id}-from`} value={value.from} onChange={(from) => onChange({ ...value, from: from ?? "" })} {...pickerProps} max={value.to || today} />
      </div>
      <div>
        <label htmlFor={`${id}-to`} className="mb-1 block text-xs font-medium text-muted">To</label>
        <DatePicker id={`${id}-to`} value={value.to} onChange={(to) => onChange({ ...value, to: to ?? "" })} {...pickerProps} min={value.from || undefined} />
      </div>
    </div>
  );
}

const rangeError = `Choose a start date before the end date, up to today, spanning at most ${MAX_RANGE_DAYS} days.`;

function Choice({ name, checked, onChange, label, detail }: { name: string; checked: boolean; onChange: () => void; label: string; detail?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-ui px-2 py-1.5 hover:bg-surface-muted">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="mt-1 accent-[var(--brand)]" />
      <span className="text-sm">
        <span className="block font-medium">{label}</span>
        {detail && <span className="block text-xs text-muted">{detail}</span>}
      </span>
    </label>
  );
}

function RangeForm({ today, initialPreset, initialRange, onApply, onCancel }: {
  today: string;
  initialPreset: RangePreset;
  initialRange: DateRange;
  onApply: (r: DateRange) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<RangePreset>(initialPreset);
  const [custom, setCustom] = useState<DateRange>(initialRange);
  const chosen = selected === "custom" ? validRange(custom.from, custom.to, today) : presetRange(selected, today);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (chosen) onApply(chosen);
      }}
    >
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Date range</legend>
        {rangePresets.map((p) => (
          <Choice
            key={p.id}
            name="range"
            checked={selected === p.id}
            onChange={() => setSelected(p.id)}
            label={p.label}
            detail={rangeText(presetRange(p.id, today))}
          />
        ))}
        <Choice name="range" checked={selected === "custom"} onChange={() => setSelected("custom")} label="Custom range" />
      </fieldset>
      {selected === "custom" && <DateInputs value={custom} onChange={setCustom} today={today} />}
      {!chosen && <p className="mt-2 text-xs text-danger">{rangeError}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" disabled={!chosen}>Apply</Button>
      </div>
    </form>
  );
}

function CompareForm({ today, range, initialMode, initialCustom, onApply, onCancel }: {
  today: string;
  range: DateRange;
  initialMode: CompareMode;
  initialCustom?: DateRange;
  onApply: (mode: CompareMode, custom?: DateRange) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<CompareMode>(initialMode);
  const [custom, setCustom] = useState<DateRange>(initialCustom ?? compareRange("previous", range)!);
  const customValid = validRange(custom.from, custom.to, today);
  const canApply = mode !== "custom" || Boolean(customValid);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canApply) onApply(mode, mode === "custom" ? customValid : undefined);
      }}
    >
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Compare with</legend>
        {compareModes.map((m) => (
          <Choice
            key={m.id}
            name="compare"
            checked={mode === m.id}
            onChange={() => setMode(m.id)}
            label={m.label}
            detail={m.id === "previous" || m.id === "year" ? rangeText(compareRange(m.id, range)) : undefined}
          />
        ))}
      </fieldset>
      {mode === "custom" && <DateInputs value={custom} onChange={setCustom} today={today} />}
      {!canApply && <p className="mt-2 text-xs text-danger">{rangeError}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" disabled={!canApply}>Apply</Button>
      </div>
    </form>
  );
}
