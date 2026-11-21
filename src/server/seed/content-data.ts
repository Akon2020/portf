import type { LocalizedText, ProjectCategory, ProjectMetric } from "../db/schema/content";

/**
 * Content imported from the current site (isaacakon.vercel.app, published)
 * and the former site (isaacakonkwa.vercel.app, drafts to review).
 * Figures are copied exactly as they were published and are flagged for review.
 */

export interface SeedProject {
  slug: string;
  title: LocalizedText;
  summary: LocalizedText;
  problem?: LocalizedText;
  objective?: LocalizedText;
  role?: LocalizedText;
  results?: ProjectMetric[];
  categories: ProjectCategory[];
  techStack: string[];
  stage: "concept" | "in_progress" | "completed" | "maintained";
  projectType: "personal" | "client" | "team" | "academic";
  confidential?: boolean;
  demoUrl?: string;
  repoUrl?: string;
  status: "draft" | "published";
  isFeatured?: boolean;
  reviewNote: string;
  cover?: { url: string; needsReplacement: boolean; alt: LocalizedText };
  gallery?: { url: string; needsReplacement: boolean; alt: LocalizedText }[];
}

const OLD = "https://isaacakonkwa.vercel.app";
const OLD_VISUAL = "Visuel repris de l'ancien site : vérifier qu'il s'agit d'une capture réelle.";

export const PORTRAIT_URL =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/_MG_1010-cCaWezEkxfqZHJgm5hoU5C8R6xpPDj.jpg";
export const PORTRAIT_ALT_URL =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Me-YR1Wrd2i8NBM3aKZG5rSG1ThieZtF9.jpg";

export const SEED_PROJECTS: SeedProject[] = [
  // Current site, published
  {
    slug: "diasmart",
    title: { fr: "DiaSmart", en: "DiaSmart" },
    summary: {
      fr: "Application intelligente pour le suivi et l'automatisation de la prise en charge des patients atteints du diabète de type 2.",
      en: "Smart application to monitor and automate the care of patients living with type 2 diabetes.",
    },
    role: {
      fr: "Projet de fin d'études à l'Université Catholique de Bukavu.",
      en: "Final year project at the Catholic University of Bukavu.",
    },
    categories: ["mobile", "ai", "health"],
    techStack: [],
    stage: "completed",
    projectType: "academic",
    status: "published",
    isFeatured: true,
    reviewNote:
      "À compléter : problème, objectif, stack, captures réelles et liens. L'image utilisée sur le site actuel est un portrait, pas un visuel du projet.",
  },
  {
    slug: "chat-with-pdf",
    title: { fr: "Chat With PDF", en: "Chat With PDF" },
    summary: {
      fr: "Transforme des documents PDF en agents interactifs pour comprendre, chercher et apprendre plus vite.",
      en: "Turns PDF documents into interactive agents to understand, search and learn faster.",
    },
    categories: ["saas", "web", "ai"],
    techStack: ["Next.js"],
    stage: "completed",
    projectType: "personal",
    status: "published",
    isFeatured: true,
    reviewNote: "À compléter : description détaillée, stack, liens démo et code. Visuel Unsplash à remplacer par une capture réelle.",
    cover: {
      url: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1600&q=85",
      needsReplacement: true,
      alt: { fr: "Code source affiché sur un écran", en: "Source code on a screen" },
    },
  },
  {
    slug: "medicure",
    title: { fr: "MediCure", en: "MediCure" },
    summary: {
      fr: "Système de gestion hospitalière avec patients, consultations, rôles et permissions.",
      en: "Hospital management system with patients, consultations, roles and permissions.",
    },
    categories: ["backend", "security", "health"],
    techStack: [],
    stage: "completed",
    projectType: "personal",
    status: "published",
    isFeatured: true,
    reviewNote: "À compléter : description détaillée, stack, liens. Visuel Unsplash à remplacer par une capture réelle.",
    cover: {
      url: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1600&q=85",
      needsReplacement: true,
      alt: { fr: "Environnement médical", en: "Medical environment" },
    },
  },

  // Former site, drafts
  {
    slug: "gestion-securite-publique",
    title: { fr: "Système de Gestion de la Sécurité Publique", en: "Public Safety Management System" },
    summary: {
      fr: "Application web et mobile de signalement et de coordination d'incidents en temps réel, avec analyses IA et géolocalisation.",
      en: "Web and mobile app for real time incident reporting and coordination, with AI insights and geolocation tracking.",
    },
    problem: {
      fr: "Les services de sécurité publique souffraient de signalements tardifs et d'une coordination faible entre les agents de terrain et les centres de commandement, ce qui ralentissait les interventions et rendait l'affectation des ressources inefficace.",
      en: "Public safety agencies faced delayed incident reporting and weak coordination between field officers and command centers, which slowed response times and made resource allocation inefficient.",
    },
    objective: {
      fr: "Une plateforme unifiée pour le signalement en temps réel, l'analyse des menaces assistée par IA et la coordination entre citoyens, agents de terrain et équipes d'intervention.",
      en: "A unified platform for real time incident reporting, AI powered threat analysis and coordination between citizens, field officers and emergency response teams.",
    },
    role: {
      fr: "Développeur fullstack : conception et réalisation du tableau de bord web et des applications mobiles, intégration des analyses IA, infrastructure de communication en temps réel.",
      en: "Fullstack developer: designed and built the web dashboard and mobile apps, integrated AI analytics and the real time communication infrastructure.",
    },
    results: [
      { label: { fr: "Temps moyen d'intervention", en: "Average incident response time" }, value: "-40 %" },
      { label: { fr: "Signalements traités les 3 premiers mois", en: "Reports processed in the first 3 months" }, value: "5 000+" },
      { label: { fr: "Agents de terrain coordonnés", en: "Field officers coordinated" }, value: "200+" },
      { label: { fr: "Précision de la classification IA", en: "AI classification accuracy" }, value: "85 %" },
    ],
    categories: ["web", "mobile", "ai", "security"],
    techStack: ["React", "Next.js", "React Native", "Node.js", "Express", "Firebase", "Mapbox", "TensorFlow", "WebSockets"],
    stage: "completed",
    projectType: "academic",
    demoUrl: "https://projet-tutore-2024-ucb.vercel.app",
    repoUrl: "https://github.com/Akon2020/securityApp",
    status: "draft",
    reviewNote: "Métriques de l'ancien site à confirmer avant publication (40 %, 5 000 rapports, 200 agents, 85 %). " + OLD_VISUAL,
    cover: {
      url: `${OLD}/security-management-dashboard.png`,
      needsReplacement: true,
      alt: { fr: "Tableau de bord de gestion des incidents", en: "Incident management dashboard" },
    },
  },
  {
    slug: "agribot",
    title: { fr: "AgriBot", en: "AgriBot" },
    summary: {
      fr: "Outil mobile de détection des maladies des plantes par vision par ordinateur pour aider les agriculteurs à protéger leurs cultures.",
      en: "Mobile AI tool for plant disease detection that helps farmers protect crops using computer vision.",
    },
    problem: {
      fr: "En zone rurale, les agriculteurs ont peu accès aux experts agricoles et identifient tard les maladies des plantes, ce qui entraîne des pertes de récolte importantes.",
      en: "Farmers in rural areas lack access to agricultural experts and struggle to identify plant diseases early, which leads to significant crop losses.",
    },
    objective: {
      fr: "Une application mobile qui identifie les maladies à partir d'une photo, recommande des traitements et met les agriculteurs en relation avec des experts, y compris hors connexion.",
      en: "A mobile app that identifies diseases from photos, recommends treatments and connects farmers with experts, including offline.",
    },
    role: {
      fr: "Développeur mobile et intégration IA : application React Native, entraînement et optimisation du modèle de détection, mode hors connexion pour les zones rurales.",
      en: "Mobile developer and AI integration: React Native app, training and optimization of the detection model, offline mode for rural areas.",
    },
    results: [
      { label: { fr: "Agriculteurs accompagnés, sur 5 régions", en: "Farmers helped, across 5 regions" }, value: "2 000+" },
      { label: { fr: "Précision de la détection", en: "Detection accuracy" }, value: "92 %" },
      { label: { fr: "Pertes de récolte en moyenne", en: "Average crop losses" }, value: "-30 %" },
    ],
    categories: ["mobile", "ai"],
    techStack: ["React Native", "Expo", "TensorFlow Lite", "Firebase", "Cloud Vision API", "SQLite"],
    stage: "completed",
    projectType: "personal",
    repoUrl: "https://github.com/Akon2020/agribot",
    status: "draft",
    reviewNote: "Métriques de l'ancien site à confirmer (2 000 agriculteurs, 5 régions, 92 %, 30 %). " + OLD_VISUAL,
    cover: {
      url: `${OLD}/agriculture-mobile-app.jpg`,
      needsReplacement: true,
      alt: { fr: "Application mobile AgriBot", en: "AgriBot mobile app" },
    },
    gallery: [
      { url: `${OLD}/agribot-scanning.jpg`, needsReplacement: true, alt: { fr: "Écran d'analyse d'une plante", en: "Plant scanning screen" } },
      { url: `${OLD}/agribot-results.jpg`, needsReplacement: true, alt: { fr: "Écran de résultats", en: "Results screen" } },
    ],
  },
  {
    slug: "mentorship-platform",
    title: { fr: "Plateforme de mentorat", en: "Mentorship Platform" },
    summary: {
      fr: "Solution web et mobile qui met en relation mentors et apprenants, avec communication en temps réel.",
      en: "Web and mobile solution connecting mentors and learners, with real time communication.",
    },
    problem: {
      fr: "Les jeunes professionnels peinent à trouver un mentor de qualité dans leur domaine, et les profils expérimentés manquent d'outils structurés pour transmettre.",
      en: "Aspiring professionals struggle to find quality mentors in their field, while experienced professionals lack structured platforms to share knowledge.",
    },
    objective: {
      fr: "Une plateforme qui associe mentors et apprenants selon les compétences et les objectifs, avec planification des séances et outils de transmission.",
      en: "A platform matching mentors and mentees by skills and goals, with scheduling and knowledge transfer tools.",
    },
    role: {
      fr: "Développeur fullstack : algorithme de mise en relation, interfaces web et mobile, appels vidéo et système de planification.",
      en: "Fullstack developer: matching algorithm, web and mobile interfaces, video calls and scheduling system.",
    },
    results: [
      { label: { fr: "Binômes mentor et apprenant", en: "Mentor and mentee pairs" }, value: "500+" },
      { label: { fr: "Séances de mentorat", en: "Mentorship sessions" }, value: "3 000+" },
      { label: { fr: "Satisfaction des utilisateurs", en: "User satisfaction" }, value: "95 %" },
      { label: { fr: "Note moyenne des séances", en: "Average session rating" }, value: "4,8/5" },
    ],
    categories: ["web", "mobile", "education"],
    techStack: ["React", "React Native", "FastAPI", "Firestore", "WebRTC", "Stripe"],
    stage: "completed",
    projectType: "personal",
    repoUrl: "https://github.com/Akon2020/mentorship-platform",
    status: "draft",
    reviewNote:
      "Métriques à confirmer (500 binômes, 3 000 séances, 95 %, 4,8/5). Le lien de démo de l'ancien site (mentorship-demo.example.com) est fictif et n'a pas été importé. " +
      OLD_VISUAL,
    cover: {
      url: `${OLD}/mentorship-platform-interface.jpg`,
      needsReplacement: true,
      alt: { fr: "Interface de la plateforme de mentorat", en: "Mentorship platform interface" },
    },
    gallery: [
      { url: `${OLD}/mentorship-matching.jpg`, needsReplacement: true, alt: { fr: "Écran de mise en relation", en: "Matching screen" } },
      { url: `${OLD}/mentorship-video-call.jpg`, needsReplacement: true, alt: { fr: "Écran d'appel vidéo", en: "Video call screen" } },
    ],
  },
  {
    slug: "e-commerce-platform",
    title: { fr: "Plateforme e-commerce", en: "E-Commerce Platform" },
    summary: {
      fr: "Place de marché en ligne avec paiement intégré, gestion des stocks et analyses.",
      en: "Online marketplace with payment integration, inventory management and analytics.",
    },
    categories: ["web"],
    techStack: ["Next.js", "Stripe", "PostgreSQL"],
    stage: "completed",
    projectType: "personal",
    status: "draft",
    reviewNote: "Réalité du projet à confirmer : la page détaillée n'existe pas sur l'ancien site (404). " + OLD_VISUAL,
    cover: { url: `${OLD}/ecommerce-dashboard-interface.jpg`, needsReplacement: true, alt: { fr: "Tableau de bord e-commerce", en: "E-commerce dashboard" } },
  },
  {
    slug: "health-tracker",
    title: { fr: "Application de suivi santé", en: "Health Tracker App" },
    summary: {
      fr: "Application mobile de suivi de la forme, de la nutrition et de la santé avec recommandations IA.",
      en: "Mobile application for tracking fitness goals, nutrition and health metrics with AI recommendations.",
    },
    categories: ["mobile", "health", "ai"],
    techStack: ["React Native", "Expo", "Firebase"],
    stage: "completed",
    projectType: "personal",
    status: "draft",
    reviewNote: "Réalité du projet à confirmer : la page détaillée n'existe pas sur l'ancien site (404). " + OLD_VISUAL,
    cover: { url: `${OLD}/health-fitness-mobile-app.jpg`, needsReplacement: true, alt: { fr: "Application mobile de suivi santé", en: "Health tracking mobile app" } },
  },
  {
    slug: "security-audit-tool",
    title: { fr: "Outil d'audit de sécurité", en: "Security Audit Tool" },
    summary: {
      fr: "Outil automatisé de scan de sécurité et d'évaluation des vulnérabilités pour les applications web.",
      en: "Automated security scanning and vulnerability assessment tool for web applications.",
    },
    categories: ["security", "backend"],
    techStack: ["Python", "FastAPI", "OWASP"],
    stage: "completed",
    projectType: "personal",
    status: "draft",
    reviewNote: "Réalité du projet à confirmer : la page détaillée n'existe pas sur l'ancien site (404). " + OLD_VISUAL,
    cover: { url: `${OLD}/cybersecurity-dashboard-interface.png`, needsReplacement: true, alt: { fr: "Tableau de bord de sécurité", en: "Security dashboard" } },
  },
  {
    slug: "real-time-chat",
    title: { fr: "Messagerie en temps réel", en: "Real-Time Chat Application" },
    summary: {
      fr: "Messagerie sécurisée avec chiffrement de bout en bout, partage de fichiers et conversations de groupe.",
      en: "Secure messaging platform with end to end encryption, file sharing and group conversations.",
    },
    categories: ["web"],
    techStack: ["React", "Node.js", "Socket.io"],
    stage: "completed",
    projectType: "personal",
    status: "draft",
    reviewNote: "Réalité du projet à confirmer : la page détaillée n'existe pas sur l'ancien site (404). " + OLD_VISUAL,
    cover: { url: `${OLD}/messaging-app-interface.jpg`, needsReplacement: true, alt: { fr: "Interface de messagerie", en: "Messaging interface" } },
  },
  {
    slug: "ai-content-generator",
    title: { fr: "Générateur de contenu IA", en: "AI Content Generator" },
    summary: {
      fr: "Application web qui génère des contenus marketing, des articles et des publications pour les réseaux sociaux.",
      en: "Web application that generates marketing content, blog posts and social media captions.",
    },
    categories: ["web", "ai"],
    techStack: ["Next.js", "OpenAI", "TypeScript"],
    stage: "completed",
    projectType: "personal",
    status: "draft",
    reviewNote: "Réalité du projet à confirmer : la page détaillée n'existe pas sur l'ancien site (404). " + OLD_VISUAL,
    cover: { url: `${OLD}/ai-content-generation-interface.jpg`, needsReplacement: true, alt: { fr: "Interface de génération de contenu", en: "Content generation interface" } },
  },

  // Recent projects, drafts without any figure
  {
    slug: "medhub",
    title: { fr: "MedHub", en: "MedHub" },
    summary: {
      fr: "Système de gestion hospitalière SaaS multi-structures pensé pour la RDC, avec fonctionnement hors connexion obligatoire.",
      en: "Multi facility SaaS hospital management system designed for the DRC, with mandatory offline operation.",
    },
    role: { fr: "Conçu et développé seul.", en: "Designed and built alone." },
    categories: ["web", "saas", "health"],
    techStack: ["Next.js", "PostgreSQL", "Drizzle", "PWA"],
    stage: "in_progress",
    projectType: "personal",
    status: "draft",
    reviewNote: "Pilote prévu dans un hôpital de 15 à 20 personnes : à mentionner ou non. Ajouter captures et résultats.",
  },
  {
    slug: "optima",
    title: { fr: "OPTIMA", en: "OPTIMA" },
    summary: {
      fr: "Gestion commerciale multi-boutique : chaque boutique a son administrateur et ses utilisateurs, un super-administrateur supervise l'ensemble. Fonctionne hors ligne avec synchronisation, premier module restaurant.",
      en: "Multi store commercial management: each store has its own administrator and users, a super administrator oversees everything. Works offline with sync, first module for restaurants.",
    },
    categories: ["web", "management"],
    techStack: ["Next.js", "PostgreSQL", "Prisma"],
    stage: "in_progress",
    projectType: "team",
    status: "draft",
    reviewNote: "Projet d'équipe : préciser le rôle d'Isaac, ajouter captures.",
  },
  {
    slug: "alfacine",
    title: { fr: "AlfaCiné", en: "AlfaCiné" },
    summary: {
      fr: "Gestion complète d'un cinéma : billetterie, programmation, réservations, confiserie, contrôle d'âge et fidélité, sur postes autonomes sans internet.",
      en: "Complete cinema management: ticketing, scheduling, bookings, concessions, age checks and loyalty, on standalone stations without internet.",
    },
    categories: ["web", "mobile", "management"],
    techStack: ["Next.js", "Dexie.js", "React Native", "NestJS", "PostgreSQL"],
    stage: "in_progress",
    projectType: "client",
    confidential: true,
    status: "draft",
    reviewNote: "Projet client confidentiel : accord du client requis avant toute publication.",
  },
  {
    slug: "masomocore",
    title: { fr: "MasomoCore", en: "MasomoCore" },
    summary: {
      fr: "Logiciel de gestion scolaire avec des espaces dédiés à la direction et au secrétariat, aux professeurs et aux familles.",
      en: "School management software with dedicated spaces for management and administration, teachers and families.",
    },
    categories: ["web", "education", "management"],
    techStack: [],
    stage: "completed",
    projectType: "personal",
    status: "draft",
    reviewNote: "Compléter la stack et les visuels. Peut être fusionné avec la nouvelle version client dans une seule étude de cas.",
  },
  {
    slug: "gestion-scolaire-client",
    title: { fr: "Logiciel de gestion scolaire (nouvelle version)", en: "School management software (new version)" },
    summary: {
      fr: "Reprise des fonctionnalités de MasomoCore pour une école, avec déploiement en ligne et cahier des charges fonctionnel et technique.",
      en: "MasomoCore features adapted for a school, with online deployment and a functional and technical specification.",
    },
    categories: ["web", "education", "saas"],
    techStack: [],
    stage: "concept",
    projectType: "client",
    confidential: true,
    status: "draft",
    reviewNote: "Projet client confidentiel, à fusionner éventuellement avec MasomoCore.",
  },
  {
    slug: "batela",
    title: { fr: "Batela", en: "Batela" },
    summary: {
      fr: "Outil maison de monitoring, d'observabilité et d'analytics pour applications web : erreurs, sécurité et bannissement d'IP, disponibilité, audience.",
      en: "In house monitoring, observability and analytics tool for web applications: errors, security and IP banning, uptime, audience.",
    },
    categories: ["web", "devtools", "security", "saas"],
    techStack: ["TypeScript", "Next.js"],
    stage: "concept",
    projectType: "personal",
    status: "draft",
    reviewNote: "Préciser la stack backend (NestJS ou Express).",
  },
  {
    slug: "ce-portfolio",
    title: { fr: "Ce portfolio", en: "This portfolio" },
    summary: {
      fr: "Site bilingue avec back-office, mini-CRM, facturation USD et CDF, espace client et module de sécurité maison.",
      en: "Bilingual site with back office, mini CRM, USD and CDF invoicing, client portal and in house security module.",
    },
    categories: ["web", "security", "management"],
    techStack: ["Next.js", "TypeScript", "PostgreSQL", "Drizzle", "Tailwind CSS"],
    stage: "in_progress",
    projectType: "personal",
    status: "draft",
    reviewNote: "À publier en étude de cas une fois le site en ligne.",
  },
  {
    slug: "manuel-anglais-secondaire",
    title: { fr: "Manuels d'anglais pour le secondaire (RDC)", en: "English textbooks for secondary school (DRC)" },
    summary: {
      fr: "Collection de 3 manuels (niveaux 1 à 3) adaptée au système éducatif congolais : unités illustrées, exercices, dictionnaire illustré et corrigé enseignant.",
      en: "Series of 3 textbooks (levels 1 to 3) adapted to the Congolese school system: illustrated units, exercises, picture dictionary and teacher answer key.",
    },
    categories: ["education"],
    techStack: [],
    stage: "completed",
    projectType: "personal",
    status: "draft",
    reviewNote: "Facultatif : à afficher dans une section « Autres réalisations » si souhaité.",
  },
];

export interface SeedJourney {
  key: string;
  type: "experience" | "education" | "community" | "speaking" | "award";
  organization: string;
  title: LocalizedText;
  description: LocalizedText;
  location?: string;
  startDate: string;
  endDate: string | null;
  status: "draft" | "published";
  needsReview: boolean;
  reviewNote?: string;
}

export const SEED_JOURNEY: SeedJourney[] = [
  {
    key: "nyumbani",
    type: "experience",
    organization: "Nyumbani Express",
    title: { fr: "CTO et développeur logiciel", en: "CTO and Software Developer" },
    description: {
      fr: "Développement d'un ERP full-stack pour l'immobilier, d'une application mobile et optimisation des performances.",
      en: "Built a full-stack real estate ERP and a mobile app, and optimized performance.",
    },
    startDate: "2025-01-01",
    endDate: null,
    status: "draft",
    needsReview: true,
    reviewNote: "Présente sur le site actuel mais absente de l'inventaire : confirmer avant publication.",
  },
  {
    key: "code-growth-alive",
    type: "experience",
    organization: "Code Growth Alive",
    title: { fr: "Développeur web et chargé de marketing", en: "Web Developer and Marketing Officer" },
    description: {
      fr: "Applications web professionnelles, APIs sécurisées, optimisation des performances et encadrement de développeurs en formation.",
      en: "Professional web applications, secure APIs, performance optimization and mentoring of developers in training.",
    },
    location: "Bukavu, RDC",
    startDate: "2023-01-01",
    endDate: null,
    status: "published",
    needsReview: true,
    reviewNote: "Incohérence : l'ancien site indique « 2025, Développeur ». Choisir la bonne version.",
  },
  {
    key: "gdg",
    type: "community",
    organization: "Google Developer Student Club / GDG On Campus UCB",
    title: { fr: "Lead Web et mentor backend (co-organisateur)", en: "Web Lead and Backend Mentor (co-organizer)" },
    description: {
      fr: "Développement web, backend Python, organisation d'ateliers et encadrement technique des apprenants.",
      en: "Web development, Python backend, workshops and technical mentoring of learners.",
    },
    location: "Bukavu, RDC",
    startDate: "2022-01-01",
    endDate: "2024-12-31",
    status: "published",
    needsReview: true,
    reviewNote: "Incohérence : l'ancien site indique « Co-organisateur, GDG On Campus UCB, 2023 ». Choisir la bonne version.",
  },
  {
    key: "akon-tech",
    type: "experience",
    organization: "Akon Tech",
    title: { fr: "CEO et fondateur", en: "CEO and Founder" },
    description: {
      fr: "Communauté de développeurs, designers et créateurs de contenus. Leadership, gestion de projets et mentorat.",
      en: "Community of developers, designers and content creators. Leadership, project management and mentoring.",
    },
    location: "Bukavu, RDC",
    startDate: "2020-01-01",
    endDate: null,
    status: "published",
    needsReview: false,
  },
  {
    key: "ucb",
    type: "education",
    organization: "Université Catholique de Bukavu",
    title: { fr: "Baccalauréat (BSc) en génie logiciel", en: "BSc in Software Engineering" },
    description: {
      fr: "Architecture logicielle, développement mobile et bases de la cybersécurité. Projet de fin d'études : DiaSmart.",
      en: "Software architecture, mobile development and cybersecurity fundamentals. Final year project: DiaSmart.",
    },
    location: "Bukavu, RDC",
    startDate: "2021-10-01",
    endDate: "2025-07-31",
    status: "published",
    needsReview: true,
    reviewNote:
      "Mention à confirmer : « grande distinction » sur le site actuel, « très grande distinction (82,5 %) » dans l'inventaire. Ajouter la mention dans la description une fois tranchée.",
  },
  {
    key: "devfest-bujumbura",
    type: "speaking",
    organization: "DevFest Bujumbura",
    title: { fr: "Intervenant", en: "Speaker" },
    description: {
      fr: "Pratiques du développement web moderne et avenir de l'IA en génie logiciel.",
      en: "Modern web development practices and the future of AI in software engineering.",
    },
    location: "Bujumbura, Burundi",
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    status: "draft",
    needsReview: true,
    reviewNote: "Repris de l'ancien site : préciser la date exacte et publier.",
  },
];

export const SEED_TESTIMONIALS = [
  {
    quote: { fr: "Isaac n'est pas seulement un développeur, c'est un bâtisseur de solutions utiles.", en: "Isaac is not just a developer; he's a builder of meaningful solutions." },
    authorName: "À compléter",
    authorCompany: "GDG On Campus UCB",
    authorRole: { fr: "Responsable de communauté", en: "Community Leader" },
  },
  {
    quote: { fr: "Sa capacité à allier expertise technique et empathie le distingue.", en: "His ability to merge technical expertise with empathy makes him stand out." },
    authorName: "À compléter",
    authorCompany: "Code Growth Alive",
    authorRole: { fr: "Mentor technique", en: "Tech Mentor" },
  },
  {
    quote: { fr: "Un développeur passionné qui comprend vraiment l'impact de la technologie.", en: "A passionate developer who truly understands the impact of technology." },
    authorName: "À compléter",
    authorCompany: "DevFest Bujumbura",
    authorRole: { fr: "Organisateur", en: "Event Organizer" },
  },
];

export const SEED_VALUES = [
  {
    title: { fr: "Empathie", en: "Empathy" },
    text: { fr: "La technologie doit servir les personnes : je conçois pour les utilisateurs.", en: "Technology should serve people: I build with users in mind." },
  },
  {
    title: { fr: "Impact", en: "Impact" },
    text: { fr: "Chaque ligne de code doit aider à résoudre un vrai problème.", en: "Every line of code should help solve a real problem." },
  },
  {
    title: { fr: "Communauté", en: "Community" },
    text: { fr: "On grandit ensemble, en partageant et en faisant progresser les autres.", en: "We grow together, by sharing knowledge and lifting others up." },
  },
  {
    title: { fr: "Innovation", en: "Innovation" },
    text: { fr: "Rester curieux et adopter les bons outils pour construire de meilleures solutions.", en: "Stay curious and adopt the right tools to build better solutions." },
  },
];

export const SEED_BIO_LONG: LocalizedText = {
  fr: "Mon intérêt pour la technologie est né d'une curiosité simple : comprendre comment fonctionne un site web, comment les systèmes communiquent et comment circulent les données.\n\nAujourd'hui, je travaille sur le développement web, les applications mobiles, l'intégration de l'IA et la cybersécurité. Je conçois des systèmes backend sécurisés avec Node.js et Python, et des interfaces web et mobiles intuitives avec React et React Native.\n\nJe suis aussi mentor : ancien co-organisateur de GDG On Campus UCB, j'ai été intervenant au DevFest 2024 de Bujumbura.",
  en: "My interest in technology started with a simple curiosity: how a website works, how systems talk to each other and how data moves.\n\nToday I work across web development, mobile applications, AI integration and cybersecurity. I build secure backend systems with Node.js and Python, and intuitive web and mobile interfaces with React and React Native.\n\nI am also a mentor: a former co-organizer of GDG On Campus UCB, I spoke at DevFest 2024 in Bujumbura.",
};

/**
 * Articles of the old site. Only the metadata could be recovered (the article
 * pages return a 404), so they are created as empty drafts to be completed
 * with `pnpm import:post`.
 */
export const SEED_POSTS: { slug: string; title: string; category: string; date: string; tags: string[] }[] = [
  { slug: "building-secure-rest-apis", title: "Building Secure REST APIs: Best Practices for 2025", category: "Web Dev", date: "2025-01-15", tags: ["api", "security", "backend"] },
  { slug: "optimizing-react-native-performance", title: "Optimizing React Native Performance: Lessons from Production", category: "Mobile Dev", date: "2025-01-08", tags: ["react-native", "performance", "mobile"] },
  { slug: "integrating-ai-into-web-apps", title: "Integrating AI into Your Web Apps: A Practical Guide", category: "AI", date: "2024-12-20", tags: ["ai", "web"] },
  { slug: "cybersecurity-fundamentals-for-developers", title: "Cybersecurity Fundamentals Every Developer Should Know", category: "Cybersecurity", date: "2024-12-10", tags: ["security", "owasp"] },
  { slug: "from-student-to-fullstack-developer", title: "My Journey from Student to Fullstack Developer", category: "Dev Life", date: "2024-11-25", tags: ["career"] },
  { slug: "mastering-nextjs-app-router", title: "Mastering Next.js App Router: A Complete Guide", category: "Web Dev", date: "2024-11-15", tags: ["nextjs", "react", "web"] },
];
