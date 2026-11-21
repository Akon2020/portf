"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { issuesToErrors, parseFormData } from "@/lib/form-data";
import { requireAdmin } from "../auth/guards";
import { getDb } from "../db";
import { quoteRequests, type QuoteRequest } from "../db/schema";
import { getRequestContext } from "../request-context";
import { writeAudit } from "../services/audit";
import {
  QuoteError,
  convertQuote,
  createQuoteDraft,
  deleteQuoteDraft,
  duplicateQuote,
  prepareWhatsappSend,
  quoteInputSchema,
  saveQuoteDraft,
  sendQuoteByEmail,
} from "../services/quotes";

export interface QuoteFormState {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
}

async function actor() {
  const { user } = await requireAdmin({ roles: ["super_admin", "editor"] });
  return { id: user.id, ...(await getRequestContext()) };
}

function failure(error: unknown): QuoteFormState {
  if (error instanceof QuoteError) return { ok: false, message: error.message };
  throw error;
}

export async function createQuoteDraftAction(formData: FormData): Promise<void> {
  const id = await createQuoteDraft(
    {
      requestId: String(formData.get("requestId") ?? "") || undefined,
      conversationId: String(formData.get("conversationId") ?? "") || undefined,
    },
    await actor(),
  );
  redirect(`/admin/devis/emis/${id}`);
}

export async function saveQuoteAction(id: string, _state: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const user = await actor();
  const parsed = quoteInputSchema.safeParse(parseFormData(formData));
  if (!parsed.success) return { ok: false, message: "Le devis contient des erreurs.", errors: issuesToErrors(parsed.error.issues) };
  try {
    await saveQuoteDraft(id, parsed.data, user);
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/admin/devis/emis/${id}`);
  return { ok: true, message: "Devis enregistré." };
}

export async function sendQuoteEmailAction(id: string, _state: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const user = await actor();
  try {
    const quote = await sendQuoteByEmail(
      id,
      { message: String(formData.get("message") ?? "").slice(0, 3000), copyToSelf: formData.get("copyToSelf") === "1" },
      user,
    );
    revalidatePath(`/admin/devis/emis/${id}`);
    return { ok: true, message: `Devis ${quote.number} envoyé à ${quote.recipientEmail}.` };
  } catch (error) {
    if (error instanceof QuoteError) return failure(error);
    console.error("[quotes] e-mail failed", error);
    return { ok: false, message: "L'envoi de l'e-mail a échoué. Vérifiez la configuration SMTP." };
  }
}

export async function whatsappQuoteAction(id: string): Promise<{ link?: string; error?: string }> {
  const user = await actor();
  try {
    const link = await prepareWhatsappSend(id, user);
    revalidatePath(`/admin/devis/emis/${id}`);
    return { link };
  } catch (error) {
    if (error instanceof QuoteError) return { error: error.message };
    throw error;
  }
}

export async function duplicateQuoteAction(id: string): Promise<void> {
  const copy = await duplicateQuote(id, await actor());
  redirect(`/admin/devis/emis/${copy}`);
}

export async function deleteQuoteAction(id: string): Promise<void> {
  await deleteQuoteDraft(id, await actor());
  redirect("/admin/devis/emis");
}

export async function convertQuoteAction(id: string, formData: FormData): Promise<void> {
  const percent = Number(String(formData.get("depositPercent") ?? "0").replace(",", "."));
  const result = await convertQuote(id, await actor(), {
    depositPercent: Number.isFinite(percent) ? Math.min(100, Math.max(0, Math.round(percent))) : 0,
    milestones: formData.get("milestones") === "1",
  });
  revalidatePath(`/admin/devis/emis/${id}`);
  redirect(result.invoiceId ? `/admin/facturation/${result.invoiceId}` : `/admin/clients/projets/${result.projectId}`);
}

export async function setRequestStatusAction(id: string, status: QuoteRequest["status"]): Promise<void> {
  const user = await actor();
  await getDb().update(quoteRequests).set({ status }).where(eq(quoteRequests.id, id));
  await writeAudit({ actorId: user.id, action: `quote_request.${status}`, entityType: "quote_request", entityId: id, ip: user.ip });
  revalidatePath("/admin/devis");
  revalidatePath(`/admin/devis/${id}`);
}

export async function replyNegotiationAction(id: string, _state: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const user = await actor();
  const { replyToNegotiation } = await import("../services/negotiation");
  try {
    await replyToNegotiation(id, String(formData.get("message") ?? ""), user);
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/admin/devis/emis/${id}`);
  return { ok: true, message: "Réponse envoyée au client, le devis est de nouveau ouvert." };
}

export async function reviseQuoteAction(id: string): Promise<void> {
  const { reviseQuote } = await import("../services/negotiation");
  const revision = await reviseQuote(id, await actor());
  redirect(`/admin/devis/emis/${revision}`);
}
