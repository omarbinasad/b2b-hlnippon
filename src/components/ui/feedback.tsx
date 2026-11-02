import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-ui border border-dashed border-line bg-surface px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const noticeTones = {
  info: "border-info/30 bg-info-soft text-info",
  warning: "border-warning/30 bg-warning-soft text-warning",
  success: "border-success/30 bg-success-soft text-success",
} as const;

/** Inline notice, e.g. to flag preview/mock functionality. */
export function Notice({ tone = "info", title, children }: { tone?: keyof typeof noticeTones; title?: string; children: ReactNode }) {
  return (
    <div role="note" className={cx("rounded-ui border px-4 py-3 text-sm", noticeTones[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={cx(title && "mt-0.5")}>{children}</div>
    </div>
  );
}

/** Marks a route that exists but is not built yet, listing what is planned. */
export function PlannedFeatures({ items }: { items: string[] }) {
  return (
    <section aria-labelledby="planned-heading" className="rounded-ui border border-dashed border-line bg-surface p-4 sm:p-5">
      <h2 id="planned-heading" className="text-sm font-semibold">
        Planned for this page <span className="font-normal text-muted">(not built yet)</span>
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse rounded-ui bg-surface-muted", className)} />;
}
