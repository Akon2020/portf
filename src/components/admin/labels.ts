/** French labels for enums, shared by admin lists and forms. */

const toOptions = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

export const STATUS_LABELS: Record<string, string> = { draft: "Brouillon", published: "Publié", archived: "Archivé" };
export const STAGE_LABELS: Record<string, string> = {
  concept: "Concept",
  in_progress: "En cours",
  completed: "Terminé",
  maintained: "Maintenu",
};
export const PROJECT_TYPE_LABELS: Record<string, string> = {
  personal: "Personnel",
  client: "Client",
  team: "Équipe",
  academic: "Académique",
};
export const CATEGORY_LABELS: Record<string, string> = {
  web: "Web",
  mobile: "Mobile",
  ai: "IA",
  security: "Sécurité",
  saas: "SaaS",
  backend: "Backend",
  health: "Santé",
  education: "Éducation",
  management: "Gestion",
  devtools: "Outils dev",
};
export const JOURNEY_TYPE_LABELS: Record<string, string> = {
  experience: "Expérience",
  education: "Formation",
  community: "Communauté",
  speaking: "Intervention",
  award: "Distinction",
};
export const SKILL_GROUP_LABELS: Record<string, string> = {
  frontend: "Frontend",
  backend: "Backend",
  mobile: "Mobile",
  database: "Bases de données",
  cloud: "Cloud",
  ai: "IA",
  security: "Sécurité",
  tools: "Outils",
};
export const SKILL_LEVEL_LABELS: Record<string, string> = { advanced: "Avancé", confirmed: "Confirmé", intermediate: "Intermédiaire" };
export const TESTIMONIAL_STATUS_LABELS: Record<string, string> = { pending: "En attente", approved: "Approuvé", hidden: "Masqué" };
export const PLATFORM_LABELS: Record<string, string> = {
  github: "GitHub",
  linkedin: "LinkedIn",
  x: "X (Twitter)",
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  email: "E-mail",
  calendly: "Calendly",
  youtube: "YouTube",
  tiktok: "TikTok",
  other: "Autre",
};

export const STATUS_OPTIONS = toOptions(STATUS_LABELS);
export const STAGE_OPTIONS = toOptions(STAGE_LABELS);
export const PROJECT_TYPE_OPTIONS = toOptions(PROJECT_TYPE_LABELS);
export const CATEGORY_OPTIONS = toOptions(CATEGORY_LABELS);
export const JOURNEY_TYPE_OPTIONS = toOptions(JOURNEY_TYPE_LABELS);
export const SKILL_GROUP_OPTIONS = toOptions(SKILL_GROUP_LABELS);
export const SKILL_LEVEL_OPTIONS = toOptions(SKILL_LEVEL_LABELS);
export const TESTIMONIAL_STATUS_OPTIONS = toOptions(TESTIMONIAL_STATUS_LABELS);
export const PLATFORM_OPTIONS = toOptions(PLATFORM_LABELS);
export const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD" },
  { value: "CDF", label: "CDF" },
];
