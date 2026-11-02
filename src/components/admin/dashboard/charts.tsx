import { EmptyState } from "@/components/ui/feedback";
import { formatCalendarDateShort, formatMoney, formatMoneyCompact, formatNumber } from "@/lib/format";
import { orderStatusLabels } from "@/lib/orders/status";
import type { OrderStatus, SeriesPoint } from "@/lib/types";

/* Server-rendered SVG charts — no chart library or client JavaScript. Axis labels are
   HTML so text stays readable at any width while the plot stretches. */

const W = 1000;
const H = 300;

/** Axis maximum = 4 × a "nice" step, so all tick labels are round numbers. */
function niceMax(value: number) {
  if (value <= 0) return 4;
  const rawStep = value / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * magnitude >= rawStep)!;
  return step * magnitude * 4;
}

/** Smooth path through points (Catmull-Rom → cubic Bézier), clamped to the plot. */
function smoothPath(points: [number, number][]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M0,${points[0][1]} L${W},${points[0][1]}`;
  const clampY = (y: number) => Math.min(H, Math.max(0, y));
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, clampY(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, clampY(p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

interface RevenueChartProps {
  current: SeriesPoint[];
  previous?: SeriesPoint[];
  currentLabel: string;
  previousLabel?: string;
  granularity: "day" | "week";
}

export function RevenueChart({ current, previous, currentLabel, previousLabel, granularity }: RevenueChartProps) {
  const n = current.length;
  const prev = previous?.slice(0, n);
  const max = niceMax(Math.max(...current.map((p) => p.value), ...(prev ?? []).map((p) => p.value)));
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => f * max);
  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - (v / max) * H;
  const toPoints = (s: SeriesPoint[]) => s.map((p, i) => [x(i), y(p.value)] as [number, number]);

  const currentLine = smoothPath(toPoints(current));
  const previousLine = prev?.length ? smoothPath(toPoints(prev)) : undefined;
  const area = (line: string, count: number) => `${line} L${x(count - 1)},${H} L${x(0)},${H} Z`;

  const labelEvery = Math.max(1, Math.ceil(n / 6));
  const xLabels = current.map((p, i) => ({ i, date: p.date })).filter(({ i }) => i % labelEvery === 0);
  const total = current.reduce((s, p) => s + p.value, 0);
  const previousTotal = prev?.reduce((s, p) => s + p.value, 0);

  return (
    <figure>
      <figcaption className="sr-only">
        Revenue by {granularity} for {currentLabel}: {formatMoney(total)} in total
        {previousLabel && previousTotal !== undefined && `, compared with ${formatMoney(previousTotal)} for ${previousLabel}`}.
      </figcaption>

      <div className="flex gap-2">
        {/* Y axis */}
        <div aria-hidden className="relative h-52 w-12 shrink-0 text-right text-[11px] text-muted sm:h-64 sm:w-16 xl:h-72">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2 tabular-nums" style={{ top: `${(1 - t / max) * 100}%` }}>
              {formatMoneyCompact(t)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-52 sm:h-64 xl:h-72">
            <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
              <defs>
                <linearGradient id="rev-current" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" style={{ stopColor: "var(--chart-current)", stopOpacity: 0.28 }} />
                  <stop offset="100%" style={{ stopColor: "var(--chart-current)", stopOpacity: 0.02 }} />
                </linearGradient>
                <linearGradient id="rev-previous" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" style={{ stopColor: "var(--chart-previous)", stopOpacity: 0.12 }} />
                  <stop offset="100%" style={{ stopColor: "var(--chart-previous)", stopOpacity: 0 }} />
                </linearGradient>
              </defs>
              {ticks.map((t) => (
                <line key={t} x1="0" x2={W} y1={y(t)} y2={y(t)} style={{ stroke: "var(--chart-grid)" }} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
              ))}
              {previousLine && (
                <>
                  <path d={area(previousLine, prev!.length)} fill="url(#rev-previous)" />
                  <path d={previousLine} fill="none" style={{ stroke: "var(--chart-previous)" }} strokeWidth="2" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
                </>
              )}
              <path d={area(currentLine, n)} fill="url(#rev-current)" />
              <path d={currentLine} fill="none" style={{ stroke: "var(--chart-current)" }} strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
          {/* X axis */}
          <div aria-hidden className="relative mt-2 h-4 text-[11px] text-muted">
            {xLabels.map(({ i, date }, k) => (
              <span
                key={date}
                className={`absolute whitespace-nowrap ${k % 2 ? "hidden sm:block" : ""}`}
                style={{ left: `${(x(i) / W) * 100}%`, transform: i === 0 ? "none" : i === n - 1 ? "translateX(-100%)" : "translateX(-50%)" }}
              >
                {formatCalendarDateShort(date)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-muted hover:text-foreground">Show data table</summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-ui border border-line">
          <table className="w-full text-left text-xs [&_td]:border-t [&_td]:border-line [&_td]:px-3 [&_td]:py-1.5 [&_th]:bg-surface-muted [&_th]:px-3 [&_th]:py-2">
            <thead>
              <tr>
                <th scope="col">{granularity === "day" ? "Day" : "Week from"}</th>
                <th scope="col" className="text-right">Revenue</th>
                {prev && <th scope="col" className="text-right">Comparison</th>}
              </tr>
            </thead>
            <tbody>
              {current.map((p, i) => (
                <tr key={p.date}>
                  <td>{formatCalendarDateShort(p.date)}</td>
                  <td className="text-right tabular-nums">{formatMoney(p.value)}</td>
                  {prev && <td className="text-right tabular-nums">{prev[i] ? formatMoney(prev[i].value) : "—"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

const statusOrder: OrderStatus[] = ["delivered", "on_the_way", "preparing", "received", "cancelled"];

export function StatusDonut({ data }: { data: { status: OrderStatus; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <EmptyState title="No orders in this period" />;

  const r = 48;
  const circumference = 2 * Math.PI * r;
  const gap = data.filter((d) => d.count > 0).length > 1 ? 1.5 : 0;
  const sorted = statusOrder.map((s) => data.find((d) => d.status === s)!).filter(Boolean);
  const segments = sorted.map(({ status, count }, i) => ({
    status,
    count,
    length: (count / total) * circumference,
    start: (sorted.slice(0, i).reduce((s, d) => s + d.count, 0) / total) * circumference,
  }));

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row lg:flex-col 2xl:flex-row">
      <div className="relative size-44 shrink-0">
        <svg aria-hidden viewBox="0 0 120 120" className="size-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" strokeWidth="16" style={{ stroke: "var(--surface-muted)" }} />
          {segments
            .filter((s) => s.count > 0)
            .map(({ status, length, start }) => (
              <circle
                key={status}
                cx="60"
                cy="60"
                r={r}
                fill="none"
                strokeWidth="16"
                style={{ stroke: `var(--status-${status})` }}
                strokeDasharray={`${Math.max(0, length - gap)} ${circumference}`}
                strokeDashoffset={-start}
              />
            ))}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <span className="text-2xl font-semibold tabular-nums">{formatNumber(total)}</span>
          <span className="text-xs text-muted">Total orders</span>
        </div>
      </div>

      <table className="w-full max-w-xs text-sm">
        <caption className="sr-only">Orders by status</caption>
        <tbody>
          {sorted.map(({ status, count }) => (
            <tr key={status}>
              <th scope="row" className="py-1.5 text-left font-normal">
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden className="size-3 rounded-full" style={{ background: `var(--status-${status})` }} />
                  {orderStatusLabels[status]}
                </span>
              </th>
              <td className="py-1.5 text-right font-semibold tabular-nums">{formatNumber(count)}</td>
              <td className="w-14 py-1.5 text-right text-muted tabular-nums">{Math.round((count / total) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
