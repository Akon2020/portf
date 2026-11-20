import { and, asc, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { slugify } from "@/lib/slug";
import { normalizePhone } from "@/lib/whatsapp";
import { z } from "@/lib/zod";
import { revokeUserSessions } from "../auth/session-store";
import { stringList } from "../content/schemas";
import { getDb } from "../db";
import {
  clientProjects,
  clients,
  contacts,
  conversations,
  invoices,
  milestones,
  payments,
  projectFiles,
  projectUpdates,
  projects,
  quotes,
  users,
  type ClientProject,
  type Milestone,
} from "../db/schema";
import { storeAttachments } from "../storage/private";
import { writeAudit } from "./audit";
import type { RequestMeta } from "./inbox";

export class ClientError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
  }
}

export interface Actor extends RequestMeta {
  id: string;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .default("")
    .transform((value) => value || null);

const optionalDate = z
  .string()
  .trim()
  .default("")
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Date invalide")
  .transform((value) => value || null);

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .default("")
  .refine((value) => value === "" || /^https?:\/\/\S+$/.test(value), "Adresse web invalide (https://...)")
  .transform((value) => value || null);

const optionalMoney = z
  .string()
  .trim()
  .default("")
  .transform((value, context) => {
    if (!value) return null;
    const normalized = value.replace(/\s/g, "").replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
      context.addIssue({ code: "custom", message: "Montant invalide" });
      return z.NEVER;
    }
    return Math.round(Number(normalized) * 100);
  });

// Clients

export const clientInputSchema = z.object({
  type: z.enum(["person", "company"]),
  name: z.string().trim().min(2, "Obligatoire").max(160),
  contactName: optionalText(160),
  email: z
    .string()
    .trim()
    .max(254)
    .default("")
    .refine((value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Adresse e-mail invalide")
    .transform((value) => value.toLowerCase() || null),
  phone: optionalText(40),
  whatsapp: z
    .string()
    .trim()
    .max(40)
    .default("")
    .transform((value, context) => {
      if (!value) return null;
      const digits = normalizePhone(value);
      if (!digits) {
        context.addIssue({ code: "custom", message: "Numéro invalide (format international, ex. +243 970 000 000)" });
        return z.NEVER;
      }
      return `+${digits}`;
    }),
  address: optionalText(400),
  city: optionalText(120),
  country: optionalText(120),
  taxId: optionalText(200),
  notes: optionalText(5000),
  tags: stringList,
});

export type ClientInput = z.infer<typeof clientInputSchema>;

export async function saveClient(id: string | null, input: ClientInput, actor: Actor): Promise<string> {
  const db = getDb();
  if (input.email) {
    const [clash] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.email, input.email), isNull(clients.deletedAt), id ? ne(clients.id, id) : sql`true`))
      .limit(1);
    if (clash) throw new ClientError("Un autre client utilise déjà cette adresse e-mail.", "email");
  }
  let clientId = id;
  if (id) {
    const updated = await db.update(clients).set(input).where(and(eq(clients.id, id), isNull(clients.deletedAt))).returning({ id: clients.id, userId: clients.userId });
    if (!updated[0]) throw new ClientError("Client introuvable.");
    // Keeps the portal account e-mail in line with the client record.
    if (updated[0].userId && input.email) await db.update(users).set({ email: input.email, name: input.contactName ?? input.name }).where(eq(users.id, updated[0].userId));
  } else {
    const [created] = await db.insert(clients).values(input).returning({ id: clients.id });
    clientId = created.id;
  }
  await writeAudit({ actorId: actor.id, action: id ? "client.update" : "client.create", entityType: "client", entityId: clientId!, ip: actor.ip, userAgent: actor.userAgent });
  return clientId!;
}

export async function deleteClient(id: string, actor: Actor): Promise<void> {
  const db = getDb();
  const [open] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(eq(invoices.clientId, id), inArray(invoices.status, ["sent", "viewed", "partially_paid", "overdue"])))
    .limit(1);
  if (open) throw new ClientError("Ce client a des factures en cours : réglez-les ou annulez-les d'abord.");
  const [client] = await db.update(clients).set({ deletedAt: new Date(), portalEnabled: false }).where(eq(clients.id, id)).returning();
  if (client?.userId) {
    await db.update(users).set({ isActive: false }).where(eq(users.id, client.userId));
    await revokeUserSessions(client.userId);
  }
  await writeAudit({ actorId: actor.id, action: "client.delete", entityType: "client", entityId: id, ip: actor.ip });
}

export interface ClientListRow {
  id: string;
  name: string;
  type: "person" | "company";
  email: string | null;
  whatsapp: string | null;
  city: string | null;
  tags: string[];
  portalEnabled: boolean;
  projects: number;
  due: { currency: "USD" | "CDF"; amount: number }[];
  createdAt: Date;
}

/** Clients with their open projects and amounts due, per currency (never added together). */
export async function listClients(search = ""): Promise<ClientListRow[]> {
  const needle = search.trim().slice(0, 80);
  const pattern = `%${needle.replace(/[%_]/g, "")}%`;
  const rows = await getDb()
    .select({
      client: clients,
      projects: sql<number>`(select count(*)::int from client_projects cp where cp.client_id = ${clients.id} and cp.deleted_at is null)`,
      due: sql<{ currency: "USD" | "CDF"; amount: number }[] | null>`(
        select json_agg(json_build_object('currency', currency, 'amount', amount)) from (
          select i.currency, sum(i.balance)::int as amount from invoices i
          where i.client_id = ${clients.id} and i.deleted_at is null and i.status in ('sent', 'viewed', 'partially_paid', 'overdue')
          group by i.currency
        ) d
      )`,
    })
    .from(clients)
    .where(
      and(
        isNull(clients.deletedAt),
        needle ? or(ilike(clients.name, pattern), ilike(clients.email, pattern), ilike(clients.contactName, pattern), ilike(clients.city, pattern)) : undefined,
      ),
    )
    .orderBy(asc(clients.name))
    .limit(500);
  return rows.map(({ client, projects: projectCount, due }) => ({
    id: client.id,
    name: client.name,
    type: client.type,
    email: client.email,
    whatsapp: client.whatsapp,
    city: client.city,
    tags: client.tags,
    portalEnabled: client.portalEnabled,
    projects: projectCount,
    due: (due ?? []).filter((row) => row.amount > 0),
    createdAt: client.createdAt,
  }));
}

export async function getClientDetail(id: string) {
  const db = getDb();
  const [client] = await db.select().from(clients).where(and(eq(clients.id, id), isNull(clients.deletedAt))).limit(1);
  if (!client) return null;
  const [projectRows, invoiceRows, quoteRows, paymentRows, conversationRows] = await Promise.all([
    db.select().from(clientProjects).where(and(eq(clientProjects.clientId, id), isNull(clientProjects.deletedAt))).orderBy(desc(clientProjects.createdAt)),
    db.select().from(invoices).where(and(eq(invoices.clientId, id), isNull(invoices.deletedAt))).orderBy(desc(invoices.issueDate), desc(invoices.createdAt)),
    db.select().from(quotes).where(and(eq(quotes.clientId, id), isNull(quotes.deletedAt))).orderBy(desc(quotes.createdAt)),
    db
      .select({ payment: payments, invoiceNumber: invoices.number })
      .from(payments)
      .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
      .where(eq(invoices.clientId, id))
      .orderBy(desc(payments.paidAt)),
    db
      .select({ id: conversations.id, subject: conversations.subject, status: conversations.status, lastMessageAt: conversations.lastMessageAt })
      .from(conversations)
      .innerJoin(contacts, eq(contacts.id, conversations.contactId))
      .where(or(eq(contacts.clientId, id), client.email ? eq(contacts.email, client.email) : sql`false`))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(30),
  ]);
  const due = new Map<"USD" | "CDF", number>();
  for (const invoice of invoiceRows) {
    if (["sent", "viewed", "partially_paid", "overdue"].includes(invoice.status)) due.set(invoice.currency, (due.get(invoice.currency) ?? 0) + invoice.balance);
  }
  return {
    client,
    projects: projectRows,
    invoices: invoiceRows,
    quotes: quoteRows,
    payments: paymentRows,
    conversations: conversationRows,
    due: [...due.entries()].map(([currency, amount]) => ({ currency, amount })).filter((row) => row.amount > 0),
  };
}

/**
 * Portal access: a user with the client role is created (or reactivated) for
 * the client e-mail. Disabling deactivates the account and closes its sessions.
 */
export async function setPortalAccess(clientId: string, enabled: boolean, actor: Actor): Promise<void> {
  const db = getDb();
  const [client] = await db.select().from(clients).where(and(eq(clients.id, clientId), isNull(clients.deletedAt))).limit(1);
  if (!client) throw new ClientError("Client introuvable.");
  if (enabled) {
    if (!client.email) throw new ClientError("Ajoutez l'e-mail du client avant d'ouvrir son espace.");
    let userId = client.userId;
    if (!userId) {
      const [existing] = await db.select().from(users).where(eq(users.email, client.email)).limit(1);
      if (existing && (existing.role !== "client" || (existing.clientId && existing.clientId !== clientId))) {
        throw new ClientError("Cette adresse e-mail est déjà utilisée par un autre compte.");
      }
      if (existing) {
        userId = existing.id;
        await db.update(users).set({ clientId, isActive: true, deletedAt: null }).where(eq(users.id, existing.id));
      } else {
        const [created] = await db
          .insert(users)
          .values({ email: client.email, name: client.contactName ?? client.name, role: "client", clientId })
          .returning({ id: users.id });
        userId = created.id;
      }
    } else {
      await db.update(users).set({ isActive: true, email: client.email }).where(eq(users.id, userId));
    }
    await db.update(clients).set({ portalEnabled: true, userId }).where(eq(clients.id, clientId));
  } else {
    await db.update(clients).set({ portalEnabled: false }).where(eq(clients.id, clientId));
    if (client.userId) {
      await db.update(users).set({ isActive: false }).where(eq(users.id, client.userId));
      await revokeUserSessions(client.userId);
    }
  }
  await writeAudit({ actorId: actor.id, action: enabled ? "client.portal_enabled" : "client.portal_disabled", entityType: "client", entityId: clientId, ip: actor.ip });
}

// Client projects

export const CLIENT_PROJECT_STATUSES = ["lead", "planned", "in_progress", "review", "on_hold", "delivered", "maintenance", "cancelled"] as const;

export const clientProjectInputSchema = z.object({
  name: z.string().trim().min(2, "Obligatoire").max(200),
  description: optionalText(5000),
  status: z.enum(CLIENT_PROJECT_STATUSES),
  startDate: optionalDate,
  dueDate: optionalDate,
  budget: optionalMoney,
  currency: z.enum(["USD", "CDF"]),
  progress: z
    .string()
    .trim()
    .default("")
    .transform((value, context) => {
      if (!value) return null;
      const number = Number(value);
      if (!Number.isInteger(number) || number < 0 || number > 100) {
        context.addIssue({ code: "custom", message: "Entre 0 et 100" });
        return z.NEVER;
      }
      return number;
    }),
  repoUrl: optionalUrl,
  stagingUrl: optionalUrl,
  productionUrl: optionalUrl,
  visibleToClient: z.boolean().default(false),
});

export type ClientProjectInput = z.infer<typeof clientProjectInputSchema>;

export async function saveClientProject(id: string | null, clientId: string, input: ClientProjectInput, actor: Actor): Promise<string> {
  const db = getDb();
  let projectId = id;
  if (id) {
    const updated = await db.update(clientProjects).set(input).where(and(eq(clientProjects.id, id), isNull(clientProjects.deletedAt))).returning({ id: clientProjects.id });
    if (!updated[0]) throw new ClientError("Projet introuvable.");
  } else {
    const [client] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, clientId), isNull(clients.deletedAt))).limit(1);
    if (!client) throw new ClientError("Client introuvable.");
    const [created] = await db.insert(clientProjects).values({ ...input, clientId }).returning({ id: clientProjects.id });
    projectId = created.id;
  }
  await writeAudit({ actorId: actor.id, action: id ? "client_project.update" : "client_project.create", entityType: "client_project", entityId: projectId!, ip: actor.ip });
  return projectId!;
}

export async function deleteClientProject(id: string, actor: Actor): Promise<string | null> {
  const [project] = await getDb().update(clientProjects).set({ deletedAt: new Date() }).where(eq(clientProjects.id, id)).returning({ clientId: clientProjects.clientId });
  await writeAudit({ actorId: actor.id, action: "client_project.delete", entityType: "client_project", entityId: id, ip: actor.ip });
  return project?.clientId ?? null;
}

/** Manual progress wins, otherwise the share of completed milestones. */
export function projectProgress(project: Pick<ClientProject, "progress" | "status">, projectMilestones: Pick<Milestone, "status">[]): number {
  if (project.progress !== null && project.progress !== undefined) return project.progress;
  if (["delivered", "maintenance"].includes(project.status)) return 100;
  const counted = projectMilestones.filter((milestone) => milestone.status !== "cancelled");
  if (counted.length === 0) return 0;
  return Math.round((counted.filter((milestone) => milestone.status === "done").length / counted.length) * 100);
}

export async function getClientProjectDetail(id: string, options: { clientId?: string; visibleOnly?: boolean } = {}) {
  const db = getDb();
  const [row] = await db
    .select({ project: clientProjects, client: clients })
    .from(clientProjects)
    .innerJoin(clients, eq(clients.id, clientProjects.clientId))
    .where(
      and(
        eq(clientProjects.id, id),
        isNull(clientProjects.deletedAt),
        options.clientId ? eq(clientProjects.clientId, options.clientId) : undefined,
        options.visibleOnly ? eq(clientProjects.visibleToClient, true) : undefined,
      ),
    )
    .limit(1);
  if (!row) return null;
  const visible = <T extends { visibleToClient: boolean }>(list: T[]) => (options.visibleOnly ? list.filter((item) => item.visibleToClient) : list);
  const [milestoneRows, updateRows, fileRows, invoiceRows] = await Promise.all([
    db.select().from(milestones).where(eq(milestones.clientProjectId, id)).orderBy(asc(milestones.sortOrder), asc(milestones.dueDate)),
    db.select().from(projectUpdates).where(eq(projectUpdates.clientProjectId, id)).orderBy(desc(projectUpdates.createdAt)),
    db.select().from(projectFiles).where(eq(projectFiles.clientProjectId, id)).orderBy(desc(projectFiles.createdAt)),
    db.select().from(invoices).where(and(eq(invoices.clientProjectId, id), isNull(invoices.deletedAt))).orderBy(desc(invoices.issueDate)),
  ]);
  const shownMilestones = visible(milestoneRows);
  return {
    project: row.project,
    client: row.client,
    milestones: shownMilestones,
    updates: visible(updateRows),
    files: visible(fileRows),
    invoices: options.visibleOnly ? invoiceRows.filter((invoice) => invoice.status !== "draft" && invoice.status !== "cancelled") : invoiceRows,
    progress: projectProgress(row.project, milestoneRows),
  };
}

// Milestones

export const milestoneInputSchema = z.object({
  title: z.string().trim().min(2, "Obligatoire").max(200),
  description: optionalText(2000),
  dueDate: optionalDate,
  status: z.enum(["pending", "in_progress", "done", "cancelled"]),
  amount: optionalMoney,
  visibleToClient: z.boolean().default(false),
});

export async function saveMilestone(projectId: string, id: string | null, input: z.infer<typeof milestoneInputSchema>, actor: Actor): Promise<void> {
  const db = getDb();
  const completedAt = input.status === "done" ? new Date() : null;
  if (id) {
    const [current] = await db.select().from(milestones).where(and(eq(milestones.id, id), eq(milestones.clientProjectId, projectId))).limit(1);
    if (!current) throw new ClientError("Jalon introuvable.");
    await db
      .update(milestones)
      .set({ ...input, completedAt: input.status === "done" ? (current.completedAt ?? completedAt) : null })
      .where(eq(milestones.id, id));
  } else {
    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${milestones.sortOrder}), -1)::int + 1` })
      .from(milestones)
      .where(eq(milestones.clientProjectId, projectId));
    await db.insert(milestones).values({ ...input, completedAt, clientProjectId: projectId, sortOrder: next });
  }
  await writeAudit({ actorId: actor.id, action: id ? "milestone.update" : "milestone.create", entityType: "client_project", entityId: projectId, diff: { title: input.title, status: input.status }, ip: actor.ip });
}

export async function deleteMilestone(projectId: string, id: string, actor: Actor): Promise<void> {
  await getDb().delete(milestones).where(and(eq(milestones.id, id), eq(milestones.clientProjectId, projectId)));
  await writeAudit({ actorId: actor.id, action: "milestone.delete", entityType: "client_project", entityId: projectId, ip: actor.ip });
}

// Progress log and files

export async function addProjectUpdate(projectId: string, body: string, visibleToClient: boolean, actor: Actor): Promise<void> {
  const text = body.trim().slice(0, 5000);
  if (text.length < 2) throw new ClientError("Le message est vide.", "body");
  await getDb().insert(projectUpdates).values({ clientProjectId: projectId, body: text, visibleToClient, authorId: actor.id });
}

export async function deleteProjectUpdate(projectId: string, id: string): Promise<void> {
  await getDb().delete(projectUpdates).where(and(eq(projectUpdates.id, id), eq(projectUpdates.clientProjectId, projectId)));
}

export async function addProjectFiles(projectId: string, files: File[], options: { note: string | null; visibleToClient: boolean }, actor: Actor): Promise<number> {
  const stored = await storeAttachments(files);
  if (stored.length === 0) throw new ClientError("Aucun fichier reçu.");
  await getDb()
    .insert(projectFiles)
    .values(stored.map((file) => ({ clientProjectId: projectId, file, note: options.note, visibleToClient: options.visibleToClient, uploadedBy: actor.id })));
  await writeAudit({ actorId: actor.id, action: "project_file.upload", entityType: "client_project", entityId: projectId, diff: { count: stored.length }, ip: actor.ip });
  return stored.length;
}

export async function setProjectFileVisibility(projectId: string, id: string, visibleToClient: boolean): Promise<void> {
  await getDb().update(projectFiles).set({ visibleToClient }).where(and(eq(projectFiles.id, id), eq(projectFiles.clientProjectId, projectId)));
}

export async function deleteProjectFile(projectId: string, id: string, actor: Actor): Promise<void> {
  const [row] = await getDb().delete(projectFiles).where(and(eq(projectFiles.id, id), eq(projectFiles.clientProjectId, projectId))).returning();
  if (row) {
    const { getPrivateStorage } = await import("../storage/private");
    await getPrivateStorage()
      .remove(row.file.path)
      .catch(() => undefined);
    await writeAudit({ actorId: actor.id, action: "project_file.delete", entityType: "client_project", entityId: projectId, diff: { name: row.file.name }, ip: actor.ip });
  }
}

/**
 * Creates a draft case study from a client project. Confidential by default:
 * the client name is never shown publicly until Isaac decides otherwise.
 */
export async function publishAsCaseStudy(projectId: string, actor: Actor): Promise<string> {
  const db = getDb();
  const detail = await getClientProjectDetail(projectId);
  if (!detail) throw new ClientError("Projet introuvable.");
  if (detail.project.portfolioProjectId) return detail.project.portfolioProjectId;
  const base = slugify(detail.project.name) || "projet-client";
  let slug = base;
  for (let attempt = 2; ; attempt += 1) {
    const [clash] = await db.select({ id: projects.id }).from(projects).where(eq(projects.slug, slug)).limit(1);
    if (!clash) break;
    slug = `${base}-${attempt}`;
  }
  const [created] = await db
    .insert(projects)
    .values({
      slug,
      title: { fr: detail.project.name, en: "" },
      summary: { fr: detail.project.description?.slice(0, 400) ?? "", en: "" },
      projectType: "client",
      confidential: true,
      clientName: detail.client.name,
      stage: ["delivered", "maintenance"].includes(detail.project.status) ? "completed" : "in_progress",
      startedAt: detail.project.startDate,
      endedAt: detail.project.status === "delivered" ? detail.project.dueDate : null,
      repoUrl: null,
      demoUrl: null,
      status: "draft",
      needsReview: true,
      reviewNote: "Étude de cas créée depuis un projet client : compléter le contenu et confirmer l'accord du client avant toute publication.",
    })
    .returning({ id: projects.id });
  await db.update(clientProjects).set({ portfolioProjectId: created.id }).where(eq(clientProjects.id, projectId));
  await writeAudit({ actorId: actor.id, action: "client_project.case_study", entityType: "client_project", entityId: projectId, diff: { projectId: created.id }, ip: actor.ip });
  return created.id;
}
