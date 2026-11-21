"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "../auth/guards";
import { getRequestContext } from "../request-context";
import { MonitoringError, addToAllowlist, manualBan, manualLift, removeFromAllowlist } from "../services/monitoring";

export interface MonitoringFormState {
  ok?: boolean;
  message?: string;
}

async function actor() {
  const { user } = await requireAdmin({ roles: ["super_admin"] });
  return { id: user.id, ...(await getRequestContext()) };
}

function refresh() {
  revalidatePath("/admin/monitoring", "layout");
}

export async function banAction(_: MonitoringFormState, formData: FormData): Promise<MonitoringFormState> {
  const user = await actor();
  const hours = Number(formData.get("hours") ?? 24);
  try {
    await manualBan({ ipOrCidr: String(formData.get("ip") ?? ""), reason: String(formData.get("reason") ?? "").slice(0, 300), hours: hours > 0 ? Math.min(hours, 24 * 365) : null }, user);
  } catch (error) {
    if (error instanceof MonitoringError) return { ok: false, message: error.message };
    throw error;
  }
  refresh();
  return { ok: true, message: "Adresse bannie." };
}

export async function quickBanAction(ip: string, hours: number | null): Promise<MonitoringFormState> {
  const user = await actor();
  try {
    await manualBan({ ipOrCidr: ip, reason: "Bannissement depuis la fiche IP", hours }, user);
  } catch (error) {
    if (error instanceof MonitoringError) return { ok: false, message: error.message };
    throw error;
  }
  refresh();
  return { ok: true, message: "Adresse bannie." };
}

export async function liftBanAction(id: string): Promise<void> {
  await manualLift(id, await actor());
  refresh();
}

export async function allowAction(_: MonitoringFormState, formData: FormData): Promise<MonitoringFormState> {
  const user = await actor();
  try {
    await addToAllowlist(String(formData.get("ip") ?? ""), String(formData.get("label") ?? ""), user);
  } catch (error) {
    if (error instanceof MonitoringError) return { ok: false, message: error.message };
    throw error;
  }
  refresh();
  return { ok: true, message: "Adresse ajoutée à la liste blanche." };
}

export async function quickAllowAction(ip: string): Promise<MonitoringFormState> {
  const user = await actor();
  await addToAllowlist(ip, "Ajoutée depuis la fiche IP", user);
  refresh();
  return { ok: true, message: "Adresse autorisée." };
}

export async function removeAllowAction(id: string): Promise<void> {
  await removeFromAllowlist(id, await actor());
  refresh();
}

/** The current IP of Isaac, to add it to the allowlist in one click. */
export async function allowMyIpAction(): Promise<MonitoringFormState> {
  const user = await actor();
  if (user.ip === "0.0.0.0") return { ok: false, message: "Adresse IP inconnue : vérifiez TRUST_PROXY sur le serveur." };
  await addToAllowlist(user.ip, "Mon adresse (ajoutée depuis l'administration)", user);
  refresh();
  return { ok: true, message: `${user.ip} ajoutée à la liste blanche.` };
}
