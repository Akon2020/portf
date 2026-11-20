import { describe, expect, it } from "vitest";
import { formatPeriod } from "@/lib/format";

describe("formatPeriod", () => {
  it("formats an ongoing period", () => {
    expect(formatPeriod(2023, null, "fr")).toBe("2023 à aujourd’hui");
    expect(formatPeriod("2023", undefined, "en")).toBe("2023 to present");
  });

  it("formats a closed period", () => {
    expect(formatPeriod(2021, 2025, "fr")).toBe("2021 à 2025");
    expect(formatPeriod("2022-09-01", "2024-06-30", "en")).toBe("2022 to 2024");
  });

  it("collapses a single year", () => {
    expect(formatPeriod(2024, 2024, "fr")).toBe("2024");
  });

  it("supports month granularity", () => {
    expect(formatPeriod("2024-03-01", "2024-11-01", "en", { granularity: "month" })).toBe(
      "Mar 2024 to Nov 2024",
    );
  });

  it("never outputs a dash", () => {
    const outputs = [formatPeriod(2020, null), formatPeriod(2020, 2022, "en")];
    for (const output of outputs) expect(output).not.toMatch(/[\u{2013}\u{2014}-]/u);
  });
});
