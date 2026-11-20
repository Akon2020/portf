"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "../auth/guards";
import type { Conversation } from "../db/schema";
import { getRequestContext } from "../request-context";
import { convertContactToClient, replyToConversation, setConversationStatus } from "../services/inbox";

export interface ReplyState {
  ok?: boolean;
  message?: string;
}

async function actor() {
  const { user } = await requireAdmin({ roles: ["super_admin", "editor"] });
  return { userId: user.id, meta: await getRequestContext() };
}

export async function replyAction(conversationId: string, _state: ReplyState, formData: FormData): Promise<ReplyState> {
  const { userId, meta } = await actor();
  const body = String(formData.get("body") ?? "").slice(0, 20_000);
  const result = await replyToConversation({ conversationId, body, authorId: userId }, meta);
  if (!result.ok) return { ok: false, message: result.error };
  revalidatePath(`/admin/messagerie/${conversationId}`);
  return {
    ok: true,
    message: result.delivered ? "Réponse envoyée." : "Réponse enregistrée : l'envoi a échoué et sera retenté automatiquement.",
  };
}

export async function setStatusAction(conversationId: string, status: Conversation["status"]): Promise<void> {
  const { userId, meta } = await actor();
  await setConversationStatus(conversationId, status, userId, meta);
  revalidatePath("/admin/messagerie");
  if (status === "spam") redirect("/admin/messagerie");
  revalidatePath(`/admin/messagerie/${conversationId}`);
}

export async function convertToClientAction(contactId: string, conversationId: string): Promise<void> {
  const { userId, meta } = await actor();
  await convertContactToClient(contactId, userId, meta);
  revalidatePath(`/admin/messagerie/${conversationId}`);
}
