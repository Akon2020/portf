import { formatPeriod } from "@/lib/format";
import { tr } from "@/lib/localized";
import type { EntityRoute } from "@/server/actions/content";
import {
  JOURNEY_TYPE_LABELS,
  PLATFORM_LABELS,
  SKILL_GROUP_LABELS,
  SKILL_LEVEL_LABELS,
  STATUS_LABELS,
  TESTIMONIAL_STATUS_LABELS,
} from "@/components/admin/labels";

type Row = Record<string, unknown> & { id: string };
type Tone = "neutral" | "success" | "warning" | "danger" | "info";

export interface EntityView {
  title: string;
  singular: string;
  description: string;
  primary: (row: Row) => string;
  secondary: (row: Row) => string;
  badges: (row: Row) => { label: string; tone: Tone }[];
}

const L = (value: unknown) => tr(value as { fr: string; en?: string }, "fr");
const visible = (row: Row) => (row.isVisible ? [] : [{ label: "Masqué", tone: "neutral" as Tone }]);
const status = (row: Row) => [
  { label: STATUS_LABELS[row.status as string], tone: (row.status === "published" ? "success" : "warning") as Tone },
  ...(row.needsReview ? [{ label: "À valider", tone: "warning" as Tone }] : []),
];

export const ENTITY_VIEWS: Record<EntityRoute, EntityView> = {
  parcours: {
    title: "Parcours",
    singular: "Élément de parcours",
    description: "Expériences, formation, communauté, interventions.",
    primary: (row) => `${L(row.title)} · ${row.organization}`,
    secondary: (row) =>
      `${JOURNEY_TYPE_LABELS[row.type as string]} · ${formatPeriod(row.startDate as string, row.endDate as string | null, "fr")}`,
    badges: status,
  },
  competences: {
    title: "Compétences",
    singular: "Compétence",
    description: "Stack technique groupée par domaine et niveau.",
    primary: (row) => String(row.name),
    secondary: (row) => `${SKILL_GROUP_LABELS[row.group as string]} · ${SKILL_LEVEL_LABELS[row.level as string]}`,
    badges: visible,
  },
  services: {
    title: "Services",
    singular: "Service",
    description: "Offres présentées sur la page Services et l'accueil.",
    primary: (row) => L(row.title),
    secondary: (row) => (row.startingPrice ? `À partir de ${Number(row.startingPrice) / 100} ${row.currency}` : "Sans prix affiché"),
    badges: visible,
  },
  temoignages: {
    title: "Témoignages",
    singular: "Témoignage",
    description: "Seuls les témoignages approuvés sont publiés.",
    primary: (row) => `${row.authorName}${row.authorCompany ? `, ${row.authorCompany}` : ""}`,
    secondary: (row) => L(row.quote).slice(0, 120),
    badges: (row) => [
      { label: TESTIMONIAL_STATUS_LABELS[row.status as string], tone: row.status === "approved" ? "success" : "warning" },
      ...(row.needsReview ? [{ label: "À valider", tone: "warning" as Tone }] : []),
    ],
  },
  chiffres: {
    title: "Chiffres clés",
    singular: "Chiffre clé",
    description: "Valeurs animées du hero. Uniquement des chiffres vérifiables.",
    primary: (row) => `${row.value}${row.suffix ?? ""} · ${L(row.label)}`,
    secondary: () => "",
    badges: visible,
  },
  reseaux: {
    title: "Réseaux sociaux",
    singular: "Lien",
    description: "Liens affichés dans le hero, le contact et le footer.",
    primary: (row) => `${PLATFORM_LABELS[row.platform as string]} · ${row.label}`,
    secondary: (row) => String(row.url),
    badges: visible,
  },
};

export const ENTITY_ROUTES = Object.keys(ENTITY_VIEWS) as EntityRoute[];

export function isEntityRoute(value: string): value is EntityRoute {
  return (ENTITY_ROUTES as string[]).includes(value);
}
