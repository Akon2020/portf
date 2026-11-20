"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "../auth/guards";
import { getRequestContext } from "../request-context";
import {
  beginTotpEnrollment,
  changePassword,
  confirmTotpEnrollment,
  disableTotp,
  regenerateBackupCodes,
  revokeOtherSessions,
} from "../services/auth";

export interface SecurityFormState {
  ok?: boolean;
  error?: string;
  message?: string;
  backupCodes?: string[];
}

const text = (max: number) => z.string().trim().max(max).default("");

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Prepares the secret so the QR code can be displayed. */
export async function startEnrollmentAction(): Promise<void> {
  const { user } = await requireAdmin();
  await beginTotpEnrollment(user.id);
  revalidatePath("/admin/securite");
}

export async function confirmEnrollmentAction(_: SecurityFormState, formData: FormData): Promise<SecurityFormState> {
  const { user } = await requireAdmin();
  const code = text(12).parse(field(formData, "code")).replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) return { error: "Saisissez les 6 chiffres affichés par l'application." };
  const result = await confirmTotpEnrollment(user.id, code, await getRequestContext());
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin", "layout");
  return { ok: true, backupCodes: result.backupCodes, message: "Double authentification activée." };
}

export async function disableTotpAction(_: SecurityFormState, formData: FormData): Promise<SecurityFormState> {
  const { user } = await requireAdmin();
  const result = await disableTotp(user.id, field(formData, "password"), text(24).parse(field(formData, "code")), await getRequestContext());
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Double authentification désactivée." };
}

export async function regenerateCodesAction(_: SecurityFormState, formData: FormData): Promise<SecurityFormState> {
  const { user } = await requireAdmin();
  const result = await regenerateBackupCodes(user.id, field(formData, "password"), text(24).parse(field(formData, "code")), await getRequestContext());
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/securite");
  return { ok: true, backupCodes: result.backupCodes, message: "Nouveaux codes générés. Les anciens ne fonctionnent plus." };
}

export async function changePasswordAction(_: SecurityFormState, formData: FormData): Promise<SecurityFormState> {
  const { user, session } = await requireAdmin();
  const result = await changePassword(
    user.id,
    session.id,
    {
      current: field(formData, "current").slice(0, 256),
      next: field(formData, "next").slice(0, 256),
      confirmation: field(formData, "confirmation").slice(0, 256),
      code: text(24).parse(field(formData, "code")),
    },
    await getRequestContext(),
  );
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/securite");
  return { ok: true, message: "Mot de passe modifié. Les autres sessions ont été fermées." };
}

export async function revokeOtherSessionsAction(): Promise<void> {
  const { user, session } = await requireAdmin();
  await revokeOtherSessions(user.id, session.id, await getRequestContext());
  revalidatePath("/admin/securite");
}
