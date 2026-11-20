"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from "@tiptap/react";
import {
  Bold,
  Code,
  Code2,
  Heading2,
  Heading3,
  Heading4,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  Upload,
  X,
} from "lucide-react";
/* eslint-disable @next/next/no-img-element */
import { useId, useState } from "react";
import { CODE_LANGUAGES, richTextExtensions } from "@/lib/rich-text/extensions";
import { cn } from "@/lib/utils";
import type { RichDoc } from "@/server/db/schema/blog";
import { uploadFile, type LibraryItem } from "./media-picker";

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-foreground disabled:opacity-40",
        active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ImageDialog({
  library,
  onPick,
  onClose,
}: {
  library: LibraryItem[];
  onPick: (item: LibraryItem) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState(library.filter((item) => item.mime.startsWith("image/")));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div role="dialog" aria-modal="true" aria-label="Insérer une image" className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-[min(860px,96vw)] rounded-xl border bg-background">
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <p className="font-medium">Insérer une image</p>
          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground">
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
              Envoyer
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setBusy(true);
                  setError(null);
                  try {
                    const item = await uploadFile(file);
                    setItems((current) => [item, ...current.filter((entry) => entry.id !== item.id)]);
                  } catch (uploadError) {
                    setError((uploadError as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </label>
            <button type="button" onClick={onClose} className="rounded-lg border p-1.5" aria-label="Fermer">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        {error && <p className="px-4 pt-3 text-sm text-destructive">{error}</p>}
        <p className="px-4 pt-3 text-xs text-muted-foreground">Pensez à renseigner le texte alternatif de l&apos;image dans la médiathèque.</p>
        <ul className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-4">
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => onPick(item)} className="block w-full overflow-hidden rounded-lg border-2 border-transparent hover:border-accent">
                <img src={item.thumb} alt={item.alt.fr || "Image sans texte alternatif"} className="aspect-[4/3] w-full object-cover" />
                <span className="block truncate px-1 py-1 text-left text-xs text-muted-foreground">{item.alt.fr || "Sans texte alternatif"}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Toolbar({ editor, onImage }: { editor: Editor; onImage: () => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      paragraph: current.isActive("paragraph"),
      h2: current.isActive("heading", { level: 2 }),
      h3: current.isActive("heading", { level: 3 }),
      h4: current.isActive("heading", { level: 4 }),
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      underline: current.isActive("underline"),
      strike: current.isActive("strike"),
      code: current.isActive("code"),
      link: current.isActive("link"),
      bullet: current.isActive("bulletList"),
      ordered: current.isActive("orderedList"),
      quote: current.isActive("blockquote"),
      codeBlock: current.isActive("codeBlock"),
      language: (current.getAttributes("codeBlock").language as string | undefined) ?? "",
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  return (
    <div role="toolbar" aria-label="Mise en forme" className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b bg-card/95 p-1.5 backdrop-blur">
      <ToolButton label="Paragraphe" active={state.paragraph} onClick={() => chain().setParagraph().run()}>
        <Pilcrow className="size-4" />
      </ToolButton>
      <ToolButton label="Titre de section" active={state.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="size-4" />
      </ToolButton>
      <ToolButton label="Sous-titre" active={state.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="size-4" />
      </ToolButton>
      <ToolButton label="Petit titre" active={state.h4} onClick={() => chain().toggleHeading({ level: 4 }).run()}>
        <Heading4 className="size-4" />
      </ToolButton>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
      <ToolButton label="Gras (Ctrl+B)" active={state.bold} onClick={() => chain().toggleBold().run()}>
        <Bold className="size-4" />
      </ToolButton>
      <ToolButton label="Italique (Ctrl+I)" active={state.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic className="size-4" />
      </ToolButton>
      <ToolButton label="Souligné (Ctrl+U)" active={state.underline} onClick={() => chain().toggleUnderline().run()}>
        <Underline className="size-4" />
      </ToolButton>
      <ToolButton label="Barré" active={state.strike} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough className="size-4" />
      </ToolButton>
      <ToolButton label="Code en ligne" active={state.code} onClick={() => chain().toggleCode().run()}>
        <Code className="size-4" />
      </ToolButton>
      <ToolButton
        label={state.link ? "Retirer le lien" : "Ajouter un lien"}
        active={state.link}
        onClick={() => {
          if (state.link) {
            chain().unsetLink().run();
            return;
          }
          const url = window.prompt("Adresse du lien (https://...)");
          if (url && /^(https?:\/\/|mailto:|\/)/.test(url.trim())) chain().extendMarkRange("link").setLink({ href: url.trim() }).run();
        }}
      >
        <Link2 className="size-4" />
      </ToolButton>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
      <ToolButton label="Liste à puces" active={state.bullet} onClick={() => chain().toggleBulletList().run()}>
        <List className="size-4" />
      </ToolButton>
      <ToolButton label="Liste numérotée" active={state.ordered} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered className="size-4" />
      </ToolButton>
      <ToolButton label="Citation" active={state.quote} onClick={() => chain().toggleBlockquote().run()}>
        <Quote className="size-4" />
      </ToolButton>
      <ToolButton label="Bloc de code" active={state.codeBlock} onClick={() => chain().toggleCodeBlock().run()}>
        <Code2 className="size-4" />
      </ToolButton>
      {state.codeBlock && (
        <select
          aria-label="Langage du bloc de code"
          value={state.language}
          onChange={(event) => chain().updateAttributes("codeBlock", { language: event.target.value || null }).run()}
          className="h-8 rounded-md border bg-background px-2 text-xs"
        >
          <option value="">Texte brut</option>
          {CODE_LANGUAGES.map((language) => (
            <option key={language} value={language}>
              {language}
            </option>
          ))}
        </select>
      )}
      <ToolButton label="Séparateur" onClick={() => chain().setHorizontalRule().run()}>
        <Minus className="size-4" />
      </ToolButton>
      <ToolButton label="Image" onClick={onImage}>
        <ImagePlus className="size-4" />
      </ToolButton>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
      <ToolButton label="Annuler (Ctrl+Z)" disabled={!state.canUndo} onClick={() => chain().undo().run()}>
        <Undo2 className="size-4" />
      </ToolButton>
      <ToolButton label="Rétablir" disabled={!state.canRedo} onClick={() => chain().redo().run()}>
        <Redo2 className="size-4" />
      </ToolButton>
    </div>
  );
}

/** Tiptap editor writing its JSON document into a hidden input named `name`. */
export function RichTextEditor({
  name,
  label,
  initial,
  library,
  placeholder = "Commencez à écrire...",
  lang,
}: {
  name: string;
  label: string;
  initial?: RichDoc | null;
  library: LibraryItem[];
  placeholder?: string;
  lang: "fr" | "en";
}) {
  const [json, setJson] = useState(() => (initial ? JSON.stringify(initial) : ""));
  const [picking, setPicking] = useState(false);
  const labelId = useId();
  const editor = useEditor({
    extensions: [...richTextExtensions, Placeholder.configure({ placeholder })],
    content: (initial as JSONContent | null | undefined) ?? "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "rich-content min-h-[420px] px-5 py-4 outline-none",
        "aria-labelledby": labelId,
        "aria-multiline": "true",
        role: "textbox",
        lang,
      },
    },
    onUpdate: ({ editor: current }) => setJson(current.isEmpty ? "" : JSON.stringify(current.getJSON())),
  });

  return (
    <div className="space-y-1.5">
      <p id={labelId} className="text-sm font-medium">
        {label}
      </p>
      <input type="hidden" name={name} value={json} />
      <div className="overflow-hidden rounded-xl border bg-card focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
        {editor ? <Toolbar editor={editor} onImage={() => setPicking(true)} /> : <div className="h-11 border-b" />}
        <EditorContent editor={editor} />
      </div>
      {picking && editor && (
        <ImageDialog
          library={library}
          onClose={() => setPicking(false)}
          onPick={(item) => {
            editor.chain().focus().setImage({ src: item.large ?? item.url, alt: item.alt.fr || "" }).run();
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}
