import type { ClientProjectStatus, InvoiceStatus } from "@/server/db/schema";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

export const PROJECT_STATUS: Record<ClientProjectStatus, [string, Tone]> = {
  lead: ["Prospect", "neutral"],
  planned: ["Planifié", "info"],
  in_progress: ["En cours", "info"],
  review: ["En recette", "warning"],
  on_hold: ["En pause", "warning"],
  delivered: ["Livré", "success"],
  maintenance: ["Maintenance", "success"],
  cancelled: ["Annulé", "danger"],
};

export const INVOICE_STATUS: Record<InvoiceStatus, [string, Tone]> = {
  draft: ["Brouillon", "neutral"],
  sent: ["Envoyée", "info"],
  viewed: ["Consultée", "info"],
  partially_paid: ["Partiellement payée", "warning"],
  paid: ["Payée", "success"],
  overdue: ["En retard", "danger"],
  cancelled: ["Annulée", "neutral"],
};

export const MILESTONE_STATUS: Record<string, [string, Tone]> = {
  pending: ["À faire", "neutral"],
  in_progress: ["En cours", "info"],
  done: ["Terminé", "success"],
  cancelled: ["Annulé", "danger"],
};
