/* eslint-disable @next/next/no-img-element */
// Images are resized at upload time (WebP variants), so a plain img with a
// srcset is enough and avoids the runtime image optimizer on shared hosting.
import { tr } from "@/lib/localized";
import { cn } from "@/lib/utils";
import type { PublicMedia } from "@/server/content/queries";

export function MediaImage({
  media,
  locale,
  sizes = "100vw",
  priority = false,
  className,
  alt,
}: {
  media: PublicMedia;
  locale: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  alt?: string;
}) {
  const fallback = media.srcSet.at(-1)?.url ?? media.url;
  const srcSet = media.srcSet.map((variant) => `${variant.url} ${variant.width}w`).join(", ");
  return (
    <img
      src={fallback}
      srcSet={srcSet || undefined}
      sizes={srcSet ? sizes : undefined}
      width={media.width ?? undefined}
      height={media.height ?? undefined}
      alt={alt ?? tr(media.alt, locale)}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={cn("bg-surface bg-cover bg-center", className)}
      style={media.blurDataUrl ? { backgroundImage: `url(${media.blurDataUrl})` } : undefined}
    />
  );
}
