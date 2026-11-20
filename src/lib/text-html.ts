/** Escapes text for safe insertion into HTML. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Plain text to HTML paragraphs: blank lines split paragraphs, single line
 * breaks become <br>, http(s) URLs become links. Nothing else is interpreted.
 */
export function textToHtml(text: string): string {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => {
      const escaped = escapeHtml(paragraph.trim()).replace(/\n/g, "<br>");
      const linked = escaped.replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (url) => `<a href="${url}">${url}</a>`);
      return `<p style="margin:0 0 14px">${linked}</p>`;
    })
    .join("");
}
