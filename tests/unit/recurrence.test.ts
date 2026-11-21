import { describe, expect, it } from "vitest";
import { describeRule, formatRule, nextOccurrence, parseRule } from "@/lib/recurrence";

// 2026-11-23 is a Monday. 09:00 in Bukavu is 07:00 UTC.
const monday9 = new Date("2026-11-23T07:00:00Z");

describe("recurrence rules", () => {
  it("parses and formats the supported subset", () => {
    expect(parseRule("FREQ=WEEKLY;BYDAY=MO,WE")).toEqual({ freq: "WEEKLY", interval: 1, byDay: ["MO", "WE"] });
    expect(parseRule("FREQ=YEARLY")).toBeNull();
    expect(parseRule("")).toBeNull();
    expect(formatRule({ freq: "WEEKLY", interval: 2, byDay: ["FR"] })).toBe("FREQ=WEEKLY;INTERVAL=2;BYDAY=FR");
  });

  it("computes daily and weekly occurrences", () => {
    expect(nextOccurrence("FREQ=DAILY", monday9)?.toISOString()).toBe("2026-11-24T07:00:00.000Z");
    expect(nextOccurrence("FREQ=DAILY;INTERVAL=3", monday9)?.toISOString()).toBe("2026-11-26T07:00:00.000Z");
    expect(nextOccurrence("FREQ=WEEKLY", monday9)?.toISOString()).toBe("2026-11-30T07:00:00.000Z");
    expect(nextOccurrence("FREQ=WEEKLY;BYDAY=MO,WE", monday9)?.toISOString()).toBe("2026-11-25T07:00:00.000Z");
    const friday = new Date("2026-11-27T07:00:00Z");
    expect(nextOccurrence("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", friday)?.toISOString()).toBe("2026-11-30T07:00:00.000Z");
    expect(nextOccurrence("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO", monday9)?.toISOString()).toBe("2026-12-07T07:00:00.000Z");
  });

  it("uses the local day near midnight", () => {
    // Sunday 23:30 UTC is already Monday 01:30 in Bukavu.
    const late = new Date("2026-11-22T23:30:00Z");
    expect(nextOccurrence("FREQ=WEEKLY;BYDAY=MO,TU", late)?.toISOString()).toBe("2026-11-23T23:30:00.000Z");
  });

  it("clamps monthly occurrences to the end of shorter months", () => {
    expect(nextOccurrence("FREQ=MONTHLY", new Date("2027-01-31T07:00:00Z"))?.toISOString()).toBe("2027-02-28T07:00:00.000Z");
    expect(nextOccurrence("FREQ=MONTHLY;INTERVAL=2", monday9)?.toISOString()).toBe("2027-01-23T07:00:00.000Z");
  });

  it("describes rules in French", () => {
    expect(describeRule("FREQ=WEEKLY;BYDAY=MO")).toBe("chaque lundi");
    expect(describeRule("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR")).toBe("chaque jour ouvré");
    expect(describeRule("FREQ=DAILY;INTERVAL=2")).toBe("tous les 2 jours");
  });
});
