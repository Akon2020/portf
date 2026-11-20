import { boolean, date, index, integer, numeric, pgEnum, pgTable, text, uniqueIndex, uuid, jsonb } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { createdAt, deletedAt, id, timestamptz, updatedAt } from "./columns";
import { currency, projects } from "./content";
import { clients, quotes, type Attachment } from "./crm";

export const clientProjectStatus = pgEnum("client_project_status", [
  "lead",
  "planned",
  "in_progress",
  "review",
  "on_hold",
  "delivered",
  "maintenance",
  "cancelled",
]);
export const milestoneStatus = pgEnum("milestone_status", ["pending", "in_progress", "done", "cancelled"]);
export const invoiceStatus = pgEnum("invoice_status", ["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "cancelled"]);
export const invoiceKind = pgEnum("invoice_kind", ["standard", "deposit", "milestone"]);
export const paymentMethod = pgEnum("payment_method", ["cash", "mpesa", "airtel_money", "orange_money", "bank_transfer", "card", "other"]);

export const clientProjects = pgTable(
  "client_projects",
  {
    id: id(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: clientProjectStatus("status").notNull().default("planned"),
    startDate: date("start_date", { mode: "string" }),
    dueDate: date("due_date", { mode: "string" }),
    budget: integer("budget"),
    currency: currency("currency").notNull().default("USD"),
    /** Manual progress (0 to 100). When null, computed from the milestones. */
    progress: integer("progress"),
    repoUrl: text("repo_url"),
    stagingUrl: text("staging_url"),
    productionUrl: text("production_url"),
    visibleToClient: boolean("visible_to_client").notNull().default(true),
    portfolioProjectId: uuid("portfolio_project_id").references(() => projects.id, { onDelete: "set null" }),
    quoteId: uuid("quote_id").references(() => quotes.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => [index("client_projects_client_idx").on(table.clientId), index("client_projects_status_idx").on(table.status)],
);

export const milestones = pgTable(
  "milestones",
  {
    id: id(),
    clientProjectId: uuid("client_project_id")
      .notNull()
      .references(() => clientProjects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    dueDate: date("due_date", { mode: "string" }),
    status: milestoneStatus("status").notNull().default("pending"),
    amount: integer("amount"),
    visibleToClient: boolean("visible_to_client").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    completedAt: timestamptz("completed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("milestones_project_idx").on(table.clientProjectId, table.sortOrder)],
);

/** Files shared on a client project, stored in the private directory. */
export const projectFiles = pgTable(
  "project_files",
  {
    id: id(),
    clientProjectId: uuid("client_project_id")
      .notNull()
      .references(() => clientProjects.id, { onDelete: "cascade" }),
    file: jsonb("file").$type<Attachment>().notNull(),
    note: text("note"),
    visibleToClient: boolean("visible_to_client").notNull().default(true),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [index("project_files_project_idx").on(table.clientProjectId)],
);

/** Progress log, optionally visible in the client portal. */
export const projectUpdates = pgTable(
  "project_updates",
  {
    id: id(),
    clientProjectId: uuid("client_project_id")
      .notNull()
      .references(() => clientProjects.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    visibleToClient: boolean("visible_to_client").notNull().default(true),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [index("project_updates_project_idx").on(table.clientProjectId, table.createdAt)],
);

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    number: text("number"),
    kind: invoiceKind("kind").notNull().default("standard"),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    clientProjectId: uuid("client_project_id").references(() => clientProjects.id, { onDelete: "set null" }),
    quoteId: uuid("quote_id").references(() => quotes.id, { onDelete: "set null" }),
    milestoneId: uuid("milestone_id").references(() => milestones.id, { onDelete: "set null" }),
    recipientName: text("recipient_name").notNull(),
    recipientEmail: text("recipient_email"),
    recipientPhone: text("recipient_phone"),
    recipientAddress: text("recipient_address"),
    title: text("title").notNull(),
    locale: text("locale").notNull().default("fr"),
    issueDate: date("issue_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    currency: currency("currency").notNull().default("USD"),
    exchangeRate: numeric("exchange_rate", { precision: 14, scale: 4 }),
    subtotal: integer("subtotal").notNull().default(0),
    discount: integer("discount").notNull().default(0),
    taxRate: integer("tax_rate").notNull().default(0),
    taxAmount: integer("tax_amount").notNull().default(0),
    total: integer("total").notNull().default(0),
    amountPaid: integer("amount_paid").notNull().default(0),
    balance: integer("balance").notNull().default(0),
    notes: text("notes"),
    terms: text("terms"),
    status: invoiceStatus("status").notNull().default("draft"),
    publicToken: text("public_token").notNull(),
    tokenRevokedAt: timestamptz("token_revoked_at"),
    sentAt: timestamptz("sent_at"),
    viewedAt: timestamptz("viewed_at"),
    paidAt: timestamptz("paid_at"),
    cancelledAt: timestamptz("cancelled_at"),
    cancelReason: text("cancel_reason"),
    lastReminderAt: timestamptz("last_reminder_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => [
    uniqueIndex("invoices_number_idx").on(table.number),
    uniqueIndex("invoices_public_token_idx").on(table.publicToken),
    index("invoices_status_idx").on(table.status, table.dueDate),
    index("invoices_client_idx").on(table.clientId),
  ],
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: id(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    unitPrice: integer("unit_price").notNull(),
    total: integer("total").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("invoice_items_invoice_idx").on(table.invoiceId, table.sortOrder)],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    currency: currency("currency").notNull(),
    method: paymentMethod("method").notNull(),
    reference: text("reference"),
    paidAt: date("paid_at", { mode: "string" }).notNull(),
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [index("payments_invoice_idx").on(table.invoiceId), index("payments_paid_at_idx").on(table.paidAt)],
);

export const receipts = pgTable(
  "receipts",
  {
    id: id(),
    number: text("number").notNull(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    publicToken: text("public_token").notNull(),
    tokenRevokedAt: timestamptz("token_revoked_at"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("receipts_number_idx").on(table.number),
    uniqueIndex("receipts_payment_idx").on(table.paymentId),
    uniqueIndex("receipts_public_token_idx").on(table.publicToken),
  ],
);

export type ClientProject = typeof clientProjects.$inferSelect;
export type Milestone = typeof milestones.$inferSelect;
export type ProjectFile = typeof projectFiles.$inferSelect;
export type ProjectUpdate = typeof projectUpdates.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Receipt = typeof receipts.$inferSelect;
export type PaymentMethod = (typeof paymentMethod.enumValues)[number];
export type ClientProjectStatus = (typeof clientProjectStatus.enumValues)[number];
export type InvoiceStatus = (typeof invoiceStatus.enumValues)[number];
