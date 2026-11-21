import { expect, test } from "@playwright/test";
import { login, waitForMail } from "./helpers";

test.describe("site public", () => {
  test("affiche l'accueil, les projets publiés et la version anglaise", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page).toHaveTitle(/Isaac Akonkwa/);
    await page.goto("/projets");
    await expect(page.getByRole("link", { name: /Projet de démonstration E2E/ })).toBeVisible();
    await page.goto("/en/projects/projet-e2e");
    await expect(page.locator("h1")).toHaveText("E2E demo project");
    const response = await page.goto("/cette-page-n-existe-pas");
    expect(response?.status()).toBe(404);
  });

  test("envoie le formulaire de contact puis la réponse part depuis l'administration", async ({ page, context }) => {
    await context.setExtraHTTPHeaders({ "x-forwarded-for": "198.18.0.10" });
    await page.goto("/contact");
    await page.locator("#name").fill("Amani Visiteur");
    await page.locator("#email").fill("amani-e2e@example.test");
    await page.locator("#message").fill("Bonjour, je souhaite échanger sur une application mobile pour notre coopérative de café.");
    await page.locator('input[name="consent"]').check();
    // The anti spam token refuses forms filled in less than 3 seconds.
    await page.waitForTimeout(3500);
    await page.getByRole("button", { name: /envoyer le message/i }).click();
    await expect(page.getByText(/message envoyé, merci/i)).toBeVisible();
    await waitForMail((mail) => mail.includes("amani-e2e@example.test"));

    await context.setExtraHTTPHeaders({ "x-forwarded-for": "198.18.0.11" });
    await login(page, "e2e-admin@example.test", "Bukavu-Lac-Kivu-2026");
    await page.waitForURL("**/admin");
    await page.goto("/admin/messagerie");
    await page.getByRole("link", { name: /Amani Visiteur/ }).first().click();
    await page.locator("#reply-body").fill("Bonjour Amani, merci pour votre message. Je vous propose un appel cette semaine.");
    await page.getByRole("button", { name: /^envoyer$/i }).click();
    await expect(page.getByRole("status").filter({ hasText: /envoy/i })).toBeVisible();
    const reply = await waitForMail((mail) => mail.includes("Je vous propose un appel"));
    expect(reply).toMatch(/In-Reply-To:/i);
  });

  test("répond 404 à un scan de /.env puis bannit l'adresse après plusieurs tentatives", async ({ request }) => {
    const headers = { "x-forwarded-for": "198.18.0.66", "user-agent": "Mozilla/5.0 e2e" };
    expect((await request.get("/.env", { headers })).status()).toBe(404);
    expect((await request.get("/.env", { headers })).status()).toBe(404);
    // Bans are written in the background: the next request is refused.
    await expect.poll(async () => (await request.get("/", { headers })).status(), { timeout: 10_000 }).toBe(403);
    expect((await request.get("/", { headers: { "x-forwarded-for": "198.18.0.67" } })).status()).toBe(200);
  });
});
