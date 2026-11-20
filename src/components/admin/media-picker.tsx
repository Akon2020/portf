"use client";

/* eslint-disable @next/next/no-img-element */
import { AlertTriangle, ArrowDown, ArrowUp, FileText, ImagePlus, Loader2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface LibraryItem {
  id: string;
  url: string;
  thumb: string;
  mime: string;
  alt: { fr: string; en?: string };
  needsReplacement: boolean;
}

export async function uploadFile(file: File): Promise<LibraryItem> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/admin/media", { method: "POST", body });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error ?? "Échec de l'envoi.");
  return json as LibraryItem;
}

function Thumb({ item, className }: { item: LibraryItem; className?: string }) {
  if (!item.mime.startsWith("image/")) {
    return (
      <span className={cn("grid place-items-center bg-surface text-muted-foreground", className)}>
        <FileText className="size-6" aria-hidden="true" />
      </span>
    );
  }
  return <img src={item.thumb} alt={item.alt.fr || "Image sans texte alternatif"} className={cn("object-cover", className)} loading="lazy" />;
}

/**
 * Picks one or several files from the media library, with upload.
 * Selected ids are submitted as hidden inputs named `name` (single) or `name[]` (multiple).
 */
export function MediaPicker({
  name,
  label,
  library: initialLibrary,
  defaultValue,
  multiple = false,
  accept = "image/*",
  hint,
}: {
  name: string;
  label: string;
  library: LibraryItem[];
  defaultValue?: string[];
  multiple?: boolean;
  accept?: string;
  hint?: string;
}) {
  const [library, setLibrary] = useState(initialLibrary);
  const [selected, setSelected] = useState<string[]>(defaultValue?.filter(Boolean) ?? []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const byId = new Map(library.map((item) => [item.id, item]));
  const choices = library.filter((item) => (accept === "application/pdf" ? item.mime === "application/pdf" : item.mime.startsWith("image/")));

  const toggle = (id: string) => {
    setSelected((current) => {
      if (!multiple) return current[0] === id ? [] : [id];
      return current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
    });
    if (!multiple) dialog.current?.close();
  };

  const move = (index: number, step: number) =>
    setSelected((current) => {
      const next = [...current];
      const target = index + step;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const item = await uploadFile(file);
        setLibrary((current) => (current.some((entry) => entry.id === item.id) ? current : [item, ...current]));
        setSelected((current) => (multiple ? [...current.filter((id) => id !== item.id), item.id] : [item.id]));
      }
      if (!multiple) dialog.current?.close();
    } catch (uploadError) {
      setError((uploadError as Error).message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {multiple ? <input type="hidden" name={`${name}[]`} value="" /> : <input type="hidden" name={name} value={selected[0] ?? ""} />}
      {multiple && selected.map((id) => <input key={id} type="hidden" name={`${name}[]`} value={id} />)}

      <div className="flex flex-wrap gap-3">
        {selected.map((id, index) => {
          const item = byId.get(id);
          if (!item) return null;
          return (
            <div key={id} className="group relative w-32 overflow-hidden rounded-lg border bg-card">
              <Thumb item={item} className="h-24 w-full" />
              {item.needsReplacement && (
                <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded bg-warning px-1.5 py-0.5 text-[10px] font-medium text-white">
                  <AlertTriangle className="size-3" aria-hidden="true" />À remplacer
                </span>
              )}
              <div className="flex items-center justify-end gap-1 p-1">
                {multiple && (
                  <>
                    <button type="button" onClick={() => move(index, -1)} className="rounded p-1 hover:bg-surface" aria-label="Monter">
                      <ArrowUp className="size-3.5" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => move(index, 1)} className="rounded p-1 hover:bg-surface" aria-label="Descendre">
                      <ArrowDown className="size-3.5" aria-hidden="true" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setSelected((current) => current.filter((value) => value !== id))}
                  className="rounded p-1 text-muted-foreground hover:bg-surface hover:text-destructive"
                  aria-label="Retirer"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => dialog.current?.showModal()}
          className="grid h-[7.5rem] w-32 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground hover:bg-surface"
        >
          <span className="flex flex-col items-center gap-1">
            <ImagePlus className="size-5" aria-hidden="true" />
            {multiple || selected.length === 0 ? "Choisir" : "Changer"}
          </span>
        </button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      <dialog ref={dialog} className="m-auto w-[min(900px,94vw)] rounded-xl border bg-background p-0 text-foreground backdrop:bg-black/60">
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <p className="font-medium">Médiathèque</p>
          <div className="flex items-center gap-2">
            <input ref={fileInput} type="file" accept={accept} multiple={multiple} className="sr-only" id={`${name}-upload`} onChange={(event) => onFiles(event.target.files)} />
            <label htmlFor={`${name}-upload`} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground">
              {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
              Envoyer
            </label>
            <button type="button" onClick={() => dialog.current?.close()} className="rounded-lg border p-1.5" aria-label="Fermer">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        {error && <p className="px-4 pt-3 text-sm text-destructive" role="alert">{error}</p>}
        <ul className="grid max-h-[65vh] grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-4">
          {choices.length === 0 && <li className="col-span-full text-sm text-muted-foreground">Aucun fichier. Utilisez « Envoyer ».</li>}
          {choices.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => toggle(item.id)}
                aria-pressed={selected.includes(item.id)}
                className={cn(
                  "block w-full overflow-hidden rounded-lg border-2 text-left",
                  selected.includes(item.id) ? "border-accent" : "border-transparent",
                )}
              >
                <Thumb item={item} className="aspect-[4/3] w-full" />
                <span className="block truncate px-1 py-1 text-xs text-muted-foreground">{item.alt.fr || "Sans texte alternatif"}</span>
              </button>
            </li>
          ))}
        </ul>
      </dialog>
    </div>
  );
}
