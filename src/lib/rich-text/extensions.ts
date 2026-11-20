import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";

/** Same extensions in the editor and on the server, so documents round trip. */
export const richTextExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] },
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
      protocols: ["http", "https", "mailto"],
      HTMLAttributes: { rel: "noopener noreferrer nofollow", target: null },
    },
  }),
  Image.configure({ inline: false, allowBase64: false }),
];

/** Languages offered for code blocks, highlighted by Shiki at save time. */
export const CODE_LANGUAGES = [
  "typescript",
  "tsx",
  "javascript",
  "jsx",
  "json",
  "bash",
  "python",
  "sql",
  "html",
  "css",
  "yaml",
  "markdown",
  "php",
  "java",
  "go",
  "rust",
  "dart",
  "kotlin",
  "swift",
  "diff",
] as const;
