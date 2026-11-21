/**
 * Subset of RFC 5545 recurrence rules used by tasks:
 * FREQ=DAILY|WEEKLY|MONTHLY, INTERVAL=n, BYDAY=MO,TU... (weekly only).
 * Dates are computed in Africa/Lubumbashi (UTC+2, no daylight saving time).
 */

const OFFSET_MS = 2 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface Recurrence {
  freq: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number;
  byDay: Weekday[];
}

export function parseRule(rule: string | null | undefined): Recurrence | null {
  if (!rule) return null;
  const parts = Object.fromEntries(
    rule
      .toUpperCase()
      .split(";")
      .map((part) => part.split("=") as [string, string])
      .filter(([key, value]) => key && value),
  );
  const freq = parts.FREQ;
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY") return null;
  const interval = Math.min(Math.max(Number.parseInt(parts.INTERVAL ?? "1", 10) || 1, 1), 365);
  const byDay = (parts.BYDAY ?? "")
    .split(",")
    .filter((day: string): day is Weekday => (WEEKDAYS as readonly string[]).includes(day));
  return { freq, interval, byDay: freq === "WEEKLY" ? byDay : [] };
}

export function formatRule(recurrence: Recurrence): string {
  const parts = [`FREQ=${recurrence.freq}`];
  if (recurrence.interval > 1) parts.push(`INTERVAL=${recurrence.interval}`);
  if (recurrence.freq === "WEEKLY" && recurrence.byDay.length) parts.push(`BYDAY=${recurrence.byDay.join(",")}`);
  return parts.join(";");
}

/** Next occurrence strictly after `from`, keeping the local time of day. */
export function nextOccurrence(rule: string | null | undefined, from: Date): Date | null {
  const recurrence = parseRule(rule);
  if (!recurrence) return null;
  const local = new Date(from.getTime() + OFFSET_MS);
  const toUtc = (date: Date) => new Date(date.getTime() - OFFSET_MS);

  if (recurrence.freq === "DAILY") return new Date(from.getTime() + recurrence.interval * DAY_MS);

  if (recurrence.freq === "WEEKLY") {
    const days = recurrence.byDay.length ? recurrence.byDay.map((day) => WEEKDAYS.indexOf(day)) : [local.getUTCDay()];
    const current = local.getUTCDay();
    const later = days.filter((day) => day > current).sort((a, b) => a - b)[0];
    if (later !== undefined) return new Date(from.getTime() + (later - current) * DAY_MS);
    // Wraps to the first chosen day of the next active week.
    const first = Math.min(...days);
    const step = 7 - current + first + (recurrence.interval - 1) * 7;
    return new Date(from.getTime() + step * DAY_MS);
  }

  // Monthly: same day of month, clamped to the last day of shorter months.
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth() + recurrence.interval;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const next = new Date(Date.UTC(year, month, Math.min(local.getUTCDate(), lastDay), local.getUTCHours(), local.getUTCMinutes()));
  return toUtc(next);
}

const DAY_NAMES: Record<Weekday, string> = { MO: "lundi", TU: "mardi", WE: "mercredi", TH: "jeudi", FR: "vendredi", SA: "samedi", SU: "dimanche" };

/** Short French description, for example "chaque lundi" or "tous les 2 jours". */
export function describeRule(rule: string | null | undefined): string | null {
  const recurrence = parseRule(rule);
  if (!recurrence) return null;
  const { freq, interval, byDay } = recurrence;
  if (freq === "DAILY") return interval === 1 ? "chaque jour" : `tous les ${interval} jours`;
  if (freq === "MONTHLY") return interval === 1 ? "chaque mois" : `tous les ${interval} mois`;
  const weekdays = ["MO", "TU", "WE", "TH", "FR"];
  if (byDay.length === 5 && weekdays.every((day) => byDay.includes(day as Weekday))) return "chaque jour ouvré";
  const names = byDay.map((day) => DAY_NAMES[day]).join(", ");
  if (interval === 1) return names ? `chaque ${names}` : "chaque semaine";
  return names ? `toutes les ${interval} semaines (${names})` : `toutes les ${interval} semaines`;
}

export const RECURRENCE_PRESETS = [
  { value: "", label: "Aucune" },
  { value: "FREQ=DAILY", label: "Chaque jour" },
  { value: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", label: "Chaque jour ouvré" },
  { value: "FREQ=WEEKLY", label: "Chaque semaine (même jour)" },
  { value: "FREQ=WEEKLY;INTERVAL=2", label: "Toutes les 2 semaines" },
  { value: "FREQ=MONTHLY", label: "Chaque mois (même date)" },
] as const;
