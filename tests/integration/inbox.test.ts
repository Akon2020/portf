import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/server/db";
import { contacts, conversations, messages, users } from "@/server/db/schema";
import { checkFormToken, createFormToken } from "@/server/services/anti-spam";
import { convertContactToClient, receiveInbound, replyToConversation } from "@/server/services/inbox";
import { submitQuoteRequest } from "@/server/services/quote-requests";
import { hasTestDatabase, prepareTestDatabase } from "./helpers";
import { clearOutbox, decodeEml, readOutbox } from "./helpers-mail";

const meta = { ip: "203.0.113.30", userAgent: "vitest" };
const header = (eml: string, name: string) => eml.match(new RegExp(`^${name}: (.+)$`, "m"))?.[1]?.trim();

describe("anti spam token", () => {
  it("rejects instant, forged and expired submissions", () => {
    const now = Date.now();
    expect(checkFormToken(createFormToken(now), now + 500)).toEqual({ ok: false, reason: "too_fast" });
    expect(checkFormToken(createFormToken(now), now + 5_000)).toEqual({ ok: true });
    expect(checkFormToken(createFormToken(now), now + 3 * 3600_000)).toEqual({ ok: false, reason: "too_slow" });
    expect(checkFormToken(`${now.toString(36)}.forged`, now + 5_000)).toEqual({ ok: false, reason: "token" });
  });
});

describe.skipIf(!hasTestDatabase)("inbox", () => {
  beforeEach(async () => {
    await prepareTestDatabase();
    await clearOutbox();
  });
  afterAll(closeDb);

  it("stores a message, acknowledges it and notifies the owner", async () => {
    const { conversation } = await receiveInbound(
      { name: "Amani", email: "Amani@Example.test", topic: "project", message: "Bonjour, j'ai un projet d'application mobile pour une coopérative.", locale: "fr" },
      meta,
    );
    const thread = await getDb().select().from(messages).where(eq(messages.conversationId, conversation.id));
    expect(thread.map((m) => m.direction).sort()).toEqual(["inbound", "outbound"]);
    const [contact] = await getDb().select().from(contacts);
    expect(contact.email).toBe("amani@example.test");

    const mails = await readOutbox();
    expect(mails).toHaveLength(2);
    const ack = mails.find((mail) => header(mail, "To") === "amani@example.test")!;
    const ackId = header(ack, "Message-ID");
    expect(thread.find((m) => m.direction === "outbound")?.emailMessageId).toBe(ackId);
    expect(mails.some((mail) => header(mail, "Reply-To") === "amani@example.test")).toBe(true);
  });

  it("replies inside the visitor's e-mail thread", async () => {
    const [admin] = await getDb().insert(users).values({ email: "admin@example.test", name: "Isaac", role: "super_admin" }).returning();
    const { conversation } = await receiveInbound(
      { name: "Amani", email: "amani@example.test", topic: "other", message: "Une question sur vos ateliers de formation pour étudiants.", locale: "en" },
      meta,
    );
    const ackId = (await getDb().select().from(messages).where(eq(messages.direction, "outbound")))[0].emailMessageId;
    await clearOutbox();

    const result = await replyToConversation({ conversationId: conversation.id, body: "Hello,\n\nSure, see https://example.test/ateliers", authorId: admin.id }, meta);
    expect(result).toEqual({ ok: true, delivered: true });

    const [reply] = await readOutbox();
    expect(header(reply, "In-Reply-To")).toBe(ackId);
    expect(header(reply, "References")).toBe(ackId);
    expect(decodeEml(reply)).toContain('href="https://example.test/ateliers"');
    expect(decodeEml(reply)).toContain("wrote:");

    const [updated] = await getDb().select().from(conversations).where(eq(conversations.id, conversation.id));
    expect(updated.status).toBe("replied");
  });

  it("converts a contact into a single client", async () => {
    const { conversation } = await receiveInbound(
      { name: "Amani", email: "amani@example.test", company: "Coop Kivu", topic: "project", message: "Nous voulons digitaliser la gestion de nos membres et cotisations.", locale: "fr" },
      meta,
    );
    const first = await convertContactToClient(conversation.contactId, null as never, meta);
    const second = await convertContactToClient(conversation.contactId, null as never, meta);
    expect(second).toBe(first);
  });

  it("records a quote request with its conversation", async () => {
    const request = await submitQuoteRequest(
      {
        projectType: "mobile_app",
        services: ["applications-mobiles"],
        description: "Application de suivi des livraisons pour une PME de Bukavu.",
        features: ["offline", "payments"],
        featuresOther: "",
        hasDesign: "no",
        referenceLinks: [],
        budgetRange: "1500_5000",
        currency: "USD",
        deadline: "3_months",
        name: "Amani",
        email: "amani@example.test",
        phone: null,
        company: null,
        preferredContact: "whatsapp",
        consent: "1",
      },
      [],
      "fr",
      meta,
    );
    expect(request.conversationId).toBeTruthy();
    const [conversation] = await getDb().select().from(conversations).where(eq(conversations.id, request.conversationId!));
    expect(conversation.source).toBe("quote_form");
    const [summary] = await getDb().select().from(messages).where(eq(messages.direction, "inbound"));
    expect(summary.bodyText).toContain("Application mobile");
    expect(summary.bodyText).toContain("1 500 à 5 000 USD");
  });
});
