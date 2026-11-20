"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  Code2,
  ExternalLink,
  Globe2,
  Mail,
  Menu,
  Moon,
  Play,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
} from "lucide-react";

const portrait =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/_MG_1010-cCaWezEkxfqZHJgm5hoU5C8R6xpPDj.jpg";
const portraitAlt =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Me-YR1Wrd2i8NBM3aKZG5rSG1ThieZtF9.jpg";

const copy = {
  fr: {
    nav: ["À propos", "Expertise", "Parcours", "Projets", "Contact"],
    eyebrow: "Ingénieur logiciel · Bukavu, RDC",
    hero: "Je conçois des produits numériques qui créent un impact réel.",
    intro:
      "Full-stack engineer, builder et mentor. Je transforme des problèmes complexes en expériences web, mobiles et IA simples à utiliser.",
    cta: "Découvrir mon parcours",
    contact: "Parlons de votre projet",
    availability: "Disponible pour de nouvelles collaborations",
    selected: "Sélection de projets",
    view: "Voir le projet",
    aboutKicker: "Profil",
    aboutTitle: "La technique au service des personnes.",
    aboutText:
      "Depuis Bukavu, je développe des solutions accessibles et robustes à la croisée du produit, de la donnée et de l’intelligence artificielle. Mon approche mêle exigence technique, curiosité et transmission.",
    expertise: "Expertise",
    expertiseTitle: "Construire avec méthode, livrer avec intention.",
    timeline: "Parcours",
    timelineTitle: "Une trajectoire guidée par l’apprentissage et l’impact.",
    skills: "Stack technique",
    skillsText:
      "Des outils choisis pour résoudre les bons problèmes — pas pour remplir une liste.",
    contactTitle: "Une idée à faire grandir ?",
    contactText:
      "Échangeons sur votre produit, votre équipe ou votre prochaine étape.",
    footer: "Ingénieur logiciel & fondateur d’Akon Tech.",
  },
  en: {
    nav: ["About", "Expertise", "Journey", "Projects", "Contact"],
    eyebrow: "Software engineer · Bukavu, DRC",
    hero: "I build digital products that create meaningful impact.",
    intro:
      "Full-stack engineer, builder and mentor. I turn complex problems into simple web, mobile and AI experiences.",
    cta: "Explore my journey",
    contact: "Let’s talk about your project",
    availability: "Available for new collaborations",
    selected: "Selected work",
    view: "View project",
    aboutKicker: "Profile",
    aboutTitle: "Technology in service of people.",
    aboutText:
      "From Bukavu, I build accessible and resilient solutions at the intersection of product, data and artificial intelligence. My approach combines technical rigor, curiosity and mentorship.",
    expertise: "Expertise",
    expertiseTitle: "Build with method, ship with intention.",
    timeline: "Journey",
    timelineTitle: "A path shaped by learning and impact.",
    skills: "Technical stack",
    skillsText:
      "Tools chosen to solve the right problems — not to fill a list.",
    contactTitle: "An idea worth growing?",
    contactText: "Let’s talk about your product, team or next chapter.",
    footer: "Software engineer & founder of Akon Tech.",
  },
};

const projects = [
  {
    no: "01",
    title: "DiaSmart",
    category: "Mobile · IA · Santé",
    description:
      "Application intelligente pour le suivi et l’automatisation des patients atteints du diabète de type 2.",
    image: portraitAlt,
    tone: "project-orange",
  },
  {
    no: "02",
    title: "Chat With PDF",
    category: "SaaS · Next.js · IA",
    description:
      "Transforme des documents PDF en agents interactifs pour comprendre, chercher et apprendre plus vite.",
    image:
      "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1400&q=85",
    tone: "project-green",
  },
  {
    no: "03",
    title: "MediCure",
    category: "API · Backend · Sécurité",
    description:
      "Système de gestion hospitalière avec patients, consultations, rôles et permissions.",
    image:
      "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1400&q=85",
    tone: "project-navy",
  },
];

const timeline = [
  [
    "2025 - aujourd’hui",
    "Nyumbani Express",
    "CTO & Software Developer",
    "Développement d’un ERP FullStack de travail immobilier, Mobile App et optimisation des performances.",
  ],
  [
    "2023 - aujourd’hui",
    "Code, Growth Alive",
    "Web Developer & Chargé de marketing",
    "Développement d’applications web professionnelles, APIs sécurisées et optimisation des performances.",
  ],
  [
    "2022 - 2024",
    "Google Developer Student Club",
    "Lead Web & Mentor backend",
    "Développement web, backend Python et encadrement technique des apprenants.",
  ],
  [
    "2020 - aujourd’hui",
    "Akon Tech",
    "CEO & Fondateur",
    "Communauté de développeurs, designers et créateurs de contenus. Leadership, gestion de projets et mentorat.",
  ],
  [
    "2021 - 2025",
    "Université Catholique de Bukavu",
    "Baccalauréat en Génie Logiciel",
    "Projet DiaSmart. Mention grande distinction.",
  ],
];

const expertise = [
  {
    icon: Code2,
    title: "Full-stack",
    text: "React, Next.js, TypeScript, Node.js et APIs REST pensées pour durer.",
  },
  {
    icon: Sparkles,
    title: "Mobile & IA",
    text: "React Native, Firebase, computer vision et expériences intelligentes.",
  },
  {
    icon: ShieldCheck,
    title: "Sécurité",
    text: "Authentification, rôles, permissions, pentesting web et culture du risque.",
  },
];

export default function Page() {
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [dark, setDark] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeProject, setActiveProject] = useState<number | null>(null);
  const [currentYear, setCurrentYear] = useState<number | string>('...');
  const t = copy[language];

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <main className={dark ? "site dark" : "site"}>
      <header className="nav-wrap">
        <nav className="nav container" aria-label="Navigation principale">
          <a href="#top" className="brand" aria-label="Isaac Akonkwa — accueil">
            <span className="brand-mark">A</span>
            <span>
              Isaac
              <br />
              Akonkwa
            </span>
          </a>
          <div className={`nav-links ${menuOpen ? "nav-links-open" : ""}`}>
            {t.nav.map((item, index) => (
              <a
                key={item}
                href={
                  ["#about", "#expertise", "#journey", "#projects", "#contact"][
                    index
                  ]
                }
                onClick={() => setMenuOpen(false)}
              >
                {item}
              </a>
            ))}
          </div>
          <div className="nav-actions">
            <button
              className="icon-button"
              onClick={() => setDark(!dark)}
              aria-label={
                dark ? "Activer le thème clair" : "Activer le thème sombre"
              }
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              className="language"
              onClick={() => setLanguage(language === "fr" ? "en" : "fr")}
              aria-label="Changer de langue"
            >
              {language.toUpperCase()}
            </button>
            <button
              className="menu-button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Ouvrir le menu"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </nav>
      </header>

      <section id="top" className="hero container">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" />
            {t.eyebrow}
          </p>
          <h1>{t.hero}</h1>
          <p className="hero-intro">{t.intro}</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#journey">
              {t.cta}
              <ArrowDownRight size={17} />
            </a>
            <a className="text-link" href="#contact">
              {t.contact}
              <ArrowUpRight size={16} />
            </a>
          </div>
          <div className="hero-meta">
            <span>01 / 04</span>
            <span>{t.availability}</span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="portrait-frame">
            <img src={portrait} alt="Portrait professionnel d’Isaac Akonkwa" />
          </div>
          <div className="hero-note">
            <span>Based in</span>
            <strong>Bukavu, DRC</strong>
          </div>
          <div className="hero-stamp">
            EST.
            <br />
            <strong>2020</strong>
          </div>
        </div>
      </section>

      <section id="about" className="about section container">
        <div className="section-label">
          <span>01</span>
          <span>{t.aboutKicker}</span>
        </div>
        <div className="about-content">
          <h2>{t.aboutTitle}</h2>
          <div>
            <p className="lead">{t.aboutText}</p>
            <a className="text-link" href="#contact">
              LinkedIn <ArrowUpRight size={16} />
            </a>
          </div>
        </div>
      </section>

      <section id="expertise" className="expertise section">
        <div className="container">
          <div className="section-label">
            <span>02</span>
            <span>{t.expertise}</span>
          </div>
          <div className="section-heading">
            <h2>{t.expertiseTitle}</h2>
            <span className="heading-line" />
          </div>
          <div className="expertise-grid">
            {expertise.map(({ icon: Icon, title, text }, index) => (
              <motion.article
                className="expertise-card"
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="card-icon">
                  <Icon size={22} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <span className="card-index">0{index + 1}</span>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section id="journey" className="journey section container">
        <div className="section-label">
          <span>03</span>
          <span>{t.timeline}</span>
        </div>
        <div className="section-heading">
          <h2>{t.timelineTitle}</h2>
          <a
            className="button button-outline"
            href="mailto:akonkwaushindi@gmail.com"
          >
            CV complet <ExternalLink size={15} />
          </a>
        </div>
        <div className="timeline">
          {timeline.map(([date, company, role, text], index) => (
            <motion.article
              className="timeline-item"
              key={company}
              initial={{ opacity: 0, x: -15 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
            >
              <div className="timeline-date">{date}</div>
              <div className="timeline-marker">
                <span />
              </div>
              <div className="timeline-content">
                <p className="timeline-company">{company}</p>
                <h3>{role}</h3>
                <p>{text}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      <section id="projects" className="projects section">
        <div className="container">
          <div className="section-label">
            <span>04</span>
            <span>{t.selected}</span>
          </div>
          <div className="project-list">
            {projects.map((project, index) => (
              <motion.article
                className={`project-card ${project.tone}`}
                key={project.title}
                onClick={() => setActiveProject(index)}
                whileHover={{ y: -6 }}
              >
                <div className="project-image">
                  <img src={project.image} alt={project.title} loading="lazy" />
                  <span className="project-number">{project.no}</span>
                  <span className="project-play">
                    <Play size={15} fill="currentColor" />
                  </span>
                </div>
                <div className="project-info">
                  <p>{project.category}</p>
                  <h3>{project.title}</h3>
                  <span>
                    {t.view} <ArrowUpRight size={15} />
                  </span>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="skills section container">
        <div className="section-label">
          <span>05</span>
          <span>{t.skills}</span>
        </div>
        <div className="skills-layout">
          <h2>{t.skillsText}</h2>
          <div className="skill-cloud">
            {[
              "TypeScript",
              "React / Next.js",
              "Node.js",
              "Python",
              "React Native",
              "PostgreSQL",
              "MongoDB",
              "Prisma",
              "Sequelize",
              "Firebase",
              "Docker",
              "Tailwind CSS",
              "Cybersecurity",
            ].map((skill, index) => (
              <span
                key={skill}
                className={
                  index % 4 === 0
                    ? "skill-chip skill-chip-accent"
                    : "skill-chip"
                }
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="contact section container">
        <div className="contact-panel">
          <div>
            <p className="eyebrow">06 / Contact</p>
            <h2>{t.contactTitle}</h2>
            <p>{t.contactText}</p>
          </div>
          <a
            className="button button-light"
            href="mailto:akonkwaushindi@gmail.com"
          >
            {t.contact}
            <Mail size={17} />
          </a>
        </div>
      </section>

      <footer className="footer container">
        <div className="footer-top">
          <a href="#top" className="brand">
            <span className="brand-mark">A</span>
            <span>
              Isaac
              <br />
              Akonkwa
            </span>
          </a>
          <p>{t.footer}</p>
          <div className="socials">
            <a href="https://github.com/Akon2020" aria-label="GitHub">
              <Globe2 size={17} />
            </a>
            <a href="https://linkedin.com/in/akonizk" aria-label="LinkedIn">
              <ExternalLink size={17} />
            </a>
            <a href="mailto:akonkwaushindi@gmail.com" aria-label="Email">
              <Mail size={17} />
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {currentYear} Isaac Akonkwa</span>
          <span>Français / English</span>
          <span>Made with intention.</span>
        </div>
      </footer>

      <AnimatePresence>
        {activeProject !== null && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveProject(null)}
          >
            <motion.div
              className="project-modal"
              initial={{ y: 25, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 25, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="modal-close"
                onClick={() => setActiveProject(null)}
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
              <img
                src={projects[activeProject].image}
                alt={projects[activeProject].title}
              />
              <div>
                <p>{projects[activeProject].category}</p>
                <h2>{projects[activeProject].title}</h2>
                <p>{projects[activeProject].description}</p>
                <a
                  className="text-link"
                  href="#contact"
                  onClick={() => setActiveProject(null)}
                >
                  Démarrer une conversation <ArrowUpRight size={16} />
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
