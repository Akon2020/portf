import type { LocalizedText } from "@/server/db/schema/content";

export type { LocalizedText };
export type ContentLocale = "fr" | "en";

/** Reads a localized value, falling back to French when the English text is empty. */
export function tr(value: LocalizedText | null | undefined, locale: ContentLocale | string): string {
  if (!value) return "";
  if (locale === "en" && value.en && value.en.trim()) return value.en;
  return value.fr ?? "";
}

export function missingEnglish(value: LocalizedText | null | undefined): boolean {
  return !!value?.fr?.trim() && !value.en?.trim();
}

export function emptyLocalized(): LocalizedText {
  return { fr: "", en: "" };
}

/** Splits a localized multi line text into paragraphs. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Picks the language actually used to display a localized value: the requested
 * one when filled, otherwise the other one. Lets an article written only in
 * English still be read from the French site, with the right lang attribute.
 */
export function pickLocalized(value: LocalizedText | null | undefined, locale: ContentLocale | string): { text: string; lang: ContentLocale } {
  const fr = value?.fr?.trim() ? value.fr : "";
  const en = value?.en?.trim() ? value.en : "";
  if (locale === "en") return en ? { text: en, lang: "en" } : { text: fr, lang: "fr" };
  return fr ? { text: fr, lang: "fr" } : { text: en, lang: "en" };
}
