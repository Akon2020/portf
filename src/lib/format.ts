export type AppLocale = "fr" | "en";

type DateInput = Date | string | number;

export interface FormatPeriodOptions {
  /** "year" (default) prints 2023, "month" prints janv. 2023 / Jan 2023. */
  granularity?: "year" | "month";
}

const PRESENT: Record<AppLocale, string> = { fr: "aujourd’hui", en: "present" };
const RANGE_WORD: Record<AppLocale, string> = { fr: "à", en: "to" };

function toDate(value: DateInput): Date {
  if (value instanceof Date) return value;
  // A bare year such as 2023 or "2023" is read as January 1st of that year.
  if (typeof value === "number" || /^\d{4}$/.test(value)) {
    return new Date(Date.UTC(Number(value), 0, 1));
  }
  return new Date(value);
}

function formatPoint(date: Date, locale: AppLocale, granularity: "year" | "month"): string {
  if (granularity === "year") return String(date.getUTCFullYear());
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Formats a period without any dash.
 * formatPeriod(2023, null, "fr") gives "2023 à aujourd’hui".
 * formatPeriod(2021, 2025, "en") gives "2021 to 2025".
 */
export function formatPeriod(
  start: DateInput,
  end: DateInput | null | undefined,
  locale: AppLocale = "fr",
  options: FormatPeriodOptions = {},
): string {
  const granularity = options.granularity ?? "year";
  const from = formatPoint(toDate(start), locale, granularity);
  if (end === null || end === undefined) {
    return `${from} ${RANGE_WORD[locale]} ${PRESENT[locale]}`;
  }
  const to = formatPoint(toDate(end), locale, granularity);
  if (from === to) return from;
  return `${from} ${RANGE_WORD[locale]} ${to}`;
}
