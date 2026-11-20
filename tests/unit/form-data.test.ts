import { describe, expect, it } from "vitest";
import { issuesToErrors, parseFormData } from "@/lib/form-data";
import { whatsappLink, normalizePhone } from "@/lib/whatsapp";

function form(entries: [string, string][]) {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

describe("parseFormData", () => {
  it("builds nested objects and arrays", () => {
    const parsed = parseFormData(
      form([
        ["title.fr", "Titre"],
        ["title.en", "Title"],
        ["results[1].value", "92 %"],
        ["results[0].value", "40 %"],
        ["results[0].label.fr", "Temps"],
        ["categories[]", "web"],
        ["categories[]", "ai"],
        ["categories[]", ""],
      ]),
    );
    expect(parsed).toEqual({
      title: { fr: "Titre", en: "Title" },
      results: [{ value: "40 %", label: { fr: "Temps" } }, { value: "92 %" }],
      categories: ["web", "ai"],
    });
  });

  it("reads checkbox pairs as booleans", () => {
    const parsed = parseFormData(
      form([
        ["isFeatured", "0"],
        ["isFeatured", "1"],
        ["confidential", "0"],
      ]),
      { booleans: ["isFeatured", "confidential"] },
    );
    expect(parsed).toEqual({ isFeatured: true, confidential: false });
  });

  it("ignores prototype pollution attempts", () => {
    const parsed = parseFormData(form([["__proto__.polluted", "yes"], ["a.constructor.x", "1"]]));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(parsed).not.toHaveProperty("__proto__.polluted");
  });

  it("flattens validation issues", () => {
    expect(issuesToErrors([{ path: ["title", "fr"], message: "Obligatoire" }])).toEqual({ "title.fr": "Obligatoire" });
  });
});

describe("whatsapp links", () => {
  it("normalizes Congolese numbers to E.164", () => {
    expect(normalizePhone("0970 000 000")).toBe("243970000000");
    expect(normalizePhone("+243 97 000 0000")).toBe("243970000000");
    expect(normalizePhone("00243970000000")).toBe("243970000000");
    expect(normalizePhone("970000000")).toBe("243970000000");
    expect(normalizePhone("abc")).toBeNull();
  });

  it("builds a wa.me link with an encoded message", () => {
    expect(whatsappLink("+243970000000", "Bonjour & merci")).toBe(
      "https://wa.me/243970000000?text=Bonjour%20%26%20merci",
    );
  });
});
