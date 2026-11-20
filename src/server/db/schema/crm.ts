import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { createdAt, deletedAt, id, timestamptz, updatedAt } from "./columns";
import { currency } from "./content";

export const conversationSource = pgEnum("conversation_source", ["contact_form", "quote_form", "manual", "email"]);
export const conversationStatus = pgEnum("conversation_status", ["new", "open", "replied", "closed", "spam"]);
export const messageDirection = pgEnum("message_direction", ["inbound", "outbound"]);
export const deliveryStatus = pgEnum("delivery_status", ["received", "queued", "sent", "failed"]);
export const quoteRequestStatus = pgEnum("quote_request_status", ["new", "reviewing", "quoted", "won", "lost"]);
export const preferredContact = pgEnum("preferred_contact", ["email", "whatsapp", "call"]);
export const clientType = pgEnum("client_type", ["person", "company"]);
export const quoteStatus = pgEnum("quote_status", ["draft", "sent", "viewed", "accepted", "declined", "expired"]);
export const documentType = pgEnum("document_type", ["quote", "invoice", "receipt"]);
export const sendChannel = pgEnum("send_channel", ["email", "whatsapp_link"]);

/** Private file attached to a message or a quote request, never served publicly. */
export type Attachment = { id: string; name: string; mime: string; size: number; path: string };

export const clients = pgTable(
  "clients",
  {
    id: id(),
    type: clientType("type").notNull().default("person"),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    address: text("address"),
    city: text("city"),
    country: text("country").default("RDC"),
    taxId: text("tax_id"),
    notes: text("notes"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    portalEnabled: boolean("portal_enabled").notNull().default(false),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => [index("clients_email_idx").on(table.email)],
);

export const contacts = pgTable(
  "contacts",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    company: text("company"),
    locale: text("locale").notNull().default("fr"),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    firstSeenAt: timestamptz("first_seen_at").notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("contacts_email_idx").on(table.email)],
);

export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    topic: text("topic"),
    source: conversationSource("source").notNull(),
    status: conversationStatus("status").notNull().default("new"),
    lastMessageAt: timestamptz("last_message_at").notNull().defaultNow(),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("conversations_status_idx").on(table.status, table.lastMessageAt)],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    direction: messageDirection("direction").notNull(),
    bodyText: text("body_text").notNull(),
    bodyHtml: text("body_html"),
    attachments: jsonb("attachments").$type<Attachment[]>().notNull().default([]),
    emailMessageId: text("email_message_id"),
    inReplyTo: text("in_reply_to"),
    references: text("references"),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    sentAt: timestamptz("sent_at").notNull().defaultNow(),
    deliveryStatus: deliveryStatus("delivery_status").notNull().default("received"),
    deliveryError: text("delivery_error"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    readAt: timestamptz("read_at"),
    createdAt: createdAt(),
  },
  (table) => [
    index("messages_conversation_idx").on(table.conversationId, table.sentAt),
    index("messages_email_message_id_idx").on(table.emailMessageId),
  ],
);

export const quoteRequests = pgTable(
  "quote_requests",
  {
    id: id(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    projectType: text("project_type").notNull(),
    services: jsonb("services").$type<string[]>().notNull().default([]),
    description: text("description").notNull(),
    features: jsonb("features").$type<string[]>().notNull().default([]),
    budgetRange: text("budget_range"),
    currency: currency("currency").notNull().default("USD"),
    deadline: text("deadline"),
    hasDesign: boolean("has_design").notNull().default(false),
    referenceLinks: jsonb("reference_links").$type<string[]>().notNull().default([]),
    attachments: jsonb("attachments").$type<Attachment[]>().notNull().default([]),
    preferredContact: preferredContact("preferred_contact").notNull().default("email"),
    status: quoteRequestStatus("status").notNull().default("new"),
    locale: text("locale").notNull().default("fr"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("quote_requests_status_idx").on(table.status, table.createdAt)],
);

export const quotes = pgTable(
  "quotes",
  {
    id: id(),
    number: text("number"),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    quoteRequestId: uuid("quote_request_id").references(() => quoteRequests.id, { onDelete: "set null" }),
    // Client project link added with the CRM module.
    clientProjectId: uuid("client_project_id"),
    recipientName: text("recipient_name").notNull(),
    recipientEmail: text("recipient_email"),
    recipientPhone: text("recipient_phone"),
    title: text("title").notNull(),
    locale: text("locale").notNull().default("fr"),
    issueDate: date("issue_date", { mode: "string" }).notNull(),
    validUntil: date("valid_until", { mode: "string" }).notNull(),
    currency: currency("currency").notNull().default("USD"),
    exchangeRate: numeric("exchange_rate", { precision: 14, scale: 4 }),
    subtotal: integer("subtotal").notNull().default(0),
    discount: integer("discount").notNull().default(0),
    taxRate: integer("tax_rate").notNull().default(0),
    taxAmount: integer("tax_amount").notNull().default(0),
    total: integer("total").notNull().default(0),
    notes: text("notes"),
    terms: text("terms"),
    status: quoteStatus("status").notNull().default("draft"),
    publicToken: text("public_token").notNull(),
    tokenRevokedAt: timestamptz("token_revoked_at"),
    sentAt: timestamptz("sent_at"),
    viewedAt: timestamptz("viewed_at"),
    acceptedAt: timestamptz("accepted_at"),
    acceptedBy: text("accepted_by"),
    acceptedIp: text("accepted_ip"),
    declinedAt: timestamptz("declined_at"),
    convertedAt: timestamptz("converted_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => [
    uniqueIndex("quotes_number_idx").on(table.number),
    uniqueIndex("quotes_public_token_idx").on(table.publicToken),
    index("quotes_status_idx").on(table.status),
  ],
);

export const quoteItems = pgTable(
  "quote_items",
  {
    id: id(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    unitPrice: integer("unit_price").notNull(),
    total: integer("total").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("quote_items_quote_idx").on(table.quoteId, table.sortOrder)],
);

/** Gapless numbering per document type and year, incremented inside a transaction. */
export const sequences = pgTable(
  "sequences",
  {
    type: text("type").notNull(),
    year: integer("year").notNull(),
    value: integer("value").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.type, table.year] })],
);

export const documentSends = pgTable(
  "document_sends",
  {
    id: id(),
    documentType: documentType("document_type").notNull(),
    documentId: uuid("document_id").notNull(),
    channel: sendChannel("channel").notNull(),
    recipient: text("recipient").notNull(),
    sentAt: timestamptz("sent_at").notNull().defaultNow(),
    status: text("status").notNull().default("sent"),
    error: text("error"),
    openedAt: timestamptz("opened_at"),
    sentBy: uuid("sent_by").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [index("document_sends_document_idx").on(table.documentType, table.documentId)],
);

export type Contact = typeof contacts.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type QuoteRequest = typeof quoteRequests.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type QuoteItem = typeof quoteItems.$inferSelect;
