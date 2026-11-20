"use server";

import { redirect } from "next/navigation";
import { issuesToErrors, parseFormData } from "@/lib/form-data";
import { requireAdmin } from "../auth/guards";
import { albumInputSchema, deleteAlbum, deletePost, postInputSchema, saveAlbum, savePost } from "../content/blog";
import { ContentError } from "../content/mutations";
import { getRequestContext } from "../request-context";
import type { FormState } from "./content";

async function actor() {
  const { user } = await requireAdmin({ roles: ["super_admin", "editor"] });
  return { id: user.id, ...(await getRequestContext()) };
}

function failure(error: unknown): FormState {
  if (error instanceof ContentError) {
    return { ok: false, message: error.message, errors: error.field ? { [error.field]: error.message } : undefined };
  }
  throw error;
}

export async function savePostAction(id: string | null, _state: FormState, formData: FormData): Promise<FormState> {
  const user = await actor();
  const parsed = postInputSchema.safeParse(parseFormData(formData, { booleans: ["needsReview"] }));
  if (!parsed.success) return { ok: false, message: "L'article contient des erreurs.", errors: issuesToErrors(parsed.error.issues) };
  let postId: string;
  try {
    postId = await savePost(id, parsed.data, user);
  } catch (error) {
    return failure(error);
  }
  if (!id) redirect(`/admin/blog/${postId}?enregistre=1`);
  const label = { draft: "Brouillon enregistré.", scheduled: "Article programmé.", published: "Article publié." }[parsed.data.status];
  return { ok: true, message: label };
}

export async function deletePostAction(id: string): Promise<void> {
  await deletePost(id, await actor());
  redirect("/admin/blog");
}

export async function saveAlbumAction(id: string | null, _state: FormState, formData: FormData): Promise<FormState> {
  const user = await actor();
  const parsed = albumInputSchema.safeParse(parseFormData(formData));
  if (!parsed.success) return { ok: false, message: "L'album contient des erreurs.", errors: issuesToErrors(parsed.error.issues) };
  let albumId: string;
  try {
    albumId = await saveAlbum(id, parsed.data, user);
  } catch (error) {
    return failure(error);
  }
  if (!id) redirect(`/admin/galerie/${albumId}?enregistre=1`);
  return { ok: true, message: "Album enregistré." };
}

export async function deleteAlbumAction(id: string): Promise<void> {
  await deleteAlbum(id, await actor());
  redirect("/admin/galerie");
}
