"use client";

/* eslint-disable @next/next/no-img-element */
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

export interface GalleryItem {
  id: string;
  src: string;
  srcSet: string;
  width: number | null;
  height: number | null;
  alt: string;
  caption: string;
  blur: string | null;
}

export function ProjectGallery({ items }: { items: GalleryItem[] }) {
  const t = useTranslations("project");
  const [index, setIndex] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const close = useCallback(() => setIndex(null), []);
  const move = useCallback(
    (step: number) => setIndex((current) => (current === null ? null : (current + step + items.length) % items.length)),
    [items.length],
  );

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (index !== null && !node.open) node.showModal();
    if (index === null && node.open) node.close();
  }, [index]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") move(1);
      if (event.key === "ArrowLeft") move(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, move]);

  const current = index === null ? null : items[index];

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map((item, position) => (
          <li key={item.id} className={position === 0 && items.length % 2 === 1 ? "sm:col-span-2" : undefined}>
            <figure>
              <button
                type="button"
                onClick={() => setIndex(position)}
                className="block w-full overflow-hidden rounded-xl border bg-surface"
                aria-label={`${item.alt}, ${t("imageOf", { current: position + 1, total: items.length })}`}
              >
                <img
                  src={item.src}
                  srcSet={item.srcSet || undefined}
                  sizes="(min-width: 768px) 50vw, 100vw"
                  width={item.width ?? undefined}
                  height={item.height ?? undefined}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="aspect-[16/10] w-full bg-cover bg-center object-cover transition-transform duration-500 hover:scale-[1.02]"
                  style={item.blur ? { backgroundImage: `url(${item.blur})` } : undefined}
                />
              </button>
              {item.caption && <figcaption className="mt-2 text-sm text-muted-foreground">{item.caption}</figcaption>}
            </figure>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        onClose={close}
        onClick={(event) => event.target === dialog.current && close()}
        className="m-auto max-h-[92vh] w-[min(1200px,94vw)] bg-transparent p-0 backdrop:bg-black/85"
        aria-label={current?.alt}
      >
        {current && (
          <div className="relative">
            <img
              src={current.src}
              srcSet={current.srcSet || undefined}
              sizes="94vw"
              alt={current.alt}
              className="max-h-[82vh] w-full rounded-lg object-contain"
            />
            <div className="mt-3 flex items-center justify-between gap-4 text-sm text-white">
              <p>
                {current.caption}{" "}
                <span className="label-mono text-white/70">{t("imageOf", { current: index! + 1, total: items.length })}</span>
              </p>
              <div className="flex gap-2">
                {items.length > 1 && (
                  <>
                    <button type="button" onClick={() => move(-1)} className="grid size-10 place-items-center rounded-full bg-white/15 hover:bg-white/25" aria-label={t("previousImage")}>
                      <ChevronLeft className="size-5" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => move(1)} className="grid size-10 place-items-center rounded-full bg-white/15 hover:bg-white/25" aria-label={t("nextImage")}>
                      <ChevronRight className="size-5" aria-hidden="true" />
                    </button>
                  </>
                )}
                <button type="button" onClick={close} className="grid size-10 place-items-center rounded-full bg-white/15 hover:bg-white/25" aria-label={t("closeLightbox")} autoFocus>
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
