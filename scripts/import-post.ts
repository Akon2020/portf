/**
 * Imports a Markdown file into a blog article.
 *
 *   pnpm import:post <file.md> --slug <slug> [--lang fr|en] [--title "Title"] [--excerpt "Summary"]
 *
 * The article must exist (created from the admin or by the seed). The Markdown
 * is converted to the editor format, sanitized and highlighted like any other
 * article, then left as a draft flagged for review.
 */
import { readFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";

loadEnvConfig(process.cwd());

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const file = args[0];
  const slug = option(args, "slug");
  const lang = (option(args, "lang") ?? "en") as "fr" | "en";
  if (!file || file.startsWith("--") || !slug || !["fr", "en"].includes(lang)) {
    console.error('Usage : pnpm import:post <fichier.md> --slug <slug> [--lang fr|en] [--title "Titre"] [--excerpt "Résumé"]');
    process.exitCode = 1;
    return;
  }

  const [{ getDb, closeDb }, { posts }, { markdownToDoc, renderRichDoc }, { cleanTypography, replaceDashes }] = await Promise.all([
    import("../src/server/db"),
    import("../src/server/db/schema"),
    import("../src/server/rich-text/render"),
    import("../src/lib/typography"),
  ]);
  try {
    const db = getDb();
    const [post] = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
    if (!post) throw new Error(`Aucun article avec le slug "${slug}".`);

    // Only dashes are replaced in the body: French spacing would alter code blocks.
    let markdown = replaceDashes(await readFile(file, "utf8"), lang);
    // A leading level 1 heading is the title, not part of the body.
    const heading = /^#\s+(.+)\n+/.exec(markdown);
    if (heading) markdown = markdown.slice(heading[0].length);
    const doc = markdownToDoc(markdown);
    const rendered = await renderRichDoc(doc);

    const title = option(args, "title") ?? heading?.[1]?.trim();
    const excerpt = option(args, "excerpt");
    await db
      .update(posts)
      .set({
        contentJson: { ...post.contentJson, [lang]: doc },
        contentHtml: { ...post.contentHtml, [lang]: rendered.html },
        toc: { ...post.toc, [lang]: rendered.toc },
        readingMinutes: { ...post.readingMinutes, [lang]: rendered.readingMinutes },
        ...(title ? { title: { ...post.title, [lang]: cleanTypography(title, lang) } } : {}),
        ...(excerpt ? { excerpt: { ...post.excerpt, [lang]: cleanTypography(excerpt, lang) } } : {}),
        needsReview: true,
        reviewNote: `Contenu ${lang.toUpperCase()} importé depuis ${file.split(/[\\/]/).pop()} : relire le rendu avant publication.`,
      })
      .where(eq(posts.id, post.id));
    console.log(`Article "${slug}" mis à jour (${lang}) : ${rendered.readingMinutes} min de lecture, ${rendered.toc.length} intertitres.`);
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
