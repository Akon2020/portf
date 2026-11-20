import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { missingEnglish, paragraphs, tr } from "@/lib/localized";
import { projectSchema, serviceSchema, stringList } from "@/server/content/schemas";
import { detectFileType } from "@/server/services/media";
import { safeResolve } from "@/server/storage/driver";

const EM = String.fromCharCode(0x2014);

describe("localized text", () => {
  it("falls back to French when English is empty", () => {
    expect(tr({ fr: "Bonjour", en: "" }, "en")).toBe("Bonjour");
    expect(tr({ fr: "Bonjour", en: "Hello" }, "en")).toBe("Hello");
    expect(tr({ fr: "Bonjour", en: "Hello" }, "fr")).toBe("Bonjour");
    expect(tr(null, "fr")).toBe("");
    expect(missingEnglish({ fr: "a", en: " " })).toBe(true);
  });

  it("splits paragraphs on blank lines", () => {
    expect(paragraphs("Un.\n\nDeux.\n  \nTrois.")).toEqual(["Un.", "Deux.", "Trois."]);
  });
});

describe("content schemas", () => {
  const base = {
    slug: "diasmart",
    title: { fr: `DiaSmart ${EM} santé`, en: "" },
    stage: "completed",
    projectType: "academic",
    status: "draft",
    coverImageId: "",
    demoUrl: "",
    repoUrl: "https://github.com/Akon2020/x",
    startedAt: "",
    endedAt: "2025-06-30",
    clientName: "",
    reviewNote: "",
  };

  it("cleans typography and normalizes empty values", () => {
    const parsed = projectSchema.parse(base);
    expect(parsed.title.fr).toBe("DiaSmart, santé");
    expect(parsed.coverImageId).toBeNull();
    expect(parsed.demoUrl).toBeNull();
    expect(parsed.endedAt).toBe("2025-06-30");
  });

  it("rejects invalid slugs and urls", () => {
    expect(projectSchema.safeParse({ ...base, slug: "Dia Smart" }).success).toBe(false);
    expect(projectSchema.safeParse({ ...base, demoUrl: "javascript:alert(1)" }).success).toBe(false);
  });

  it("requires the French title", () => {
    expect(projectSchema.safeParse({ ...base, title: { fr: "", en: "Title" } }).success).toBe(false);
  });

  it("stores prices in cents", () => {
    const parsed = serviceSchema.parse({ slug: "web", title: { fr: "Web" }, currency: "USD", startingPrice: "450,50", icon: "" });
    expect(parsed.startingPrice).toBe(45050);
  });

  it("splits lists", () => {
    expect(stringList.parse("Next.js, PostgreSQL\nDrizzle")).toEqual(["Next.js", "PostgreSQL", "Drizzle"]);
  });
});

describe("media safety", () => {
  it("detects the real file type from magic bytes", () => {
    expect(detectFileType(Buffer.from("ffd8ffe000104a464946", "hex"))?.mime).toBe("image/jpeg");
    expect(detectFileType(Buffer.from("89504e470d0a1a0a0000", "hex"))?.mime).toBe("image/png");
    expect(detectFileType(Buffer.from("%PDF-1.7"))?.mime).toBe("application/pdf");
    expect(detectFileType(Buffer.from("<svg xmlns=")) ).toBeNull();
    expect(detectFileType(Buffer.from("<?php echo 1;"))).toBeNull();
  });

  it("refuses paths escaping the uploads root", () => {
    const root = resolve("/tmp/uploads");
    expect(safeResolve(root, "2026/11/abc.webp")).toBe(resolve(root, "2026/11/abc.webp"));
    expect(safeResolve(root, "../secret")).toBeNull();
    expect(safeResolve(root, "2026/../../etc/passwd")).toBeNull();
    expect(safeResolve(root, "/etc/passwd")).toBeNull();
    expect(safeResolve(root, "a//b")).toBeNull();
  });
});
