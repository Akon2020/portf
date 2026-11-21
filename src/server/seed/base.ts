import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { faqs, partners, services, settings, skills, socialLinks } from "../db/schema";
import { DEFAULT_SETTINGS } from "../content/settings-schema";

/** Base data: settings, social links, services and skills. Existing rows are never overwritten. */
export async function seedBase(log: (message: string) => void): Promise<void> {
  const db = getDb();

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const inserted = await db.insert(settings).values({ key, value }).onConflictDoNothing().returning();
    log(`settings.${key} : ${inserted.length ? "créé" : "déjà présent"}`);
  }

  const socials = [
    { platform: "github", label: "GitHub", url: "https://github.com/Akon2020", handle: "Akon2020" },
    { platform: "linkedin", label: "LinkedIn", url: "https://linkedin.com/in/akonizk", handle: "akonizk" },
    { platform: "x", label: "X", url: "https://twitter.com/akon1703", handle: "akon1703" },
    { platform: "instagram", label: "Instagram", url: "https://instagram.com/akonizk", handle: "akonizk" },
    { platform: "facebook", label: "Facebook", url: "https://facebook.com/Akonkwa.Ushindi", handle: "Akonkwa.Ushindi" },
    { platform: "email", label: "E-mail", url: "mailto:akonkwaushindi@gmail.com", handle: "akonkwaushindi@gmail.com" },
    { platform: "calendly", label: "Calendly", url: "https://calendly.com/akon1703", handle: "akon1703" },
  ] as const;
  for (const [index, social] of socials.entries()) {
    const [existing] = await db.select().from(socialLinks).where(eq(socialLinks.url, social.url)).limit(1);
    if (!existing) await db.insert(socialLinks).values({ ...social, sortOrder: index });
  }
  log(`réseaux sociaux : ${socials.length} vérifiés`);

  const serviceRows = [
    {
      slug: "developpement-web",
      icon: "code",
      title: { fr: "Développement web full-stack", en: "Full-stack web development" },
      description: {
        fr: "Applications web, plateformes SaaS et APIs avec React, Next.js, TypeScript et Node.js, pensées pour durer et pour les connexions lentes.",
        en: "Web applications, SaaS platforms and APIs with React, Next.js, TypeScript and Node.js, built to last and to work on slow connections.",
      },
      deliverables: [
        { fr: "Conception de l'architecture et du modèle de données", en: "Architecture and data model design" },
        { fr: "Interface responsive et accessible", en: "Responsive and accessible interface" },
        { fr: "Back-office et API sécurisés", en: "Secure back office and API" },
        { fr: "Mise en ligne et documentation", en: "Deployment and documentation" },
      ],
    },
    {
      slug: "applications-mobiles",
      icon: "smartphone",
      title: { fr: "Applications mobiles", en: "Mobile applications" },
      description: {
        fr: "Applications iOS et Android avec React Native et Expo, y compris le fonctionnement hors connexion.",
        en: "iOS and Android applications with React Native and Expo, including offline support.",
      },
      deliverables: [
        { fr: "Application iOS et Android", en: "iOS and Android application" },
        { fr: "Synchronisation et mode hors connexion", en: "Sync and offline mode" },
        { fr: "Publication sur les stores", en: "Store publication" },
      ],
    },
    {
      slug: "integration-ia",
      icon: "sparkles",
      title: { fr: "Intégration IA", en: "AI integration" },
      description: {
        fr: "Ajout de fonctionnalités d'intelligence artificielle utiles à un produit existant : assistants, analyse de documents, vision par ordinateur.",
        en: "Useful artificial intelligence features for an existing product: assistants, document analysis, computer vision.",
      },
      deliverables: [
        { fr: "Étude de faisabilité", en: "Feasibility study" },
        { fr: "Prototype puis intégration en production", en: "Prototype then production integration" },
      ],
    },
    {
      slug: "audit-securite",
      icon: "shield-check",
      title: { fr: "Audit de sécurité", en: "Security audit" },
      description: {
        fr: "Revue de la sécurité d'une application web : authentification, rôles et permissions, référentiel OWASP, recommandations priorisées.",
        en: "Security review of a web application: authentication, roles and permissions, OWASP checklist, prioritized recommendations.",
      },
      deliverables: [
        { fr: "Rapport détaillé des vulnérabilités", en: "Detailed vulnerability report" },
        { fr: "Plan de correction priorisé", en: "Prioritized remediation plan" },
      ],
    },
    {
      slug: "mentorat-formation",
      icon: "graduation-cap",
      title: { fr: "Mentorat et formation", en: "Mentoring and training" },
      description: {
        fr: "Accompagnement de développeurs et d'équipes : ateliers, revues de code, montée en compétences sur le web moderne.",
        en: "Support for developers and teams: workshops, code reviews, upskilling on the modern web.",
      },
      deliverables: [
        { fr: "Ateliers pratiques", en: "Hands-on workshops" },
        { fr: "Revues de code et suivi", en: "Code reviews and follow-up" },
      ],
    },
  ];
  for (const [index, service] of serviceRows.entries()) {
    await db.insert(services).values({ ...service, sortOrder: index }).onConflictDoNothing();
  }
  log(`services : ${serviceRows.length} vérifiés`);

  const skillRows: { group: (typeof skills.$inferInsert)["group"]; level: (typeof skills.$inferInsert)["level"]; names: string[] }[] = [
    { group: "frontend", level: "advanced", names: ["React", "Next.js", "Tailwind CSS", "TypeScript", "Framer Motion"] },
    { group: "backend", level: "advanced", names: ["Node.js", "Express", "FastAPI", "Flask", "REST", "GraphQL", "WebSockets"] },
    { group: "mobile", level: "advanced", names: ["React Native", "Expo", "Modules natifs", "UI/UX mobile"] },
    {
      group: "database",
      level: "confirmed",
      names: ["Prisma", "Drizzle", "Sequelize", "Mongoose", "PostgreSQL", "MySQL", "MongoDB", "Firebase"],
    },
    { group: "cloud", level: "confirmed", names: ["Firebase", "Google Cloud", "AWS", "Vercel", "Supabase", "Docker"] },
    { group: "ai", level: "confirmed", names: ["Machine learning", "TensorFlow", "Vision par ordinateur", "CNN", "Python"] },
    {
      group: "security",
      level: "intermediate",
      names: ["Bug bounty", "Pentesting web", "CTF", "Hacking éthique", "Audits", "OWASP", "Authentification", "Rôles et permissions"],
    },
  ];
  const existingSkills = await db.select({ name: skills.name, group: skills.group }).from(skills);
  const known = new Set(existingSkills.map((skill) => `${skill.group}:${skill.name}`));
  let order = 0;
  for (const row of skillRows) {
    for (const name of row.names) {
      order++;
      if (known.has(`${row.group}:${name}`)) continue;
      await db.insert(skills).values({ name, group: row.group, level: row.level, sortOrder: order });
    }
  }
  log(`compétences : ${order} vérifiées`);

  // Trust band: organizations of the journey, without logo nor website until Isaac adds them.
  const organizations = ["Akon Tech", "Université Catholique de Bukavu", "GDG On Campus UCB", "DevFest Bujumbura", "Code Growth Alive"];
  const existingPartners = new Set((await db.select({ name: partners.name }).from(partners)).map((row) => row.name));
  for (const [index, name] of organizations.entries()) {
    if (!existingPartners.has(name)) await db.insert(partners).values({ name, sortOrder: index });
  }
  log(`bandeau de confiance : ${organizations.length} organisations vérifiées`);

  // Starter FAQ, built only from facts given by Isaac. Editable in Contenu, Questions fréquentes.
  const faqRows = [
    {
      category: { fr: "Travailler ensemble", en: "Working together" },
      question: { fr: "Sur quels types de missions puis-je vous solliciter ?", en: "What kind of work can I hire you for?" },
      answer: {
        fr: "Je suis ouvert aux missions freelance, aux collaborations et aux postes à temps plein : applications web et mobiles, intégration de l'IA, sécurité applicative, ainsi que le mentorat et la formation.",
        en: "I am open to freelance missions, collaborations and full-time roles: web and mobile applications, AI integration, application security, as well as mentoring and training.",
      },
      showOnHome: true,
    },
    {
      category: { fr: "Travailler ensemble", en: "Working together" },
      question: { fr: "Sous quel délai répondez-vous ?", en: "How quickly do you reply?" },
      answer: { fr: "Je réponds en général sous 24 à 48 h, par e-mail ou WhatsApp selon votre préférence.", en: "I usually reply within 24 to 48 hours, by e-mail or WhatsApp as you prefer." },
      showOnHome: true,
    },
    {
      category: { fr: "Travailler ensemble", en: "Working together" },
      question: { fr: "Où êtes-vous basé et dans quelles langues travaillez-vous ?", en: "Where are you based and which languages do you work in?" },
      answer: { fr: "Je suis basé à Bukavu, en République démocratique du Congo, et je travaille en français et en anglais, à distance ou sur place.", en: "I am based in Bukavu, Democratic Republic of the Congo, and work in French and English, remotely or on site." },
      showOnHome: false,
    },
    {
      category: { fr: "Devis et paiement", en: "Quotes and payment" },
      question: { fr: "Comment obtenir un devis ?", en: "How do I get a quote?" },
      answer: {
        fr: "Remplissez le formulaire de demande de devis : type de projet, fonctionnalités, budget et délai. Vous recevez un devis détaillé que vous pouvez accepter en ligne, ou négocier si le budget ou le périmètre doit évoluer.",
        en: "Fill in the quote request form: project type, features, budget and timeline. You receive a detailed quote that you can accept online, or negotiate if the budget or scope needs to change.",
      },
      showOnHome: true,
    },
    {
      category: { fr: "Devis et paiement", en: "Quotes and payment" },
      question: { fr: "Dans quelle devise et comment se règlent les factures ?", en: "Which currency and payment methods do you accept?" },
      answer: {
        fr: "Les devis et factures sont établis en dollars américains ou en francs congolais. Chaque paiement, total ou partiel, donne lieu à un reçu, et vous suivez à tout moment le montant déjà réglé et le reste à payer.",
        en: "Quotes and invoices are issued in US dollars or Congolese francs. Every payment, full or partial, comes with a receipt, and you can always see what has been paid and what remains.",
      },
      showOnHome: false,
    },
    {
      category: { fr: "Suivi du projet", en: "Project follow-up" },
      question: { fr: "Comment suivre l'avancement de mon projet ?", en: "How can I follow my project?" },
      answer: {
        fr: "Chaque client dispose d'un espace personnel, accessible par un lien envoyé par e-mail, avec l'avancement, les étapes, les fichiers partagés, les devis, les factures et les reçus.",
        en: "Every client has a personal space, opened with a link sent by e-mail, showing progress, milestones, shared files, quotes, invoices and receipts.",
      },
      showOnHome: false,
    },
  ];
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(faqs);
  if (total === 0) {
    await db.insert(faqs).values(faqRows.map((row, index) => ({ ...row, sortOrder: index })));
    log(`questions fréquentes : ${faqRows.length} créées`);
  } else {
    log("questions fréquentes : déjà présentes");
  }
}
