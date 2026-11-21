import { getSession } from "../auth/session";
import { getMediaById, getSetting } from "../content/queries";

export type Viewer = { kind: "admin" | "client"; name: string; avatarUrl: string | null };

/** Smallest variant of the profile portrait, used as the admin avatar. */
export async function adminAvatarUrl(): Promise<string | null> {
  const profile = await getSetting("profile");
  const portrait = await getMediaById(profile.portraitMediaId);
  if (!portrait) return null;
  return portrait.srcSet[0]?.url ?? portrait.url;
}

/**
 * Who is browsing, from a still valid session: the admin first (fully signed in,
 * second factor included), then a client of the portal. Null for visitors.
 */
export async function getViewer(): Promise<Viewer | null> {
  const admin = await getSession("admin");
  if (admin?.session.twoFactorVerified && admin.user.role !== "client") {
    return { kind: "admin", name: admin.user.name, avatarUrl: await adminAvatarUrl() };
  }
  const client = await getSession("client");
  if (client?.user.role === "client" && client.user.clientId) {
    return { kind: "client", name: client.user.name, avatarUrl: null };
  }
  return null;
}
