import { redirect } from "next/navigation";
import type { UserRole } from "../db/schema";
import { getSession } from "./session";
import type { ValidatedSession } from "./session-store";

const ADMIN_ROLES: UserRole[] = ["super_admin", "editor", "viewer"];

export class AuthError extends Error {
  constructor(message = "Non autorisé") {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Validates the admin session against the database. Must be called by every
 * protected page, server action and route handler: the proxy only performs
 * a lightweight cookie check.
 */
export async function requireAdmin(
  options: { roles?: UserRole[]; redirectTo?: string | false } = {},
): Promise<ValidatedSession> {
  const roles = options.roles ?? ADMIN_ROLES;
  const result = await getSession("admin");
  const allowed =
    result && result.session.twoFactorVerified && roles.includes(result.user.role);
  if (!allowed) {
    if (options.redirectTo === false) throw new AuthError();
    redirect(options.redirectTo ?? "/auth/login");
  }
  return result;
}

/** Client portal guard. Every query must then filter on result.user.clientId. */
export async function requireClient(
  options: { redirectTo?: string | false } = {},
): Promise<ValidatedSession & { clientId: string }> {
  const result = await getSession("client");
  const clientId = result?.user.clientId;
  if (!result || result.user.role !== "client" || !clientId) {
    if (options.redirectTo === false) throw new AuthError();
    redirect(options.redirectTo ?? "/espace-client/connexion");
  }
  return { ...result, clientId };
}
