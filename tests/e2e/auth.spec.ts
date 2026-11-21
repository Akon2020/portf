import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { TOTP } from "otpauth";
import { login, waitForMail } from "./helpers";

test.describe("authentification", () => {
  test("connexion admin sans double authentification et retour à la page demandée", async ({ page, context }) => {
    await context.setExtraHTTPHeaders({ "x-forwarded-for": "198.18.1.1" });
    await page.goto("/admin/taches");
    await expect(page).toHaveURL(/\/auth\/login/);
    // The sign-in form keeps the requested page and returns to it.
    await page.locator("#email").fill("e2e-admin@example.test");
    await page.locator("#password").fill("Bukavu-Lac-Kivu-2026");
    await page.getByRole("button", { name: /se connecter/i }).click();
    await page.waitForURL("**/admin/taches");
    await expect(page.getByRole("heading", { name: /tâches et agenda/i })).toBeVisible();
  });

  test("connexion avec la double authentification", async ({ page, context }) => {
    await context.setExtraHTTPHeaders({ "x-forwarded-for": "198.18.1.2" });
    await login(page, "e2e-totp@example.test", "Bukavu-Lac-Kivu-2026");
    await page.waitForURL("**/auth/2fa**");
    await page.locator("#code").fill("000000");
    await page.getByRole("button", { name: /vérifier|valider|continuer/i }).click();
    await expect(page.locator("form [role=alert]")).toBeVisible();
    const code = new TOTP({ secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP", digits: 6, period: 30 }).generate();
    await page.locator("#code").fill(code);
    await page.getByRole("button", { name: /vérifier|valider|continuer/i }).click();
    await page.waitForURL(/\/admin$/);
  });

  test("verrouille le compte après des échecs répétés", async ({ page, context }) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      // A new address each time: the per IP limit is not what is tested here.
      await context.setExtraHTTPHeaders({ "x-forwarded-for": `198.18.2.${attempt + 1}` });
      await login(page, "e2e-lock@example.test", "mauvais-mot-de-passe-123");
      await expect(page.locator("form [role=alert]")).toBeVisible();
    }
    await context.setExtraHTTPHeaders({ "x-forwarded-for": "198.18.2.50" });
    await login(page, "e2e-lock@example.test", "Bukavu-Lac-Kivu-2026");
    await expect(page.locator("form [role=alert]")).toContainText(/trop de tentatives/i);
  });

  test("espace client par lien magique, sans accès aux projets d'un autre client", async ({ page, context }) => {
    await context.setExtraHTTPHeaders({ "x-forwarded-for": "198.18.3.1" });
    const seed = JSON.parse(readFileSync(".tmp-e2e/seed.json", "utf8")) as { alphaProject: string; betaProject: string };
    await page.goto("/espace-client/connexion");
    await page.locator('input[name="email"]').fill("e2e-client@example.test");
    await page.getByRole("button", { name: /lien de connexion/i }).click();
    await expect(page.getByRole("status")).toContainText(/si un espace client existe/i);

    const mail = await waitForMail((content) => content.includes("/espace-client/verifier?jeton="));
    const link = mail.match(/https?:\/\/[^\s"<>]+\/espace-client\/verifier\?jeton=[A-Za-z0-9_-]+/)![0];
    await page.goto(new URL(link).pathname + new URL(link).search);
    await page.getByRole("button", { name: /me connecter/i }).click();
    await page.waitForURL(/\/espace-client$/);
    await expect(page.getByText("Projet Alpha")).toBeVisible();
    await expect(page.getByText("Projet Beta")).toHaveCount(0);

    const own = await page.goto(`/espace-client/projets/${seed.alphaProject}`);
    expect(own?.status()).toBe(200);
    const other = await page.goto(`/espace-client/projets/${seed.betaProject}`);
    expect(other?.status()).toBe(404);

    // The link is single use.
    await page.goto(new URL(link).pathname + new URL(link).search);
    await expect(page.getByRole("heading", { name: /lien expiré/i })).toBeVisible();
  });
});
