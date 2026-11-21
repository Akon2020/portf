import { boolean, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./columns";
import { media, type LocalizedText } from "./content";

/** Questions and answers, grouped by category, on the contact page and optionally the home page. */
export const faqs = pgTable("faqs", {
  id: id(),
  category: jsonb("category").$type<LocalizedText>().notNull(),
  question: jsonb("question").$type<LocalizedText>().notNull(),
  answer: jsonb("answer").$type<LocalizedText>().notNull(),
  showOnHome: boolean("show_on_home").notNull().default(false),
  isVisible: boolean("is_visible").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Organizations of the trust band under the hero: name, website and logo. */
export const partners = pgTable("partners", {
  id: id(),
  name: text("name").notNull(),
  url: text("url"),
  logoMediaId: uuid("logo_media_id").references(() => media.id, { onDelete: "set null" }),
  isVisible: boolean("is_visible").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type Faq = typeof faqs.$inferSelect;
export type Partner = typeof partners.$inferSelect;
