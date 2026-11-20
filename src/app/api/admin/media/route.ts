import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/ip";
import { AuthError, requireAdmin } from "@/server/auth/guards";
import { invalidate } from "@/server/content/mutations";
import { TAGS } from "@/server/content/queries";
import { isSameOrigin } from "@/server/http/origin";
import { writeAudit } from "@/server/services/audit";
import { MAX_UPLOAD_BYTES, MediaError, saveMedia } from "@/server/services/media";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });

  let actor;
  try {
    actor = await requireAdmin({ roles: ["super_admin", "editor"], redirectTo: false });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
    throw error;
  }

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "Fichier trop volumineux (10 Mo maximum)." }, { status: 413 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });

  try {
    const media = await saveMedia({
      buffer: Buffer.from(await file.arrayBuffer()),
      originalName: file.name,
      alt: { fr: String(form.get("alt.fr") ?? ""), en: String(form.get("alt.en") ?? "") },
      uploadedBy: actor.user.id,
    });
    await writeAudit({
      actorId: actor.user.id,
      action: "media.upload",
      entityType: "media",
      entityId: media.id,
      ip: getClientIp(request.headers),
    });
    invalidate(TAGS.media);
    const thumb = media.variants[0]?.path ?? media.path;
    return NextResponse.json({
      id: media.id,
      url: `/media/${media.path}`,
      thumb: `/media/${thumb}`,
      mime: media.mime,
      alt: media.alt,
      width: media.width,
      height: media.height,
      needsReplacement: media.needsReplacement,
    });
  } catch (error) {
    if (error instanceof MediaError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("[media] upload failed", error);
    return NextResponse.json({ error: "Échec de l'envoi." }, { status: 500 });
  }
}
