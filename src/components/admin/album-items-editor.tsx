"use client";

/* eslint-disable @next/next/no-img-element */
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { uploadFile, type LibraryItem } from "./media-picker";

export interface AlbumItemValue {
  mediaId: string;
  caption: { fr: string; en?: string };
}

const inputClass = "h-9 w-full rounded-lg border bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

/**
 * Album photos: multiple upload by drag and drop, picking from the library,
 * ordering and bilingual captions. Submitted as items[i].mediaId and items[i].caption.fr/en.
 */
export function AlbumItemsEditor({ library: initialLibrary, defaultValue }: { library: LibraryItem[]; defaultValue: AlbumItemValue[] }) {
  const [library, setLibrary] = useState(initialLibrary);
  const [items, setItems] = useState(defaultValue);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const byId = new Map(library.map((item) => [item.id, item]));
  const images = library.filter((item) => item.mime.startsWith("image/"));

  async function upload(files: File[]) {
    const accepted = files.filter((file) => file.type.startsWith("image/"));
    if (!accepted.length) return;
    setErrors([]);
    setProgress({ done: 0, total: accepted.length });
    const failures: string[] = [];
    for (const file of accepted) {
      try {
        const uploaded = await uploadFile(file);
        setLibrary((current) => [uploaded, ...current]);
        setItems((current) => [...current, { mediaId: uploaded.id, caption: { fr: "", en: "" } }]);
      } catch (error) {
        failures.push(`${file.name} : ${error instanceof Error ? error.message : "échec"}`);
      }
      setProgress((current) => (current ? { ...current, done: current.done + 1 } : null));
    }
    setProgress(null);
    setErrors(failures);
  }

  const move = (index: number, step: number) =>
    setItems((current) => {
      const next = [...current];
      const target = index + step;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const setCaption = (index: number, locale: "fr" | "en", value: string) =>
    setItems((current) => current.map((item, position) => (position === index ? { ...item, caption: { ...item.caption, [locale]: value } } : item)));

  const toggleFromLibrary = (id: string) =>
    setItems((current) => (current.some((item) => item.mediaId === id) ? current.filter((item) => item.mediaId !== id) : [...current, { mediaId: id, caption: { fr: "", en: "" } }]));

  return (
    <div className="space-y-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void upload([...event.dataTransfer.files]);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors",
          dragging ? "border-accent bg-accent/5" : "border-line",
        )}
      >
        {progress ? (
          <p className="flex items-center gap-2 text-sm" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Envoi {progress.done + 1 > progress.total ? progress.total : progress.done + 1} sur {progress.total}
          </p>
        ) : (
          <>
            <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Glissez des photos ici (JPEG, PNG, WebP, 10 Mo max chacune)</p>
          </>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => fileInput.current?.click()} disabled={!!progress} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-medium text-accent-foreground disabled:opacity-60">
            <Upload className="size-3.5" aria-hidden="true" /> Choisir des fichiers
          </button>
          <button type="button" onClick={() => dialog.current?.showModal()} className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-card px-3 text-xs font-medium hover:bg-surface">
            <ImagePlus className="size-3.5" aria-hidden="true" /> Depuis la médiathèque
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            void upload([...(event.target.files ?? [])]);
            event.target.value = "";
          }}
        />
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 text-sm text-destructive">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune photo dans cet album.</p>
      ) : (
        <ol className="space-y-3">
          {items.map((item, index) => {
            const file = byId.get(item.mediaId);
            return (
              <li key={item.mediaId} className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-start">
                <input type="hidden" name={`items[${index}].mediaId`} value={item.mediaId} />
                <div className="flex items-start gap-3">
                  <span className="label-mono w-6 pt-1 text-center text-muted-foreground">{index + 1}</span>
                  {file ? (
                    <img src={file.thumb} alt={file.alt.fr || ""} className="size-20 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="size-20 shrink-0 rounded-lg bg-surface" />
                  )}
                </div>
                <div className="grid flex-1 gap-2 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-medium">
                    Légende (FR)
                    <input name={`items[${index}].caption.fr`} value={item.caption.fr} onChange={(event) => setCaption(index, "fr", event.target.value)} maxLength={300} className={inputClass} />
                  </label>
                  <label className="space-y-1 text-xs font-medium">
                    Légende (EN, facultatif)
                    <input name={`items[${index}].caption.en`} value={item.caption.en ?? ""} onChange={(event) => setCaption(index, "en", event.target.value)} maxLength={300} className={inputClass} />
                  </label>
                  {file && !file.alt.fr && <p className="text-xs text-warning sm:col-span-2">Texte alternatif manquant : complétez-le dans la médiathèque.</p>}
                </div>
                <div className="flex gap-1 sm:flex-col">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Monter la photo ${index + 1}`} className="grid size-8 place-items-center rounded-lg border hover:bg-surface disabled:opacity-40">
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label={`Descendre la photo ${index + 1}`} className="grid size-8 place-items-center rounded-lg border hover:bg-surface disabled:opacity-40">
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => setItems((current) => current.filter((_, position) => position !== index))} aria-label={`Retirer la photo ${index + 1}`} className="grid size-8 place-items-center rounded-lg border text-destructive hover:bg-destructive/5">
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <dialog ref={dialog} aria-label="Médiathèque" className="m-auto max-h-[85vh] w-[min(900px,94vw)] rounded-2xl border bg-card p-0 text-foreground backdrop:bg-black/60">
        <div className="sticky top-0 flex items-center justify-between border-b bg-card px-5 py-3">
          <p className="font-medium">Ajouter depuis la médiathèque</p>
          <button type="button" onClick={() => dialog.current?.close()} className="h-9 rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground">
            Terminé
          </button>
        </div>
        <ul className="grid grid-cols-3 gap-2 p-4 sm:grid-cols-5">
          {images.map((image) => {
            const active = items.some((item) => item.mediaId === image.id);
            return (
              <li key={image.id}>
                <button
                  type="button"
                  onClick={() => toggleFromLibrary(image.id)}
                  aria-pressed={active}
                  className={cn("block w-full overflow-hidden rounded-lg border-2", active ? "border-accent" : "border-transparent")}
                >
                  <img src={image.thumb} alt={image.alt.fr || "Image sans texte alternatif"} className="aspect-square w-full object-cover" loading="lazy" />
                </button>
              </li>
            );
          })}
        </ul>
      </dialog>
    </div>
  );
}
