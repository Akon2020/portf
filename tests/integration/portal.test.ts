import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { validateSessionToken } from "@/server/auth/session-store";
import { closeDb, getDb } from "@/server/db";
import { authTokens, clients, users } from "@/server/db/schema";
import { getClientProjectDetail, saveClientProject, setPortalAccess, clientProjectInputSchema } from "@/server/services/clients";
import { confirmMagicLink, portalOverview, requestMagicLink } from "@/server/services/portal";
import { hasTestDatabase, prepareTestDatabase } from "./helpers";
import { clearOutbox, readOutbox } from "./helpers-mail";

const meta = { ip: "203.0.113.50", userAgent: "vitest" };

async function setup() {
  const db = getDb();
  const [admin] = await db.insert(users).values({ email: "admin@example.test", name: "Isaac", role: "super_admin" }).returning();
  const actor = { id: admin.id, ...meta };
  const [alpha] = await db.insert(clients).values({ name: "Alpha", email: "alpha@example.test" }).returning();
  const [beta] = await db.insert(clients).values({ name: "Beta", email: "beta@example.test" }).returning();
  const project = (name: string) => clientProjectInputSchema.parse({ name, status: "in_progress", currency: "USD", visibleToClient: true });
  const alphaProject = await saveClientProject(null, alpha.id, project("Projet Alpha"), actor);
  const betaProject = await saveClientProject(null, beta.id, project("Projet Beta"), actor);
  return { actor, alpha, beta, alphaProject, betaProject };
}

async function lastLinkToken(): Promise<string | null> {
  const mails = await readOutbox();
  const match = mails.join("\n").replace(/=\r?\n/g, "").match(/jeton=3D([A-Za-z0-9_-]+)|jeton=([A-Za-z0-9_-]+)/);
  return match ? (match[1] ?? match[2]) : null;
}

describe.skipIf(!hasTestDatabase)("client portal", () => {
  beforeEach(async () => {
    await prepareTestDatabase();
    await clearOutbox();
  });
  afterAll(closeDb);

  it("sends no link to unknown addresses or closed portals", async () => {
    await setup();
    await requestMagicLink("nobody@example.test", meta);
    await requestMagicLink("alpha@example.test", meta);
    expect(await readOutbox()).toHaveLength(0);
    expect(await getDb().select().from(authTokens)).toHaveLength(0);
  });

  it("signs in once with the magic link and keeps clients isolated", async () => {
    const { actor, alpha, alphaProject, betaProject } = await setup();
    await setPortalAccess(alpha.id, true, actor);
    await requestMagicLink("Alpha@Example.test", meta);
    const token = await lastLinkToken();
    expect(token).toBeTruthy();

    const session = await confirmMagicLink(token!, meta);
    expect(session).toBeTruthy();
    expect(await confirmMagicLink(token!, meta)).toBeNull();
    const validated = await validateSessionToken(session!, "client");
    expect(validated?.user.clientId).toBe(alpha.id);
    expect(await validateSessionToken(session!, "admin")).toBeNull();

    expect(await getClientProjectDetail(alphaProject, { clientId: alpha.id, visibleOnly: true })).not.toBeNull();
    expect(await getClientProjectDetail(betaProject, { clientId: alpha.id, visibleOnly: true })).toBeNull();
    const overview = await portalOverview(alpha.id);
    expect(overview.projects.map((row) => row.project.name)).toEqual(["Projet Alpha"]);
  });

  it("closes access and sessions when the portal is disabled", async () => {
    const { actor, alpha } = await setup();
    await setPortalAccess(alpha.id, true, actor);
    await requestMagicLink("alpha@example.test", meta);
    const session = await confirmMagicLink((await lastLinkToken())!, meta);
    await setPortalAccess(alpha.id, false, actor);
    expect(await validateSessionToken(session!, "client")).toBeNull();
    const [user] = await getDb().select().from(users).where(eq(users.email, "alpha@example.test"));
    expect(user.isActive).toBe(false);
  });

  it("limits magic link requests per e-mail", async () => {
    const { actor, alpha } = await setup();
    await setPortalAccess(alpha.id, true, actor);
    for (let index = 0; index < 5; index += 1) await requestMagicLink("alpha@example.test", meta);
    expect(await readOutbox()).toHaveLength(3);
  });
});
