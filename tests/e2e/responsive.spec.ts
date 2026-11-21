import { expect, test } from "@playwright/test";
import { horizontalOverflow, login } from "./helpers";

const PUBLIC_PAGES = ["/", "/a-propos", "/projets", "/projets/projet-e2e", "/services", "/devis", "/contact", "/blog", "/galerie", "/mentions-legales", "/en", "/en/projects"];
const ADMIN_PAGES = [
  "/admin",
  "/admin/messagerie",
  "/admin/devis",
  "/admin/clients",
  "/admin/facturation",
  "/admin/facturation/rapports",
  "/admin/taches",
  "/admin/taches?vue=kanban",
  "/admin/taches?vue=calendrier",
  "/admin/contenu",
  "/admin/contenu/projets",
  "/admin/blog",
  "/admin/galerie",
  "/admin/monitoring",
  "/admin/monitoring/securite",
  "/admin/monitoring/bannissements",
  "/admin/monitoring/journaux",
  "/admin/parametres",
  "/admin/securite",
];

test.describe("affichage mobile", () => {
  test("aucune page publique ne déborde horizontalement", async ({ page }) => {
    for (const path of PUBLIC_PAGES) {
      await page.goto(path);
      expect(await horizontalOverflow(page), path).toBeLessThanOrEqual(0);
    }
  });

  test("aucune page de l'administration ne déborde horizontalement", async ({ page, context }) => {
    await context.setExtraHTTPHeaders({ "x-forwarded-for": "198.18.4.1" });
    await login(page, "e2e-admin@example.test", "Bukavu-Lac-Kivu-2026");
    await page.waitForURL("**/admin");
    for (const path of ADMIN_PAGES) {
      await page.goto(path);
      expect(await horizontalOverflow(page), path).toBeLessThanOrEqual(0);
    }
    await page.goto("/admin");
    await page.getByRole("button", { name: /ouvrir le menu/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
