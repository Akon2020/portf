"use client";

import { useEffect, useRef, useState } from "react";

interface StatItem {
  id: string;
  label: string;
  value: string;
  suffix: string | null;
}

/** Counts up once when visible. Non numeric values and reduced motion show the final value. */
function AnimatedValue({ value }: { value: string }) {
  const target = Number(value.replace(/[\s,]/g, ""));
  const numeric = Number.isFinite(target) && /^[\d\s,]+$/.test(value);
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const node = ref.current;
    if (!numeric || !node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / 1200);
        const eased = 1 - (1 - progress) ** 3;
        setDisplay(Math.round(target * eased).toLocaleString("fr-FR"));
        if (progress < 1) frame = requestAnimationFrame(step);
      };
      setDisplay("0");
      frame = requestAnimationFrame(step);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [numeric, target]);

  return (
    <span ref={ref} aria-hidden="true">
      {display}
    </span>
  );
}

export function StatsRow({ stats }: { stats: StatItem[] }) {
  if (stats.length === 0) return null;
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-t pt-6 sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.id} className="flex flex-col-reverse gap-1">
          <dt className="text-sm text-muted-foreground">{stat.label}</dt>
          <dd className="font-heading text-4xl font-medium tabular-nums">
            <span className="sr-only">
              {stat.value}
              {stat.suffix}
            </span>
            <AnimatedValue value={stat.value} />
            {stat.suffix && <span aria-hidden="true" className="text-accent">{stat.suffix}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
