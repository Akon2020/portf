type Tone = "neutral" | "success" | "warning" | "danger" | "info";

export const CATEGORY_LABELS: Record<string, string> = {
  path_scan: "Scan de chemins",
  sqli: "Injection SQL",
  xss: "XSS",
  path_traversal: "Traversée de répertoires",
  cmd_injection: "Injection de commande",
  brute_force: "Force brute",
  rate_abuse: "Abus de débit",
  bad_bot: "Robot malveillant",
  honeypot: "Piège (honeypot)",
  forbidden_method: "Méthode interdite",
  invalid_token: "Jeton invalide",
  other: "Autre",
};

export const SEVERITY: Record<string, [string, Tone]> = {
  low: ["Faible", "neutral"],
  medium: ["Moyenne", "info"],
  high: ["Élevée", "warning"],
  critical: ["Critique", "danger"],
};

export const ACTION_TAKEN: Record<string, string> = { logged: "journalisé", challenged: "vérifié", blocked: "bloqué", banned: "banni" };
