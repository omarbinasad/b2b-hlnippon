import { company } from "@/config/runtime";
import type { FieldErrors } from "@/lib/types";

export const clone = <T,>(value: T): T => structuredClone(value);

export const invalid = (errors: FieldErrors) => ({ ok: false as const, errors, message: "Some fields need attention." });

/** Current time in the store's time zone with its offset, the format the mock timestamps use. */
export function now() {
  const timeZone = company().locale.timeZone;
  const d = new Date();
  const local = new Intl.DateTimeFormat("sv-SE", { timeZone, dateStyle: "short", timeStyle: "medium" }).format(d).replace(" ", "T");
  const offset = new Intl.DateTimeFormat("en", { timeZone, timeZoneName: "longOffset" }).formatToParts(d).find((p) => p.type === "timeZoneName")?.value.replace("GMT", "");
  return `${local}${offset || "+00:00"}`;
}
