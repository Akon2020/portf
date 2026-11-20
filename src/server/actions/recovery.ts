"use server";

import { getRequestContext } from "../request-context";
import { requestPasswordReset, resetPassword, revokeSessionsWithToken } from "../services/account-recovery";

export interface RecoveryState {
  done?: boolean;
  error?: string;
}

export async function requestResetAction(_: RecoveryState, formData: FormData): Promise<RecoveryState> {
  const email = String(formData.get("email") ?? "").slice(0, 254);
  if (email) {
    try {
      await requestPasswordReset(email, await getRequestContext());
    } catch (error) {
      // Same answer whatever happens, the error is only logged.
      console.error("[recovery] reset request failed", error);
    }
  }
  return { done: true };
}

export async function resetPasswordAction(token: string, _: RecoveryState, formData: FormData): Promise<RecoveryState> {
  const result = await resetPassword(
    token,
    String(formData.get("password") ?? ""),
    String(formData.get("confirmation") ?? ""),
    await getRequestContext(),
  );
  return result.ok ? { done: true } : { error: result.error };
}

export async function revokeSessionsAction(token: string, _: RecoveryState): Promise<RecoveryState> {
  const ok = await revokeSessionsWithToken(token, await getRequestContext());
  return ok ? { done: true } : { error: "Ce lien est invalide, déjà utilisé ou expiré." };
}
