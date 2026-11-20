import { generateHTML, generateJSON } from "@tiptap/html/server";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { createHighlighter, type Highlighter } from "shiki";
import { CODE_LANGUAGES, richTextExtensions } from "@/lib/rich-text/extensions";
import { slugify } from "@/lib/slug";
import type { RichDoc, TocEntry } from "../db/schema/blog";

export interface RenderedDoc {
  html: string;
  toc: TocEntry[];
  readingMinutes: number;
  text: string;
}

const WORDS_PER_MINUTE = 200;

/** Allowlist applied to every rendered document: nothing else reaches the page. */
const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: ["p", "h2", "h3", "h4", "strong", "em", "u", "s", "a", "ul", "ol", "li", "blockquote", "code", "pre", "hr", "br", "img"],
  allowedAttributes: {
    a: ["href", "rel", "target"],
    img: ["src", "alt", "title", "width", "height"],
    code: ["class"],
    ol: ["start"],
  },
  allowedClasses: { code: [/^language-[a-z0-9+-]+$/] },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["https"] },
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      const external = /^https?:\/\//.test(attribs.href ?? "");
      return {
        tagName,
        attribs: { href: attribs.href ?? "#", ...(external ? { rel: "noopener noreferrer nofollow", target: "_blank" } : {}) },
      };
    },
  },
  exclusiveFilter: (frame) => frame.tag === "img" && !/^(\/media\/|https:\/\/)/.test(frame.attribs.src ?? ""),
};

let highlighter: Promise<Highlighter> | undefined;
function getHighlighter(): Promise<Highlighter> {
  highlighter ??= createHighlighter({ themes: ["github-light", "github-dark"], langs: [...CODE_LANGUAGES] });
  return highlighter;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");
}

export function htmlToText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Gives every heading a stable id and builds the table of contents. */
function addHeadingIds(html: string): { html: string; toc: TocEntry[] } {
  const toc: TocEntry[] = [];
  const used = new Map<string, number>();
  const output = html.replace(/<h([234])>([\s\S]*?)<\/h\1>/g, (_, level: string, inner: string) => {
    const text = htmlToText(inner);
    const base = slugify(text) || "section";
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;
    toc.push({ id, text, level: Number(level) });
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
  return { html: output, toc };
}

/** Replaces sanitized code blocks with Shiki output (light and dark themes). */
async function highlightCode(html: string): Promise<string> {
  const blocks = [...html.matchAll(/<pre><code(?: class="language-([a-z0-9+-]+)")?>([\s\S]*?)<\/code><\/pre>/g)];
  if (blocks.length === 0) return html;
  const shiki = await getHighlighter();
  const loaded = new Set(shiki.getLoadedLanguages());
  let output = html;
  for (const [match, lang, code] of blocks) {
    const language = lang && loaded.has(lang) ? lang : "text";
    const source = decodeEntities(code).replace(/\n$/, "");
    const highlighted = shiki.codeToHtml(source, {
      lang: language,
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: "light",
    });
    output = output.replace(match, `<div class="code-block" data-language="${language}">${highlighted}</div>`);
  }
  return output;
}

/** Full pipeline: Tiptap JSON to safe, highlighted HTML with table of contents. */
export async function renderRichDoc(doc: RichDoc | null | undefined): Promise<RenderedDoc> {
  if (!doc?.content?.length) return { html: "", toc: [], readingMinutes: 0, text: "" };
  const raw = generateHTML(doc as never, richTextExtensions);
  const clean = sanitizeHtml(raw, SANITIZE);
  const { html: withIds, toc } = addHeadingIds(clean);
  const html = (await highlightCode(withIds)).replace(/<img /g, '<img loading="lazy" decoding="async" ');
  const text = htmlToText(clean);
  const words = text ? text.split(" ").length : 0;
  return { html, toc, readingMinutes: words ? Math.max(1, Math.round(words / WORDS_PER_MINUTE)) : 0, text };
}

/** Markdown (content import) to a Tiptap document. */
export function markdownToDoc(markdown: string): RichDoc {
  const html = marked.parse(markdown, { async: false, gfm: true }) as string;
  return generateJSON(sanitizeHtml(html, SANITIZE), richTextExtensions) as RichDoc;
}
