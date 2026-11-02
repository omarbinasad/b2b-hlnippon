"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { siteConfig } from "@/config/site";
import { cx } from "@/lib/cx";
import { addDays, isISODate, todayIn } from "@/lib/date-range";
import { Field } from "./field";
import { Icon } from "./icons";

/*
 * Accessible date picker (no library). Values are calendar dates "YYYY-MM-DD".
 * Labels are formatted with fixed English names (not Intl) so server and
 * browser render identical text. Keyboard: arrows (day/week), Home/End (week),
 * PageUp/PageDown (month, +Shift: year), Enter/Space (select), Escape (close).
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK_START = siteConfig.weekStartsOn;
const PANEL_WIDTH = 296;

const ymd = (date: string) => [Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10))] as const;
const fromUTC = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const monthStart = (date: string) => `${date.slice(0, 8)}01`;
const startOfWeek = (date: string) => addDays(date, -((weekday(date) - WEEK_START + 7) % 7));

/** Same day in another month, clamped to that month's length. */
function addMonths(date: string, months: number) {
  const [y, m, d] = ymd(date);
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return fromUTC(Date.UTC(y, m - 1 + months, Math.min(d, lastDay)));
}

const clamp = (date: string, min?: string, max?: string) => (min && date < min ? min : max && date > max ? max : date);

/** "1 Sep 2026" */
export function formatPickerDate(date: string) {
  const [y, m, d] = ymd(date);
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
}
const longLabel = (date: string) => {
  const [y, m, d] = ymd(date);
  return `${WEEKDAYS[weekday(date)]}, ${d} ${MONTHS[m - 1]} ${y}`;
};

export interface DatePickerProps {
  id: string;
  /** Form field name; submits the value through a hidden input (omitted when empty). */
  name?: string;
  /** Controlled value; pass together with `onChange`. */
  value?: string;
  /** Uncontrolled initial value. */
  defaultValue?: string;
  onChange?: (value: string | undefined) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  /** Highlights the span between two dates (for from/to pairs). */
  rangeStart?: string;
  rangeEnd?: string;
}

export function DatePicker({
  id,
  name,
  value,
  defaultValue,
  onChange,
  min,
  max,
  placeholder = "Select date",
  rangeStart,
  rangeEnd,
}: DatePickerProps) {
  const controlled = onChange !== undefined;
  const [inner, setInner] = useState(isISODate(defaultValue) ? defaultValue : undefined);
  const current = controlled ? (isISODate(value) ? value : undefined) : inner;

  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState("");
  const [alignRight, setAlignRight] = useState(false);
  const [today, setToday] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLTableElement>(null);
  /** Set when keyboard navigation (or opening) should move focus to the focused day. */
  const focusDay = useRef(false);
  const dialogId = useId();
  const headingId = useId();

  const commit = (next: string | undefined) => {
    if (!controlled) setInner(next);
    onChange?.(next);
  };

  const openPicker = () => {
    const now = todayIn(siteConfig.timeZone);
    const rect = triggerRef.current?.getBoundingClientRect();
    setToday(now);
    setFocused(clamp(current ?? now, min, max));
    setAlignRight(!!rect && rect.left + PANEL_WIDTH > window.innerWidth - 8);
    focusDay.current = true;
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    if (focusDay.current) {
      focusDay.current = false;
      gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();
    }
  }, [open, focused]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const isDisabled = (date: string) => Boolean((min && date < min) || (max && date > max));

  const select = (date: string) => {
    if (isDisabled(date)) return;
    commit(date);
    close();
  };

  const onDayKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const keys: Record<string, () => string> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      Home: () => startOfWeek(focused),
      End: () => addDays(startOfWeek(focused), 6),
      PageUp: () => addMonths(focused, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focused, e.shiftKey ? 12 : 1),
    };
    const next = keys[e.key]?.();
    if (!next) return;
    e.preventDefault();
    focusDay.current = true;
    setFocused(clamp(next, min, max));
  };

  // Calendar grid: always 6 weeks so the panel height never jumps.
  const first = focused ? monthStart(focused) : "";
  const gridStart = first ? startOfWeek(first) : "";
  const days = gridStart ? Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)) : [];
  const weeks = Array.from({ length: 6 }, (_, w) => days.slice(w * 7, w * 7 + 7));
  const [viewYear, viewMonth] = focused ? ymd(focused) : [0, 0];
  const todayYear = today ? Number(today.slice(0, 4)) : 0;
  const minYear = min ? Number(min.slice(0, 4)) : todayYear - 10;
  const maxYear = max ? Number(max.slice(0, 4)) : todayYear + 2;
  const years = Array.from({ length: Math.max(1, maxYear - minYear + 1) }, (_, i) => minYear + i);
  const weekdayOrder = Array.from({ length: 7 }, (_, i) => (WEEK_START + i) % 7);
  const inRange = (d: string) => Boolean(rangeStart && rangeEnd && d > rangeStart && d < rangeEnd);
  const isEndpoint = (d: string) => d === rangeStart || d === rangeEnd;

  const navButton = "grid size-8 place-items-center rounded-full text-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-30";
  const headerSelect = "h-8 rounded-ui bg-transparent px-1.5 text-sm font-semibold hover:bg-surface-muted";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={() => (open ? close() : openPicker())}
        className={cx(
          "flex h-10 w-full items-center gap-2 rounded-ui border border-line bg-surface px-3 text-left text-base sm:text-sm",
          "hover:border-muted/60",
          open && "border-brand",
        )}
      >
        <Icon name="calendar" className="size-4 shrink-0 text-muted" />
        <span className={cx("min-w-0 flex-1 truncate", !current && "text-muted")}>
          {current ? formatPickerDate(current) : placeholder}
        </span>
        <Icon name="chevronDown" className={cx("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {name && <input type="hidden" name={name} value={current ?? ""} disabled={!current} />}

      {open && focused && (
        <div
          id={dialogId}
          role="dialog"
          aria-label="Choose date"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              // Stop here so an enclosing popover stays open.
              e.stopPropagation();
              e.preventDefault(); // marks the key as handled for document-level listeners (e.g. Popover)
              close();
            }
          }}
          className={cx(
            "absolute top-full z-50 mt-2 rounded-ui border border-line bg-surface p-3 shadow-xl",
            alignRight ? "right-0" : "left-0",
          )}
          style={{ width: PANEL_WIDTH }}
        >
          <div className="mb-2 flex items-center justify-between gap-1">
            <button type="button" className={navButton} onClick={() => setFocused(clamp(addMonths(focused, -1), min, max))} aria-label="Previous month">
              <Icon name="chevronRight" className="size-4 rotate-180" />
            </button>
            <div id={headingId} className="flex items-center" aria-live="polite">
              <label className="sr-only" htmlFor={`${dialogId}-m`}>Month</label>
              <select
                id={`${dialogId}-m`}
                className={headerSelect}
                value={viewMonth}
                onChange={(e) => setFocused(clamp(addMonths(focused, Number(e.target.value) - viewMonth), min, max))}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <label className="sr-only" htmlFor={`${dialogId}-y`}>Year</label>
              <select
                id={`${dialogId}-y`}
                className={headerSelect}
                value={viewYear}
                onChange={(e) => setFocused(clamp(addMonths(focused, (Number(e.target.value) - viewYear) * 12), min, max))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button type="button" className={navButton} onClick={() => setFocused(clamp(addMonths(focused, 1), min, max))} aria-label="Next month">
              <Icon name="chevronRight" className="size-4" />
            </button>
          </div>

          <table ref={gridRef} role="grid" aria-labelledby={headingId} className="w-full border-collapse text-center text-sm">
            <thead>
              <tr>
                {weekdayOrder.map((d) => (
                  <th key={d} scope="col" abbr={WEEKDAYS[d]} className="pb-1 text-xs font-medium text-muted">
                    {WEEKDAYS[d].slice(0, 2)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week[0]}>
                  {week.map((d) => {
                    const outside = d.slice(0, 7) !== first.slice(0, 7);
                    const selected = d === current;
                    const disabled = isDisabled(d);
                    const between = inRange(d);
                    return (
                      <td key={d} role="gridcell" aria-selected={selected} className={cx("p-0.5", between && "bg-brand-soft")}>
                        <button
                          type="button"
                          data-date={d}
                          tabIndex={d === focused ? 0 : -1}
                          aria-label={`${longLabel(d)}${d === today ? " (today)" : ""}`}
                          aria-disabled={disabled || undefined}
                          onClick={() => select(d)}
                          onKeyDown={onDayKey}
                          className={cx(
                            "grid size-9 w-full place-items-center rounded-full tabular-nums transition-colors",
                            outside && "text-muted/60",
                            disabled ? "cursor-not-allowed opacity-30" : "hover:bg-surface-muted",
                            d === today && !selected && "font-semibold text-brand ring-1 ring-brand/50 ring-inset",
                            (selected || isEndpoint(d)) && "bg-brand font-semibold text-brand-contrast hover:bg-brand-hover",
                          )}
                        >
                          {Number(d.slice(8))}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            <button
              type="button"
              className="rounded-ui px-2 py-1 text-sm font-medium text-brand hover:bg-brand-soft disabled:opacity-40"
              disabled={isDisabled(today)}
              onClick={() => select(today)}
            >
              Today
            </button>
            <button
              type="button"
              className="rounded-ui px-2 py-1 text-sm font-medium text-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-40"
              disabled={!current}
              onClick={() => {
                commit(undefined);
                close();
              }}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface DateRangeFieldsProps {
  idPrefix: string;
  fromLabel: string;
  toLabel: string;
  defaultFrom?: string;
  defaultTo?: string;
  /** Latest selectable date, e.g. today. */
  max?: string;
  /** Wrapper class for each field (layout in the parent). */
  className?: string;
}

/** From/To pair submitted as `from` and `to`; each picker limits the other so the range stays valid. */
export function DateRangeFields({ idPrefix, fromLabel, toLabel, defaultFrom, defaultTo, max, className }: DateRangeFieldsProps) {
  const [from, setFrom] = useState(isISODate(defaultFrom) ? defaultFrom : undefined);
  const [to, setTo] = useState(isISODate(defaultTo) ? defaultTo : undefined);
  return (
    <>
      <div className={className}>
        <Field id={`${idPrefix}-from`} label={fromLabel}>
          <DatePicker id={`${idPrefix}-from`} name="from" value={from} onChange={setFrom} max={to ?? max} rangeStart={from} rangeEnd={to} placeholder="Any date" />
        </Field>
      </div>
      <div className={className}>
        <Field id={`${idPrefix}-to`} label={toLabel}>
          <DatePicker id={`${idPrefix}-to`} name="to" value={to} onChange={setTo} min={from} max={max} rangeStart={from} rangeEnd={to} placeholder="Any date" />
        </Field>
      </div>
    </>
  );
}
