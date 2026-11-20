export const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  viewed: "Consulté",
  accepted: "Accepté",
  declined: "Refusé",
  expired: "Expiré",
};

export const QUOTE_STATUS_TONES = {
  draft: "neutral",
  sent: "info",
  viewed: "info",
  accepted: "success",
  declined: "danger",
  expired: "warning",
} as const;
