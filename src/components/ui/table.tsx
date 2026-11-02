import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

const densities = {
  normal: "min-w-[36rem] [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-2.5",
  /** For tables inside dashboard panels: no minimum width, tighter cells. */
  compact: "[&_td]:px-2.5 [&_td]:py-2.5 [&_th]:px-2.5 [&_th]:py-2",
};

/**
 * Styled, horizontally scrollable table wrapper. Use plain <thead>/<tbody>/<th>/<td>
 * inside; right-align numeric cells with `className="text-right tabular-nums"`.
 */
export function Table({ caption, density = "normal", children }: { caption?: string; density?: keyof typeof densities; children: ReactNode }) {
  return (
    // `relative` keeps absolutely positioned descendants (e.g. sr-only text) inside the scroll box.
    <div className="relative overflow-x-auto rounded-ui border border-line bg-surface">
      <table
        className={cx(
          "w-full border-collapse text-left text-sm [&_td]:border-t [&_td]:border-line",
          "[&_th]:bg-surface-muted [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-wide [&_th]:text-muted [&_th]:uppercase",
          densities[density],
        )}
      >
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}
