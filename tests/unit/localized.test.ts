import { describe, expect, it } from "vitest";
import { pickLocalized, tr } from "@/lib/localized";

describe("tr", () => {
  it("falls back to French when English is empty", () => {
    expect(tr({ fr: "Bonjour", en: "  " }, "en")).toBe("Bonjour");
    expect(tr({ fr: "Bonjour", en: "Hello" }, "en")).toBe("Hello");
  });
});

describe("pickLocalized", () => {
  it("returns the requested language when it is filled", () => {
    expect(pickLocalized({ fr: "Bonjour", en: "Hello" }, "en")).toEqual({ text: "Hello", lang: "en" });
    expect(pickLocalized({ fr: "Bonjour", en: "Hello" }, "fr")).toEqual({ text: "Bonjour", lang: "fr" });
  });

  it("falls back to the other language and reports it", () => {
    expect(pickLocalized({ fr: "", en: "Hello" }, "fr")).toEqual({ text: "Hello", lang: "en" });
    expect(pickLocalized({ fr: "Bonjour" }, "en")).toEqual({ text: "Bonjour", lang: "fr" });
  });

  it("handles missing values", () => {
    expect(pickLocalized(null, "fr")).toEqual({ text: "", lang: "en" });
  });
});
