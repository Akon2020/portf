/**
 * Small server rendered charts (SVG and CSS, no client JavaScript), each with
 * an equivalent table for screen readers.
 */

export interface Point {
  label: string;
  /** Short label printed under the axis, empty to skip. */
  tick?: string;
  value: number;
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

/** Area chart for a daily series. */
export function AreaChart({ points, caption, format = (value) => value.toLocaleString("fr-FR"), height = 160 }: { points: Point[]; caption: string; format?: (value: number) => string; height?: number }) {
  const width = 600;
  const max = niceMax(Math.max(0, ...points.map((point) => point.value)));
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const coords = points.map((point, index) => [index * step, height - (point.value / max) * (height - 8) - 4] as const);
  const line = coords.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <figure className="m-0">
      <div className="relative">
        <span className="absolute left-0 top-0 text-[10px] text-muted-foreground">{format(max)}</span>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-40 w-full overflow-visible" aria-hidden="true">
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line key={ratio} x1="0" x2={width} y1={height * ratio} y2={height * ratio} className="stroke-border" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={area} className="fill-accent/15" />
          <path d={line} className="fill-none stroke-accent" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground" aria-hidden="true">
        {points
          .filter((point) => point.tick)
          .map((point) => (
            <span key={point.label}>{point.tick}</span>
          ))}
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {points.map((point) => (
            <tr key={point.label}>
              <th scope="row">{point.label}</th>
              <td>{format(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Vertical bars, for monthly amounts. */
export function BarChart({ points, caption, format = (value) => value.toLocaleString("fr-FR"), tone = "bg-accent/85" }: { points: Point[]; caption: string; format?: (value: number) => string; tone?: string }) {
  const max = niceMax(Math.max(0, ...points.map((point) => point.value)));
  return (
    <figure className="m-0">
      <div className="relative">
        <span className="absolute -top-1 left-0 text-[10px] text-muted-foreground">{format(max)}</span>
        <div className="flex h-36 items-end gap-1.5 border-b pt-4" aria-hidden="true">
          {points.map((point) => (
            <div key={point.label} className="group relative flex h-full flex-1 items-end">
              <div className={`w-full rounded-t ${tone}`} style={{ height: `${point.value ? Math.max(3, (point.value / max) * 100) : 0}%` }} />
              <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background group-hover:block">
                {format(point.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-1.5 text-center text-[10px] text-muted-foreground" aria-hidden="true">
        {points.map((point) => (
          <span key={point.label} className="flex-1 truncate">
            {point.tick ?? ""}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {points.map((point) => (
            <tr key={point.label}>
              <th scope="row">{point.label}</th>
              <td>{format(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

const DONUT_COLORS = ["var(--accent)", "var(--info)", "var(--success)", "var(--warning)", "var(--danger)", "var(--muted-foreground)", "#7C3AED", "#0F766E"];

/** Donut with its legend, for distributions by status. */
export function Donut({ segments, caption, centerLabel }: { segments: { label: string; value: number }[]; caption: string; centerLabel: string }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = 15.9155;
  let offset = 25;
  const visible = segments.filter((segment) => segment.value > 0);
  return (
    <figure className="m-0 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative size-32 shrink-0">
        <svg viewBox="0 0 42 42" className="size-full -rotate-0" aria-hidden="true">
          <circle cx="21" cy="21" r={radius} fill="none" className="stroke-surface" strokeWidth="6" />
          {total > 0 &&
            visible.map((segment, index) => {
              const share = (segment.value / total) * 100;
              const dash = `${share} ${100 - share}`;
              const circle = (
                <circle
                  key={segment.label}
                  cx="21"
                  cy="21"
                  r={radius}
                  fill="none"
                  stroke={DONUT_COLORS[index % DONUT_COLORS.length]}
                  strokeWidth="6"
                  strokeDasharray={dash}
                  strokeDashoffset={offset}
                />
              );
              offset -= share;
              return circle;
            })}
        </svg>
        <span className="absolute inset-0 grid place-items-center text-center">
          <span>
            <span className="block text-xl font-semibold tabular-nums">{total}</span>
            <span className="block text-[10px] text-muted-foreground">{centerLabel}</span>
          </span>
        </span>
      </div>
      <ul className="w-full space-y-1.5 text-sm" aria-label={caption}>
        {visible.length === 0 ? (
          <li className="text-muted-foreground">Aucune donnée.</li>
        ) : (
          visible.map((segment, index) => (
            <li key={segment.label} className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }} />
              <span className="flex-1 truncate">{segment.label}</span>
              <span className="font-medium tabular-nums">{segment.value}</span>
              <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{Math.round((segment.value / total) * 100)} %</span>
            </li>
          ))
        )}
      </ul>
      <figcaption className="sr-only">{caption}</figcaption>
    </figure>
  );
}
