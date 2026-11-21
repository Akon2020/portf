"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearSessionCookie, readSessionToken, setSessionCookie } from "../auth/session";
import { revokeSessionToken } from "../auth/session-store";
import { getRequestContext } from "../request-context";
import { MAGIC_LINK_SENT, confirmMagicLink, requestMagicLink, requirePortal, sendPortalMessage } from "../services/portal";

export interface PortalFormState {
  ok?: boolean;
  message?: string;
}

export async function requestMagicLinkAction(_: PortalFormState, formData: FormData): Promise<PortalFormState> {
  await requestMagicLink(String(formData.get("email") ?? ""), await getRequestContext());
  return { ok: true, message: MAGIC_LINK_SENT };
}

/** POST only: mail scanners that open the link never consume it. */
export async function confirmMagicLinkAction(token: string): Promise<PortalFormState> {
  const session = await confirmMagicLink(token, await getRequestContext());
  if (!session) return { ok: false, message: "Ce lien n'est plus valide. Demandez-en un nouveau." };
  await setSessionCookie("client", session);
  redirect("/espace-client");
}

export async function portalLogoutAction(): Promise<void> {
  const token = await readSessionToken("client");
  if (token) await revokeSessionToken(token);
  await clearSessionCookie("client");
  redirect("/espace-client/connexion");
}

export async function portalMessageAction(projectId: string | null, _: PortalFormState, formData: FormData): Promise<PortalFormState> {
  const { clientId } = await requirePortal();
  const result = await sendPortalMessage(clientId, projectId, String(formData.get("body") ?? ""), await getRequestContext());
  if (!result.ok) return { ok: false, message: result.error };
  revalidatePath("/espace-client");
  return { ok: true, message: "Message envoyé. Isaac vous répondra par e-mail sous 24 à 48 h." };
}
