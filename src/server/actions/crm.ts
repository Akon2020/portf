"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { issuesToErrors, parseFormData } from "@/lib/form-data";
import { requireAdmin } from "../auth/guards";
import { getRequestContext } from "../request-context";
import {
  ClientError,
  addProjectFiles,
  addProjectUpdate,
  clientInputSchema,
  clientProjectInputSchema,
  deleteClient,
  deleteClientProject,
  deleteMilestone,
  deleteProjectFile,
  deleteProjectUpdate,
  milestoneInputSchema,
  publishAsCaseStudy,
  saveClient,
  saveClientProject,
  saveMilestone,
  setPortalAccess,
  setProjectFileVisibility,
} from "../services/clients";
import {
  InvoiceError,
  cancelInvoice,
  createInvoiceDraft,
  deleteInvoiceDraft,
  invoiceInputSchema,
  invoiceWhatsappLink,
  paymentInputSchema,
  receiptWhatsappLink,
  recordPayment,
  saveInvoiceDraft,
  sendInvoiceByEmail,
  sendReceiptByEmail,
} from "../services/invoices";
import { AttachmentError } from "../storage/private";

export interface CrmFormState {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
}

async function actor() {
  const { user } = await requireAdmin({ roles: ["super_admin", "editor"] });
  return { id: user.id, ...(await getRequestContext()) };
}

function failure(error: unknown): CrmFormState {
  if (error instanceof ClientError) return { ok: false, message: error.message, errors: error.field ? { [error.field]: error.message } : undefined };
  if (error instanceof InvoiceError) return { ok: false, message: error.message };
  if (error instanceof AttachmentError) {
    const messages = { fileType: "Type de fichier refusé (PDF ou images uniquement).", fileSize: "Fichier trop volumineux (10 Mo maximum).", tooManyFiles: "5 fichiers maximum par envoi." };
    return { ok: false, message: messages[error.code] };
  }
  throw error;
}

const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value);

// Clients

export async function saveClientAction(id: string | null, _state: CrmFormState, formData: FormData): Promise<CrmFormState> {
  const user = await actor();
  const parsed = clientInputSchema.safeParse(parseFormData(formData));
  if (!parsed.success) return { ok: false, message: "La fiche contient des erreurs.", errors: issuesToErrors(parsed.error.issues) };
  let clientId: string;
  try {
    clientId = await saveClient(id, parsed.data, user);
  } catch (error) {
    return failure(error);
  }
  if (!id) redirect(`/admin/clients/${clientId}`);
  revalidatePath(`/admin/clients/${id}`);
  return { ok: true, message: "Fiche enregistrée." };
}

export async function deleteClientAction(id: string): Promise<CrmFormState> {
  try {
    await deleteClient(id, await actor());
  } catch (error) {
    return failure(error);
  }
  redirect("/admin/clients");
}

export async function setPortalAccessAction(id: string, enabled: boolean): Promise<CrmFormState> {
  try {
    await setPortalAccess(id, enabled, await actor());
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/admin/clients/${id}`);
  return { ok: true, message: enabled ? "Espace client activé." : "Espace client désactivé." };
}

// Client projects

export async function saveClientProjectAction(id: string | null, clientId: string, _state: CrmFormState, formData: FormData): Promise<CrmFormState> {
  const user = await actor();
  const parsed = clientProjectInputSchema.safeParse(parseFormData(formData, { booleans: ["visibleToClient"] }));
  if (!parsed.success) return { ok: false, message: "Le projet contient des erreurs.", errors: issuesToErrors(parsed.error.issues) };
  let projectId: string;
  try {
    projectId = await saveClientProject(id, clientId, parsed.data, user);
  } catch (error) {
    return failure(error);
  }
  if (!id) redirect(`/admin/clients/projets/${projectId}`);
  revalidatePath(`/admin/clients/projets/${id}`);
  return { ok: true, message: "Projet enregistré." };
}

export async function deleteClientProjectAction(id: string): Promise<void> {
  const clientId = await deleteClientProject(id, await actor());
  redirect(clientId ? `/admin/clients/${clientId}` : "/admin/clients");
}

export async function saveMilestoneAction(projectId: string, id: string | null, _state: CrmFormState, formData: FormData): Promise<CrmFormState> {
  const user = await actor();
  const parsed = milestoneInputSchema.safeParse(parseFormData(formData, { booleans: ["visibleToClient"] }));
  if (!parsed.success) return { ok: false, message: "Le jalon contient des erreurs.", errors: issuesToErrors(parsed.error.issues) };
  try {
    await saveMilestone(projectId, id, parsed.data, user);
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/admin/clients/projets/${projectId}`);
  return { ok: true, message: id ? "Jalon mis à jour." : "Jalon ajouté." };
}

export async function deleteMilestoneAction(projectId: string, id: string): Promise<void> {
  await deleteMilestone(projectId, id, await actor());
  revalidatePath(`/admin/clients/projets/${projectId}`);
}

export async function addProjectUpdateAction(projectId: string, _state: CrmFormState, formData: FormData): Promise<CrmFormState> {
  const user = await actor();
  try {
    await addProjectUpdate(projectId, String(formData.get("body") ?? ""), formData.get("visibleToClient") === "on" || formData.get("visibleToClient") === "1", user);
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/admin/clients/projets/${projectId}`);
  return { ok: true, message: "Note ajoutée au journal." };
}

export async function deleteProjectUpdateAction(projectId: string, id: string): Promise<void> {
  await actor();
  await deleteProjectUpdate(projectId, id);
  revalidatePath(`/admin/clients/projets/${projectId}`);
}

export async function uploadProjectFilesAction(projectId: string, _state: CrmFormState, formData: FormData): Promise<CrmFormState> {
  const user = await actor();
  const files = formData.getAll("files").filter((value): value is File => value instanceof File);
  try {
    const count = await addProjectFiles(
      projectId,
      files,
      { note: String(formData.get("note") ?? "").trim().slice(0, 300) || null, visibleToClient: formData.get("visibleToClient") === "on" || formData.get("visibleToClient") === "1" },
      user,
    );
    revalidatePath(`/admin/clients/projets/${projectId}`);
    return { ok: true, message: count > 1 ? `${count} fichiers ajoutés.` : "Fichier ajouté." };
  } catch (error) {
    return failure(error);
  }
}

export async function toggleProjectFileAction(projectId: string, id: string, visible: boolean): Promise<void> {
  await actor();
  await setProjectFileVisibility(projectId, id, visible);
  revalidatePath(`/admin/clients/projets/${projectId}`);
}

export async function deleteProjectFileAction(projectId: string, id: string): Promise<void> {
  await deleteProjectFile(projectId, id, await actor());
  revalidatePath(`/admin/clients/projets/${projectId}`);
}

export async function publishCaseStudyAction(projectId: string, formData: FormData): Promise<void> {
  if (formData.get("consent") !== "1") redirect(`/admin/clients/projets/${projectId}?accord=requis`);
  const id = await publishAsCaseStudy(projectId, await actor());
  redirect(`/admin/contenu/projets/${id}`);
}

// Invoices

export async function createInvoiceDraftAction(formData: FormData): Promise<void> {
  const user = await actor();
  const clientId = String(formData.get("clientId") ?? "");
  if (!isUuid(clientId)) redirect("/admin/facturation/nouveau?erreur=client");
  const optional = (name: string) => {
    const value = String(formData.get(name) ?? "");
    return isUuid(value) ? value : null;
  };
  const id = await createInvoiceDraft({ clientId, clientProjectId: optional("clientProjectId"), milestoneId: optional("milestoneId"), quoteId: optional("quoteId") }, user);
  redirect(`/admin/facturation/${id}`);
}

export async function saveInvoiceAction(id: string, _state: CrmFormState, formData: FormData): Promise<CrmFormState> {
  const user = await actor();
  const parsed = invoiceInputSchema.safeParse(parseFormData(formData));
  if (!parsed.success) return { ok: false, message: "La facture contient des erreurs.", errors: issuesToErrors(parsed.error.issues) };
  try {
    await saveInvoiceDraft(id, parsed.data, user);
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/admin/facturation/${id}`);
  return { ok: true, message: "Facture enregistrée." };
}

export async function sendInvoiceEmailAction(id: string, _state: CrmFormState, formData: FormData): Promise<CrmFormState> {
  const user = await actor();
  try {
    const reminder = formData.get("reminder") === "1";
    const invoice = await sendInvoiceByEmail(id, { message: String(formData.get("message") ?? "").slice(0, 3000), copyToSelf: formData.get("copyToSelf") === "1", reminder }, user);
    revalidatePath(`/admin/facturation/${id}`);
    return { ok: true, message: reminder ? `Relance envoyée à ${invoice.recipientEmail}.` : `Facture ${invoice.number} envoyée à ${invoice.recipientEmail}.` };
  } catch (error) {
    if (error instanceof InvoiceError) return failure(error);
    console.error("[invoices] e-mail failed", error);
    return { ok: false, message: "L'envoi de l'e-mail a échoué. Vérifiez la configuration SMTP." };
  }
}

export async function whatsappInvoiceAction(id: string, reminder: boolean): Promise<{ link?: string; error?: string }> {
  const user = await actor();
  try {
    const link = await invoiceWhatsappLink(id, user, reminder);
    revalidatePath(`/admin/facturation/${id}`);
    return { link };
  } catch (error) {
    if (error instanceof InvoiceError) return { error: error.message };
    throw error;
  }
}

export async function deleteInvoiceAction(id: string): Promise<void> {
  await deleteInvoiceDraft(id, await actor());
  redirect("/admin/facturation");
}

export async function cancelInvoiceAction(id: string, _state: CrmFormState, formData: FormData): Promise<CrmFormState> {
  try {
    await cancelInvoice(id, String(formData.get("reason") ?? ""), await actor());
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/admin/facturation/${id}`);
  return { ok: true, message: "Facture annulée." };
}

export async function recordPaymentAction(invoiceId: string, _state: CrmFormState, formData: FormData): Promise<CrmFormState> {
  const user = await actor();
  const parsed = paymentInputSchema.safeParse(parseFormData(formData));
  if (!parsed.success) return { ok: false, message: "Le paiement contient des erreurs.", errors: issuesToErrors(parsed.error.issues) };
  try {
    const { receipt } = await recordPayment(invoiceId, parsed.data, user);
    if (formData.get("sendReceipt") === "1") {
      try {
        await sendReceiptByEmail(receipt.id, user);
      } catch (error) {
        revalidatePath(`/admin/facturation/${invoiceId}`);
        return { ok: true, message: `Paiement enregistré, reçu ${receipt.number} créé, mais l'e-mail n'a pas pu partir : ${error instanceof Error ? error.message : "erreur"}` };
      }
    }
    revalidatePath(`/admin/facturation/${invoiceId}`);
    return { ok: true, message: `Paiement enregistré, reçu ${receipt.number} créé.` };
  } catch (error) {
    return failure(error);
  }
}

export async function sendReceiptEmailAction(invoiceId: string, receiptId: string): Promise<CrmFormState> {
  try {
    const to = await sendReceiptByEmail(receiptId, await actor());
    revalidatePath(`/admin/facturation/${invoiceId}`);
    return { ok: true, message: `Reçu envoyé à ${to}.` };
  } catch (error) {
    if (error instanceof InvoiceError) return failure(error);
    console.error("[receipts] e-mail failed", error);
    return { ok: false, message: "L'envoi de l'e-mail a échoué." };
  }
}

export async function whatsappReceiptAction(receiptId: string): Promise<{ link?: string; error?: string }> {
  const user = await actor();
  try {
    return { link: await receiptWhatsappLink(receiptId, user) };
  } catch (error) {
    if (error instanceof InvoiceError) return { error: error.message };
    throw error;
  }
}

export async function createBalanceInvoiceAction(fromInvoiceId: string): Promise<CrmFormState> {
  let id: string;
  try {
    const { createBalanceInvoice } = await import("../services/invoices");
    id = await createBalanceInvoice(fromInvoiceId, await actor());
  } catch (error) {
    return failure(error);
  }
  redirect(`/admin/facturation/${id}`);
}
