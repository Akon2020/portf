/**
 * Typographic clean-up applied to every piece of content before it is stored.
 *
 * Rules:
 * - The em dash (U+2014) is never allowed. Used as punctuation between words it
 *   becomes a comma. Between two numbers it becomes a range word.
 * - The en dash (U+2013) used as punctuation is treated the same way.
 * - In French, a non-breaking space is placed before ":" and a narrow
 *   non-breaking space before ";", "!" and "?", plus inside guillemets.
 */

export type TypographyLocale = "fr" | "en";

export const EM_DASH = "\u{2014}";
export const EN_DASH = "\u{2013}";
export const NBSP = "\u{A0}";
export const NNBSP = "\u{202F}";

const RANGE_WORD: Record<TypographyLocale, string> = { fr: "à", en: "to" };

const NUMERIC_RANGE = /(\d)\s*[\u{2013}\u{2014}]\s*(\d)/gu;
const LEADING_DASH = /(^|\n)[ \t]*[\u{2013}\u{2014}][ \t]*/gu;
const TRAILING_DASH = /[ \t]*[\u{2013}\u{2014}][ \t]*(?=\n|$)/gu;
const PUNCTUATION_DASH = /[ \t]*[\u{2013}\u{2014}]+[ \t]*/gu;

/** Removes em and en dashes used as punctuation. */
export function replaceDashes(input: string, locale: TypographyLocale = "fr"): string {
  if (!input.includes(EM_DASH) && !input.includes(EN_DASH)) return input;
  return input
    .replace(NUMERIC_RANGE, `$1 ${RANGE_WORD[locale]} $2`)
    .replace(LEADING_DASH, "$1")
    .replace(TRAILING_DASH, "")
    .replace(PUNCTUATION_DASH, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/\s+,/g, ",");
}

/** Applies French spacing rules around high punctuation and guillemets. */
export function applyFrenchSpacing(input: string): string {
  return (
    input
      // Existing regular space before high punctuation becomes non-breaking.
      .replace(/[ \u{A0}\u{202F}]+:(?=\s|$)/gu, `${NBSP}:`)
      .replace(/[ \u{A0}\u{202F}]+([;!?])/gu, `${NNBSP}$1`)
      // Missing space after a word, only when the sign closes a phrase,
      // so URLs ("?q=") and times ("14:00") are left untouched.
      .replace(/([\p{L}\p{N})\]"»])([;!?]+)(?=\s|$)/gu, `$1${NNBSP}$2`)
      .replace(/([\p{L})\]"»]):(?=\s|$)/gu, `$1${NBSP}:`)
      // Guillemets
      .replace(/«[ \u{A0}\u{202F}]*/gu, `«${NBSP}`)
      .replace(/[ \u{A0}\u{202F}]*»/gu, `${NBSP}»`)
  );
}

/** Full clean-up pipeline for user-entered text. */
export function cleanTypography(input: string, locale: TypographyLocale = "fr"): string {
  let output = replaceDashes(input, locale);
  if (locale === "fr") output = applyFrenchSpacing(output);
  return output;
}

/** Applies the clean-up to every value of a localized text object. */
export function cleanLocalizedText<T extends Partial<Record<TypographyLocale, string>>>(
  value: T,
): T {
  const result = { ...value };
  for (const locale of Object.keys(result) as TypographyLocale[]) {
    const text = result[locale];
    if (typeof text === "string") {
      (result as Record<string, string>)[locale] = cleanTypography(text, locale);
    }
  }
  return result;
}
