import { describe, expect, it } from "vitest";
import {
  NBSP,
  NNBSP,
  cleanLocalizedText,
  cleanTypography,
  replaceDashes,
} from "@/lib/typography";

const EM = "\u{2014}";
const EN = "\u{2013}";

describe("replaceDashes", () => {
  it("turns an em dash between words into a comma", () => {
    expect(replaceDashes(`les bons problèmes ${EM} pas pour remplir une liste`)).toBe(
      "les bons problèmes, pas pour remplir une liste",
    );
  });

  it("handles em dashes without surrounding spaces", () => {
    expect(replaceDashes(`Isaac${EM}ingénieur`)).toBe("Isaac, ingénieur");
  });

  it("turns numeric ranges into words", () => {
    expect(replaceDashes(`2022 ${EM} 2024`, "fr")).toBe("2022 à 2024");
    expect(replaceDashes(`2022${EN}2024`, "en")).toBe("2022 to 2024");
  });

  it("removes leading dialogue dashes and trailing dashes", () => {
    expect(replaceDashes(`${EM} Bonjour`)).toBe("Bonjour");
    expect(replaceDashes(`Fin ${EM}`)).toBe("Fin");
  });

  it("keeps regular hyphens", () => {
    expect(replaceDashes("full-stack e-mail")).toBe("full-stack e-mail");
  });
});

describe("cleanTypography", () => {
  it("adds French non-breaking spaces", () => {
    expect(cleanTypography("Une idée à faire grandir ?", "fr")).toBe(
      `Une idée à faire grandir${NNBSP}?`,
    );
    expect(cleanTypography("Bonjour!", "fr")).toBe(`Bonjour${NNBSP}!`);
    expect(cleanTypography("Note : ceci", "fr")).toBe(`Note${NBSP}: ceci`);
    expect(cleanTypography("« Made with intention »", "fr")).toBe(
      `«${NBSP}Made with intention${NBSP}»`,
    );
  });

  it("leaves URLs and times untouched", () => {
    const text = "Voir https://example.com/a?b=1 à 14:00";
    expect(cleanTypography(text, "fr")).toBe(text);
  });

  it("does not apply French spacing to English", () => {
    expect(cleanTypography("Ready?", "en")).toBe("Ready?");
  });

  it("is idempotent", () => {
    const once = cleanTypography(`Prêt ? Oui ${EM} vraiment !`, "fr");
    expect(cleanTypography(once, "fr")).toBe(once);
  });

  it("cleans every locale of a localized text", () => {
    expect(cleanLocalizedText({ fr: `a ${EM} b ?`, en: `a ${EM} b?` })).toEqual({
      fr: `a, b${NNBSP}?`,
      en: "a, b?",
    });
  });
});
