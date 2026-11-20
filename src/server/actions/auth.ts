"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "../auth/guards";
import { SESSION_POLICIES } from "../auth/policy";
import { clearSessionCookie, readSessionToken, setSessionCookie } from "../auth/session";
import { getRequestContext } from "../request-context";
import {
  confirmTotpSetup,
  loginWithPassword,
  logout,
  verifySecondFactor,
} from "../services/auth";

export interface AuthFormState {
  error?: string;
  backupCodes?: string[];
}

const GENERIC_ERROR = "Identifiants invalides.";

/** Only internal admin paths are accepted as a post login destination. */
function safeAdminPath(value: unknown): string {
  if (typeof value !== "string") return "/admin";
  if (!value.startsWith("/admin") || value.startsWith("//") || value.includes("\\")) return "/admin";
  return value;
}

function retryMessage(seconds?: number): string {
  const minutes = Math.max(1, Math.ceil((seconds ?? 60) / 60));
  return `Trop de tentatives. Réessayez dans ${minutes} min.`;
}

const loginSchema = z.object({
  email: z.string().trim().max(254),
  password: z.string().min(1).max(256),
  next: z.string().max(500).optional(),
});

export async function loginAction(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: GENERIC_ERROR };

  const meta = await getRequestContext();
  const result = await loginWithPassword(parsed.data, meta);
  if (!result.ok) {
    return {
      error: result.error === "too_many_attempts" ? retryMessage(result.retryAfterSeconds) : GENERIC_ERROR,
    };
  }

  const policy = result.next === "setup" ? SESSION_POLICIES.pending_setup : SESSION_POLICIES.pending_2fa;
  await setSessionCookie("admin", result.token, policy.absolute);
  const next = safeAdminPath(parsed.data.next);
  if (result.next === "setup") redirect("/admin/2fa/configuration");
  redirect(next === "/admin" ? "/admin/2fa" : `/admin/2fa?next=${encodeURIComponent(next)}`);
}

const codeSchema = z.object({
  code: z.string().trim().min(6).max(20),
  next: z.string().max(500).optional(),
});

export async function verifyTwoFactorAction(
  _: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = codeSchema.safeParse({
    code: formData.get("code"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: "Code invalide." };

  const token = await readSessionToken("admin");
  if (!token) redirect("/admin/login");

  const result = await verifySecondFactor(token, parsed.data.code, await getRequestContext());
  if (!result.ok) {
    if (result.error === "invalid_code") return { error: "Code invalide." };
    await clearSessionCookie("admin");
    redirect("/admin/login?raison=expiree");
  }
  await setSessionCookie("admin", result.token);
  redirect(safeAdminPath(parsed.data.next));
}

export async function confirmTotpSetupAction(
  _: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = codeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: "Code invalide." };

  const token = await readSessionToken("admin");
  if (!token) redirect("/admin/login");

  const result = await confirmTotpSetup(token, parsed.data.code, await getRequestContext());
  if (!result.ok) {
    if (result.error === "invalid_code") return { error: "Code invalide. Vérifiez l'heure de votre téléphone." };
    await clearSessionCookie("admin");
    redirect("/admin/login?raison=expiree");
  }
  await setSessionCookie("admin", result.token);
  // Codes are returned once and never stored in clear.
  return { backupCodes: result.backupCodes };
}

export async function logoutAction(): Promise<void> {
  const { session, user } = await requireAdmin();
  await logout(session.id, user.id, await getRequestContext());
  await clearSessionCookie("admin");
  redirect("/admin/login");
}

export async function cancelLoginAction(): Promise<void> {
  await clearSessionCookie("admin");
  redirect("/admin/login");
}
