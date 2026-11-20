import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slug";
import { markdownToDoc, renderRichDoc } from "@/server/rich-text/render";

describe("slugify", () => {
  it("builds clean slugs", () => {
    expect(slugify("Sécuriser une API : bonnes pratiques")).toBe("securiser-une-api-bonnes-pratiques");
    expect(slugify("  --Next.js App Router--  ")).toBe("next-js-app-router");
  });
});

describe("rich text pipeline", () => {
  it("renders headings with ids, a table of contents and reading time", async () => {
    const doc = markdownToDoc("## Authentification\n\nTexte **important**.\n\n### JWT\n\nSuite.\n\n## Authentification\n\nEncore.");
    const result = await renderRichDoc(doc);
    expect(result.toc).toEqual([
      { id: "authentification", text: "Authentification", level: 2 },
      { id: "jwt", text: "JWT", level: 3 },
      { id: "authentification-2", text: "Authentification", level: 2 },
    ]);
    expect(result.html).toContain('<h2 id="authentification">');
    expect(result.html).toContain("<strong>important</strong>");
    expect(result.readingMinutes).toBe(1);
  });

  it("highlights code blocks with both themes", async () => {
    const result = await renderRichDoc(markdownToDoc("```ts\nconst answer: number = 42;\n```"));
    expect(result.html).toContain('class="code-block" data-language="ts"');
    expect(result.html).not.toContain('<span class="line"></span></code>');
    expect(result.html).toContain("--shiki-dark");
    expect(result.html).not.toContain("<script");
  });

  it("removes scripts, event handlers and unsafe links or images", async () => {
    const doc = markdownToDoc(
      [
        "<script>alert(1)</script>",
        '<img src="x" onerror="alert(1)">',
        "[clic](javascript:alert(1))",
        "![ok](https://example.test/image.png)",
        "[site](https://example.test)",
      ].join("\n\n"),
    );
    const { html } = await renderRichDoc(doc);
    expect(html).not.toMatch(/<script|onerror|javascript:/i);
    expect(html).toContain('src="https://example.test/image.png"');
    expect(html).toContain('href="https://example.test" rel="noopener noreferrer nofollow" target="_blank"');
  });

  it("returns an empty result for an empty document", async () => {
    expect(await renderRichDoc({ type: "doc", content: [] })).toEqual({ html: "", toc: [], readingMinutes: 0, text: "" });
  });
});
