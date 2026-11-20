import { describe, expect, it } from "vitest";
import { listProjectFiles, scanFiles, scanText } from "../../scripts/forbidden-chars";

describe("forbidden characters guard", () => {
  it("detects every forbidden character", () => {
    const sample = ["a \u{2014} b", "1\u{2013}2", "voir \u{A7} 3", "ok \u{1F680}"].join("\n");
    const rules = scanText(sample, "sample.txt").map((v) => v.rule);
    expect(rules).toHaveLength(4);
  });

  it("allows the middle dot, guillemets and the copyright sign", () => {
    expect(scanText("Web · Mobile « ok » © 2026", "ok.txt")).toEqual([]);
  });

  it("finds no em dash, en dash, section sign or emoji in the project", () => {
    const files = listProjectFiles();
    expect(files.length).toBeGreaterThan(0);
    const violations = scanFiles(files).map((v) => `${v.file}:${v.line} ${v.rule}`);
    expect(violations).toEqual([]);
  });
});
