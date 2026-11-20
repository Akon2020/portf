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
